/**
 * Host half of the Session trash bundle.
 *
 * One Session's durable storage is a session-owned directory below the JSONL
 * persistence root (`<root>/--<project>--/<encoded session id>/`). This plugin
 * moves that directory into a trash directory under the Harness home, records
 * the original location in a `meta.json` beside it, and serves list / restore /
 * purge to the Client and to the `session_trash` tool. Nothing is rewritten:
 * a cold Session is renamed into its trash entry, an entry is renamed back on
 * restore, and purging deletes the entry directory.
 *
 * The trash directory lives outside the persistence root on purpose: the
 * backend lists every project directory below its root, so a trash directory
 * inside that root would be scanned as Sessions.
 */
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, sep } from 'node:path'

/** Cordis plugin name; the Client bundle registers under the package name. */
export const name = 'session-trash'

/** Required Host services: the Fetch carrier, Session storage, and the live store. */
export const inject = ['connection', 'sessionPersistence', 'sessions']

/** Physical generation artifacts of one Session, as the JSONL backend names them. */
const ARTIFACT_PATTERN = /^session(?:\.v[0-9]+)?\.jsonl(?:\.zstd)?$/
/** Extra files a session-owned directory may hold beside its log generations. */
const EXTRA_FILES = new Set(['session.lock'])
/** A Session id is used only after matching this shape, before it reaches a path. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
/** Trash entry directory names are minted here and re-validated on every read. */
const ENTRY_ID_PATTERN = /^[0-9]{8}-[0-9]{6}-[A-Za-z0-9._~-]{1,200}$/
const META_FILE = 'meta.json'
const DATA_DIR = 'data'
const META_VERSION = 1
const MAX_TITLE = 300
const MAX_ENTRIES = 2000

/** A refused trash operation, carrying the code the Client localizes. */
class TrashError extends Error {
  /**
   * @param code - stable machine code (`live`, `not-found`, `io`, ...).
   * @param message - operator-facing English detail.
   */
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/**
 * Escape one string into a single safe path segment, mirroring the persistence
 * backend's encoding so a stored directory can be proved to belong to an id.
 * @param raw - non-empty source string.
 * @returns the escaped segment.
 */
function encodeSegment(raw) {
  let out = ''
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index)
    const char = String.fromCharCode(code)
    out += char !== '~' && /^[A-Za-z0-9._-]$/.test(char)
      ? char
      : `~${code.toString(16).toUpperCase().padStart(4, '0')}`
  }
  return out
}

/** @returns the two-digit padded form of one date part. */
function pad(value) {
  return String(value).padStart(2, '0')
}

/**
 * Resolve the trash directory: a sibling of the Session logs under the
 * Harness home, so it never shows up as a project directory.
 * @param ctx - Host context, for the deployment's home resolver.
 * @returns the absolute trash root.
 */
function trashRootOf(ctx) {
  const homePath = ctx.get('dshHomePath')
  if (typeof homePath === 'function') {
    try {
      return homePath('session-trash')
    } catch {
      // A failing resolver must not hide the feature; fall back to the env form.
    }
  }
  const configured = process.env.DSH_HOME?.trim()
  const home = configured !== undefined && configured.length > 0 ? configured : join(homedir(), '.dsh')
  return join(home, 'session-trash')
}

/** @returns whether `target` is the same as or below `root`. */
function isInside(root, target) {
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`
  return target === root || target.startsWith(normalizedRoot)
}

/** @returns whether the path exists. */
async function exists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

/**
 * Resolve one stored Session and prove that its artifact lives in the
 * session-owned directory the JSONL backend derives from its id.
 * @param ctx - Host context carrying `sessionPersistence`.
 * @param sessionId - candidate Session id.
 * @returns the snapshot, header, artifact path, and owned directory.
 * @throws TrashError when the Session is absent, unmaterialized, or laid out differently.
 */
async function locateSession(ctx, sessionId) {
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new TrashError('invalid-id', 'the Session id is not a single safe path segment')
  }
  let snapshot
  try {
    snapshot = await ctx.sessionPersistence.stat(sessionId)
  } catch (error) {
    throw new TrashError('io', `reading the Session failed: ${String(error?.message ?? error)}`)
  }
  if (snapshot === undefined) throw new TrashError('not-found', `session "${sessionId}" is not stored`)
  const header = snapshot.header
  if (header === undefined || header.id !== sessionId) {
    throw new TrashError('not-found', `session "${sessionId}" is not stored under that id`)
  }
  const artifact = snapshot.location?.path
  if (typeof artifact !== 'string' || artifact.length === 0) {
    throw new TrashError('unmaterialized', `session "${sessionId}" has no materialized log yet`)
  }
  if (!ARTIFACT_PATTERN.test(basename(artifact))) {
    throw new TrashError('unsupported-layout', `session "${sessionId}" has an unexpected artifact name`)
  }
  const sessionDir = dirname(artifact)
  const expected = encodeSegment(sessionId)
  if (basename(sessionDir) !== expected) {
    throw new TrashError('unsupported-layout', `session "${sessionId}" does not own a dedicated directory`)
  }
  return { snapshot, header, artifact, sessionDir }
}

/**
 * Refuse a directory holding anything but known Session artifacts, so a delete
 * can never take unrelated files along.
 * @param sessionDir - the session-owned directory.
 * @returns the file names found.
 */
async function assertSessionFilesOnly(sessionDir) {
  let entries
  try {
    entries = await readdir(sessionDir, { withFileTypes: true })
  } catch (error) {
    throw new TrashError('io', `reading "${sessionDir}" failed: ${String(error?.message ?? error)}`)
  }
  const names = []
  for (const entry of entries) {
    if (!entry.isFile() || (!ARTIFACT_PATTERN.test(entry.name) && !EXTRA_FILES.has(entry.name))) {
      throw new TrashError('unexpected-files', `"${sessionDir}" also holds "${entry.name}", so it was left untouched`)
    }
    names.push(entry.name)
  }
  if (names.length === 0) throw new TrashError('not-found', `"${sessionDir}" is empty`)
  return names
}

/**
 * Sum the byte size of one directory tree.
 * @param path - directory to measure.
 * @returns total bytes of the files below it.
 */
async function directorySize(path) {
  let total = 0
  const entries = await readdir(path, { withFileTypes: true })
  for (const entry of entries) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) total += await directorySize(child)
    else if (entry.isFile()) {
      try {
        total += (await stat(child)).size
      } catch {
        // A vanished file contributes nothing; the entry still moves.
      }
    }
  }
  return total
}

/** @returns whether a live in-memory Session occupies the id. */
function isLive(ctx, sessionId) {
  try {
    return ctx.sessions.get(sessionId) !== undefined
  } catch {
    return true
  }
}

/**
 * Move one directory, falling back to copy-then-delete across devices.
 * @param source - existing directory.
 * @param destination - absent target directory.
 */
async function moveDirectory(source, destination) {
  try {
    await rename(source, destination)
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error
    await cp(source, destination, { recursive: true, errorOnExist: true, force: false })
    await rm(source, { recursive: true, force: true })
  }
}

/** @returns one unused entry id for this Session. */
async function mintEntryId(root, sessionId) {
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const base = `${stamp}-${encodeSegment(sessionId)}`
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    if (!await exists(join(root, candidate))) return candidate
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new TrashError('io', 'could not mint a unique trash entry id')
}

/**
 * The Client-visible shape of one trash entry.
 * @param meta - the stored metadata.
 * @returns the projected entry.
 */
function projectEntry(meta) {
  return {
    entryId: meta.entryId,
    sessionId: meta.sessionId,
    title: typeof meta.title === 'string' ? meta.title : '',
    ...meta.cwd === undefined ? {} : { cwd: meta.cwd },
    deletedAt: Number.isFinite(meta.deletedAt) ? meta.deletedAt : 0,
    sizeBytes: Number.isFinite(meta.sizeBytes) ? meta.sizeBytes : 0,
    createdAt: Number.isFinite(meta.createdAt) ? meta.createdAt : 0,
  }
}

/**
 * Read one trash entry, re-validating the stored metadata before trusting it.
 * @param root - trash root.
 * @param entryId - entry directory name.
 * @returns the entry directory and metadata.
 * @throws TrashError when the entry is missing or does not describe a Session.
 */
async function readEntry(root, entryId) {
  if (typeof entryId !== 'string' || !ENTRY_ID_PATTERN.test(entryId)) {
    throw new TrashError('invalid-entry', 'the trash entry id is not a single safe path segment')
  }
  const dir = join(root, entryId)
  let raw
  try {
    raw = await readFile(join(dir, META_FILE), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') throw new TrashError('not-found', `trash entry "${entryId}" is gone`)
    throw new TrashError('io', `reading trash entry "${entryId}" failed: ${String(error?.message ?? error)}`)
  }
  let meta
  try {
    meta = JSON.parse(raw)
  } catch {
    throw new TrashError('corrupt', `trash entry "${entryId}" has unreadable metadata`)
  }
  if (meta === null || typeof meta !== 'object' || meta.version !== META_VERSION) {
    throw new TrashError('corrupt', `trash entry "${entryId}" has unsupported metadata`)
  }
  if (meta.entryId !== entryId || typeof meta.sessionId !== 'string' || !SESSION_ID_PATTERN.test(meta.sessionId)) {
    throw new TrashError('corrupt', `trash entry "${entryId}" names a different Session`)
  }
  if (typeof meta.sessionDir !== 'string' || !meta.sessionDir.includes(sep)) {
    throw new TrashError('corrupt', `trash entry "${entryId}" lost its original location`)
  }
  if (basename(meta.sessionDir) !== encodeSegment(meta.sessionId)) {
    throw new TrashError('corrupt', `trash entry "${entryId}" points outside a Session directory`)
  }
  return { dir, meta }
}

/**
 * Move one Session's storage into the trash.
 * @param ctx - Host context.
 * @param request - Session id plus the Client-known display title.
 * @returns the stored and projected entry.
 */
async function deleteSession(ctx, request) {
  const sessionId = request?.sessionId
  const located = await locateSession(ctx, sessionId)
  if (isLive(ctx, sessionId)) {
    throw new TrashError(
      'live',
      `session "${sessionId}" is still loaded in this Host process; deleting it now would leave the running Session writing into the trash`,
    )
  }
  await assertSessionFilesOnly(located.sessionDir)
  const root = trashRootOf(ctx)
  if (isInside(root, located.sessionDir)) {
    throw new TrashError('conflict', `session "${sessionId}" is already inside the trash directory`)
  }
  await mkdir(root, { recursive: true })
  const entryId = await mintEntryId(root, sessionId)
  const entryDir = join(root, entryId)
  await mkdir(entryDir, { recursive: true })
  try {
    await moveDirectory(located.sessionDir, join(entryDir, DATA_DIR))
  } catch (error) {
    await rm(entryDir, { recursive: true, force: true }).catch(() => {})
    throw new TrashError('io', `moving session "${sessionId}" failed: ${String(error?.message ?? error)}`)
  }
  const sizeBytes = await directorySize(join(entryDir, DATA_DIR)).catch(() => 0)
  const requestedTitle = typeof request?.title === 'string' ? request.title.trim().slice(0, MAX_TITLE) : ''
  const meta = {
    version: META_VERSION,
    entryId,
    sessionId,
    title: requestedTitle,
    ...located.header.cwd === undefined ? {} : { cwd: located.header.cwd },
    createdAt: Number.isFinite(located.header.createdAt) ? located.header.createdAt : 0,
    deletedAt: Date.now(),
    sizeBytes,
    sessionDir: located.sessionDir,
  }
  try {
    await writeFile(join(entryDir, META_FILE), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
  } catch (error) {
    throw new TrashError('io', `session "${sessionId}" moved but its metadata could not be written: ${String(error?.message ?? error)}`)
  }
  try {
    ctx.emit('api-session/removed', sessionId)
  } catch (error) {
    ctx.logger?.warn?.(`session-trash: could not announce the removal of "${sessionId}": ${String(error)}`)
  }
  return projectEntry(meta)
}

/**
 * List every readable trash entry.
 * @param ctx - Host context.
 * @returns entries newest first, their total size, and the trash directory.
 */
async function listTrash(ctx) {
  const root = trashRootOf(ctx)
  if (!await exists(root)) return { entries: [], totalBytes: 0, trashRoot: root }
  let names
  try {
    names = await readdir(root)
  } catch (error) {
    throw new TrashError('io', `reading the trash directory failed: ${String(error?.message ?? error)}`)
  }
  const entries = []
  let totalBytes = 0
  for (const entryId of names.slice(0, MAX_ENTRIES)) {
    if (!ENTRY_ID_PATTERN.test(entryId)) continue
    try {
      const { meta } = await readEntry(root, entryId)
      const entry = projectEntry(meta)
      totalBytes += entry.sizeBytes
      entries.push(entry)
    } catch {
      // An unreadable entry is skipped, not fatal: the trash still lists the rest.
    }
  }
  entries.sort((left, right) => right.deletedAt - left.deletedAt)
  return { entries, totalBytes, trashRoot: root }
}

/**
 * Move one trash entry back to its original Session directory.
 * @param ctx - Host context.
 * @param request - trash entry id.
 * @returns the restored Session id and directory.
 */
async function restoreEntry(ctx, request) {
  const root = trashRootOf(ctx)
  const { dir, meta } = await readEntry(root, request?.entryId)
  if (isLive(ctx, meta.sessionId)) {
    throw new TrashError('live', `session "${meta.sessionId}" is loaded in this Host process and cannot be restored underneath it`)
  }
  if (await exists(meta.sessionDir)) {
    throw new TrashError('exists', `"${meta.sessionDir}" already exists; refusing to overwrite it`)
  }
  await mkdir(dirname(meta.sessionDir), { recursive: true })
  try {
    await moveDirectory(join(dir, DATA_DIR), meta.sessionDir)
  } catch (error) {
    throw new TrashError('io', `restoring session "${meta.sessionId}" failed: ${String(error?.message ?? error)}`)
  }
  await rm(dir, { recursive: true, force: true }).catch(() => {})
  return { sessionId: meta.sessionId, sessionDir: meta.sessionDir }
}

/**
 * Delete one trash entry, or every entry.
 * @param ctx - Host context.
 * @param request - an entry id, or `all: true`.
 * @returns the number of entries purged.
 */
async function purgeTrash(ctx, request) {
  const root = trashRootOf(ctx)
  if (!await exists(root)) return { count: 0 }
  let entryIds
  if (request?.all === true) {
    entryIds = (await readdir(root)).filter(entryId => ENTRY_ID_PATTERN.test(entryId))
  } else {
    if (typeof request?.entryId !== 'string') throw new TrashError('invalid-entry', 'entryId or all is required')
    entryIds = [request.entryId]
  }
  let count = 0
  for (const entryId of entryIds) {
    const { dir, meta } = await readEntry(root, entryId)
    if (isLive(ctx, meta.sessionId)) continue
    await rm(dir, { recursive: true, force: true })
    count += 1
  }
  return { count }
}

/** @returns a JSON response without caching. */
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** @returns the success envelope. */
function ok(value) {
  return jsonResponse(200, { ok: true, value })
}

/**
 * Project one failure into the transport envelope.
 * @param error - thrown value from a route.
 * @returns the failure response with a stable code.
 */
function fail(error, logger) {
  const code = error instanceof TrashError ? error.code : 'internal'
  const status = code === 'invalid-id' || code === 'invalid-entry'
    ? 400
    : code === 'not-found'
      ? 404
      : code === 'live' || code === 'exists' || code === 'conflict' || code === 'unexpected-files'
        ? 409
        : code === 'unmaterialized' || code === 'unsupported-layout' || code === 'corrupt'
          ? 422
          : 500
  if (status >= 500) logger?.warn?.(`session-trash: ${String(error?.stack ?? error)}`)
  return jsonResponse(status, {
    ok: false,
    error: { code, message: error instanceof Error ? error.message : String(error) },
  })
}

/**
 * Read one buffered JSON request body.
 * @param request - the Fetch request.
 * @returns the parsed object, or an empty object.
 */
async function readJsonBody(request) {
  try {
    const value = await request.json()
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    throw new TrashError('invalid-body', 'the request body is not JSON')
  }
}

/** The `session_trash` tool output, declared once for validation and rendering. */
const TOOL_ENTRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    entryId: { type: 'string' },
    sessionId: { type: 'string' },
    title: { type: 'string' },
    cwd: { type: 'string' },
    deletedAt: { type: 'integer' },
    sizeBytes: { type: 'integer' },
    createdAt: { type: 'integer' },
  },
  required: ['entryId', 'sessionId', 'title', 'deletedAt', 'sizeBytes', 'createdAt'],
}
const TOOL_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string' },
    count: { type: 'integer' },
    totalBytes: { type: 'integer' },
    trashRoot: { type: 'string' },
    sessionId: { type: 'string' },
    sessionDir: { type: 'string' },
    entries: { type: 'array', items: TOOL_ENTRY_SCHEMA },
    entry: TOOL_ENTRY_SCHEMA,
  },
  required: ['action'],
}

/** @returns a byte count phrased for a model-facing summary. */
function humanBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/**
 * Run one `session_trash` tool action.
 * @param ctx - Host context.
 * @param args - validated model arguments.
 * @returns the tool's canonical value.
 */
async function runToolAction(ctx, args) {
  switch (args.action) {
    case 'list': {
      const listed = await listTrash(ctx)
      return { action: 'list', ...listed }
    }
    case 'delete': {
      if (typeof args.sessionId !== 'string') throw new TrashError('invalid-id', 'delete needs sessionId')
      const entry = await deleteSession(ctx, { sessionId: args.sessionId, title: args.title })
      return { action: 'delete', entry }
    }
    case 'restore': {
      if (typeof args.entryId !== 'string') throw new TrashError('invalid-entry', 'restore needs entryId')
      const restored = await restoreEntry(ctx, { entryId: args.entryId })
      return { action: 'restore', sessionId: restored.sessionId, sessionDir: restored.sessionDir }
    }
    case 'purge': {
      const purged = await purgeTrash(ctx, { entryId: args.entryId, all: args.all === true })
      return { action: 'purge', count: purged.count }
    }
    default:
      throw new TrashError('invalid-action', `unknown action "${String(args.action)}"`)
  }
}

/**
 * Validate and coerce the `session_trash` arguments.
 * @param args - raw model arguments.
 * @returns the accepted argument object.
 */
function readToolArgs(args) {
  const value = args !== null && typeof args === 'object' ? args : {}
  const action = value.action
  if (action !== 'list' && action !== 'delete' && action !== 'restore' && action !== 'purge') {
    throw new TrashError('invalid-action', 'action must be list, delete, restore, or purge')
  }
  const parsed = { action }
  if (value.sessionId !== undefined && value.sessionId !== '') {
    if (typeof value.sessionId !== 'string') throw new TrashError('invalid-id', 'sessionId must be a string')
    parsed.sessionId = value.sessionId
  }
  if (value.entryId !== undefined && value.entryId !== '') {
    if (typeof value.entryId !== 'string') throw new TrashError('invalid-entry', 'entryId must be a string')
    parsed.entryId = value.entryId
  }
  if (value.title !== undefined) {
    if (typeof value.title !== 'string') throw new TrashError('invalid-title', 'title must be a string')
    parsed.title = value.title
  }
  if (value.all !== undefined) {
    if (typeof value.all !== 'boolean') throw new TrashError('invalid-all', 'all must be a boolean')
    parsed.all = value.all
  }
  return parsed
}

/**
 * Plugin body: register the authenticated trash routes and the mirror tool.
 * @param ctx - Host plugin context.
 */
export function apply(ctx) {
  /**
   * Register one authenticated POST route below `/api`.
   * @param endpoint - endpoint path after `/api`.
   * @param handler - body-handling implementation.
   */
  const route = (endpoint, handler) => {
    ctx.connection.fetch.register({
      path: `/api/session-trash/${endpoint}`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          return ok(await handler(await readJsonBody(request)))
        } catch (error) {
          return fail(error, ctx.logger)
        }
      },
    })
  }

  ctx.connection.fetch.register({
    path: '/api/session-trash/list',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      try {
        return ok(await listTrash(ctx))
      } catch (error) {
        return fail(error, ctx.logger)
      }
    },
  })
  route('delete', async body => deleteSession(ctx, body))
  route('restore', async body => restoreEntry(ctx, body))
  route('purge', async body => purgeTrash(ctx, body))

  ctx.inject(['tools'], (scope) => {
    scope.tools.register({
      name: 'session_trash',
      description: 'Move a stored DeepSeek Harness Session into the local trash, or manage what the trash already holds. '
        + 'Actions: "list" reports trashed Sessions with their original title, deletion time, and size; '
        + '"delete" moves one stored Session (by sessionId) out of the Session store into the trash, so it disappears from the sidebar and can be restored; '
        + '"restore" returns one trashed Session (by entryId) to its original location; '
        + '"purge" permanently deletes one entry (entryId) or every entry (all: true). '
        + 'Deleting is user-visible data loss unless restored: only delete Sessions the user asked to remove. '
        + 'A Session still loaded in this Host process is refused, because its writer would keep appending into the trash; '
        + 'archive it instead, or delete it after the Host restarts.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'delete', 'restore', 'purge'],
            description: 'list | delete | restore | purge',
          },
          sessionId: { type: 'string', description: 'Stored Session id; required by delete.' },
          entryId: { type: 'string', description: 'Trash entry id from a list result; required by restore and single purge.' },
          all: { type: 'boolean', description: 'With purge: delete every trash entry instead of one.' },
          title: { type: 'string', description: 'With delete: the Session title shown in the trash list.' },
        },
        required: ['action'],
      },
      output: {
        schema: TOOL_OUTPUT_SCHEMA,
        render: (_args, value) => {
          if (value.action === 'list') {
            const lines = value.entries.map(entry =>
              `- ${entry.entryId} · ${entry.title === '' ? '(untitled)' : entry.title} · ${humanBytes(entry.sizeBytes)} · deleted ${new Date(entry.deletedAt).toISOString()}`)
            const head = `Trash ${value.trashRoot}: ${value.entries.length} entr${value.entries.length === 1 ? 'y' : 'ies'}, ${humanBytes(value.totalBytes)}.`
            return [{ type: 'text', text: lines.length === 0 ? `${head} The trash is empty.` : `${head}\n${lines.join('\n')}` }]
          }
          if (value.action === 'delete') {
            return [{
              type: 'text',
              text: `Moved session "${value.entry.sessionId}" (${value.entry.title === '' ? 'untitled' : value.entry.title}) to the trash as ${value.entry.entryId} (${humanBytes(value.entry.sizeBytes)}). It can be restored with entryId "${value.entry.entryId}".`,
            }]
          }
          if (value.action === 'restore') {
            return [{ type: 'text', text: `Restored session "${value.sessionId}" to ${value.sessionDir}. Reload the page to see it in the sidebar again.` }]
          }
          return [{ type: 'text', text: value.count === 0 ? 'Nothing was purged (entries were missing or belong to loaded Sessions).' : `Permanently deleted ${value.count} trash entr${value.count === 1 ? 'y' : 'ies'}.` }]
        },
      },
      execute: async (args) => runToolAction(ctx, readToolArgs(args)),
    })
  })
}
