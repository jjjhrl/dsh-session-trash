#!/usr/bin/env node
/**
 * Repository checks: syntax of both plugin halves, the bundle manifest, locale
 * metadata, the loader patch, and client dictionary parity. No dependencies and
 * no filesystem writes, so CI and contributors run the same command.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const failures = []

/**
 * Record one failed expectation.
 * @param {string} message
 */
function fail(message) {
  failures.push(message)
}

/**
 * Run one expectation, reporting a thrown error as a failure.
 * @param {string} label
 * @param {() => void} run
 */
function check(label, run) {
  try {
    run()
  } catch (error) {
    fail(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** @param {string} relativePath */
function read(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) throw new Error(`${relativePath} is missing`)
  return readFileSync(path, 'utf8')
}

/** @param {string} relativePath */
function readJson(relativePath) {
  try {
    return JSON.parse(read(relativePath))
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

check('index.js parses as an ES module', () => {
  execFileSync(process.execPath, ['--check', join(ROOT, 'index.js')], { stdio: 'pipe' })
})

check('client.js parses', () => {
  execFileSync(process.execPath, ['--check', join(ROOT, 'client.js')], { stdio: 'pipe' })
})

const manifest = (() => {
  try {
    return readJson('package.json')
  } catch (error) {
    fail(String(error instanceof Error ? error.message : error))
    return {}
  }
})()

check('package.json', () => {
  if (manifest.name !== 'dsh-session-trash') throw new Error(`unexpected package name ${JSON.stringify(manifest.name)}`)
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version ?? '')) throw new Error(`version ${JSON.stringify(manifest.version)} is not semver`)
  if (manifest.type !== 'module') throw new Error('type must be "module"')
  if (manifest.private === true) throw new Error('an installable plugin must not be private')
  if (manifest.license !== 'MIT' || !existsSync(join(ROOT, 'LICENSE'))) throw new Error('MIT license and LICENSE file are required')
  for (const [field, expected] of [['repository', 'git+https://github.com/jjjhrl/dsh-session-trash.git'], ['homepage', 'https://github.com/jjjhrl/dsh-session-trash#readme']]) {
    const value = typeof manifest[field] === 'object' ? manifest[field]?.url : manifest[field]
    if (value !== expected) throw new Error(`${field} must be ${expected}`)
  }
  if (typeof manifest.description !== 'string' || manifest.description.length < 20) throw new Error('description is required')
  if (!/^>=0\.\d+\.\d+/.test(manifest.engines?.dsh ?? '')) throw new Error('engines.dsh must declare a minimum DSH release')
  if (!/^>=\d+/.test(manifest.engines?.node ?? '')) throw new Error('engines.node must declare a minimum Node release')
})

check('bundle exports', () => {
  if (manifest.exports?.['.'] !== './index.js') throw new Error('exports["."] must be ./index.js')
  if (manifest.exports?.['./client'] !== './client.js') throw new Error('exports["./client"] must be ./client.js')
  if (manifest.exports?.['./icon'] !== './icon.svg') throw new Error('exports["./icon"] must be ./icon.svg')
  if (manifest.exports?.['./locale/*.json'] === undefined) throw new Error('locale JSON must be exported')
})

check('bundle patch', () => {
  const patchPath = manifest.dsh?.bundle?.patch
  if (typeof patchPath !== 'string') throw new Error('dsh.bundle.patch is required')
  const patch = read(patchPath.replace(/^\.\//, ''))
  if (!/^- insert:/m.test(patch)) throw new Error(`${patchPath} must insert the plugin row`)
  if (!patch.includes(`name: ${manifest.name}`)) throw new Error(`${patchPath} must reference ${manifest.name}`)
})

check('client half declaration', () => {
  if (manifest.dsh?.client?.platform !== 'web') throw new Error('dsh.client.platform must be "web"')
  if (!existsSync(join(ROOT, 'client.js'))) throw new Error('client.js is missing')
})

check('packaged files exist', () => {
  const required = ['index.js', 'client.js', 'cordis.patch.yml', 'README.md', 'LICENSE', 'icon.svg', 'locale/en.json', 'locale/zh.json']
  const files = Array.isArray(manifest.files) ? manifest.files : []
  for (const file of required) {
    if (!existsSync(join(ROOT, file))) throw new Error(`${file} is missing`)
    if (!files.some(entry => entry === file || (entry.endsWith('/*.json') && file.startsWith(entry.slice(0, -'*.json'.length)))))
      throw new Error(`${file} is not covered by the manifest "files" list`)
  }
})

check('icon', () => {
  const icon = read('icon.svg')
  if (!/^<svg[\s>]/i.test(icon.trim())) throw new Error('icon.svg must start with an <svg> element')
  if (!/viewBox="0 0 \d+ \d+"/.test(icon)) throw new Error('icon.svg needs a viewBox')
  for (const forbidden of ['<script', 'onload=', '<foreignObject', '<image']) {
    if (icon.includes(forbidden)) throw new Error(`icon.svg must stay self-contained (found ${forbidden})`)
  }
})

check('locale metadata', () => {
  const english = readJson('locale/en.json')
  const chinese = readJson('locale/zh.json')
  for (const [file, data] of [['locale/en.json', english], ['locale/zh.json', chinese]]) {
    if (typeof data.meta?.title !== 'string' || data.meta.title.length === 0) throw new Error(`${file} needs meta.title`)
    if (typeof data.meta?.description !== 'string' || data.meta.description.length < 20) throw new Error(`${file} needs meta.description`)
    if (data.meta.detail !== undefined && !existsSync(join(ROOT, data.meta.detail))) throw new Error(`${file} points meta.detail at a missing document`)
  }
})

check('client dictionaries', () => {
  const client = read('client.js')
  const zh = /const ZH = \{([\s\S]*?)\n {4}\}/.exec(client)?.[1]
  const en = /const EN = \{([\s\S]*?)\n {4}\}/.exec(client)?.[1]
  if (zh === undefined || en === undefined) throw new Error('client.js must declare ZH and EN dictionaries')
  const keys = (body) => new Set([...body.matchAll(/^\s*'([A-Za-z0-9._-]+)':/gm)].map(match => match[1]))
  const zhKeys = keys(zh)
  const enKeys = keys(en)
  if (zhKeys.size < 20) throw new Error('the Chinese dictionary looks empty')
  const missing = [...zhKeys].filter(key => !enKeys.has(key))
  const extra = [...enKeys].filter(key => !zhKeys.has(key))
  if (missing.length > 0) throw new Error(`English dictionary is missing: ${missing.join(', ')}`)
  if (extra.length > 0) throw new Error(`English dictionary has unknown keys: ${extra.join(', ')}`)
  const used = new Set([...client.matchAll(/\bt\('([A-Za-z0-9._-]+)'/g)].map(match => match[1]))
  const missingKeys = [...used].filter(key => !zhKeys.has(key) && !key.includes('.'))
  if (missingKeys.length > 0) throw new Error(`client.js uses undefined dictionary keys: ${missingKeys.join(', ')}`)
})

check('screenshots', () => {
  for (const image of ['docs/images/session-menu.jpg', 'docs/images/session-trash-settings.jpg']) {
    const size = statSync(join(ROOT, image)).size
    if (size < 2_000) throw new Error(`${image} looks empty`)
    if (size > 400_000) throw new Error(`${image} is too large for a README image`)
  }
})

const listing = readdirSync(ROOT).filter(name => name.endsWith('.md')).sort()
if (listing.length === 0) fail('no Markdown documents found')

if (failures.length > 0) {
  console.error(`dsh-session-trash: ${failures.length} check(s) failed`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`dsh-session-trash: all checks passed (${relative(process.cwd(), ROOT) || '.'})`)
