window.__ModuleLoader__.load({
  id: 'dsh-session-trash',
  factory(require) {
    /** Browser half of the Session trash bundle: row-menu action, confirm dialog, toast, and the Trash settings page. */
    const React = require('react')
    const h = React.createElement

    /** Dictionary namespace owned by this plugin. */
    const NS = 'session-trash'
    /** Browser-relative root of the authenticated Host routes. */
    const API_ROOT = 'api/session-trash'

    const ZH = {
      'menu.delete': '删除会话…',
      'dialog.close': '关闭',
      'dialog.cancel': '取消',
      'dialog.busy': '处理中…',
      'dialog.delete.title': '删除会话',
      'dialog.delete.body': '会话「{title}」的全部记录会移入回收站，之后可以在回收站里恢复或彻底删除。',
      'dialog.delete.note': '该会话会立即从侧栏消失。',
      'dialog.delete.confirm': '移入回收站',
      'dialog.purge.confirm': '彻底删除',
      'dialog.empty.confirm': '清空回收站',
      'untitled': '（无标题会话）',
      'toast.deleted': '已移入回收站',
      'toast.purged': '已彻底删除',
      'toast.emptied': '回收站已清空',
      'toast.restored': '已恢复，刷新页面后可重新看到该会话。',
      'toast.refresh': '刷新页面',
      'section.nav': '会话回收站',
      'section.description': '删除的会话保存在这里。可以恢复到原位置，或彻底删除以释放磁盘空间。',
      'section.refresh': '刷新',
      'section.emptyTrash': '清空回收站',
      'section.empty': '回收站是空的。',
      'section.loading': '正在读取…',
      'section.restore': '恢复',
      'section.purge': '彻底删除',
      'section.deletedAt': '删除于 {time}',
      'section.confirmPurge': '确认彻底删除？',
      'section.confirmEmpty': '确认清空这 {count} 个会话？',
      'section.total': '共 {count} 个会话，{size}',
      'section.path': '回收站位置：{path}',
      'error.live': '该会话仍被当前进程加载着（本进程内打开过），无法安全删除。请重启 DSH Web 后再删除，或改用归档。',
      'error.not-found': '找不到该会话的存储记录。',
      'error.unmaterialized': '该会话还没有写入磁盘，无需删除。',
      'error.unsupported-layout': '该会话的存储不是按会话目录布局，已跳过。',
      'error.unexpected-files': '该会话目录里还有非会话文件，为避免误删已跳过。',
      'error.conflict': '目标位置已有内容，已停止。',
      'error.exists': '原位置已存在同名内容，已停止。',
      'error.corrupt': '回收站条目已损坏。',
      'error.io': '读写会话存储失败：{message}',
      'error.network': '与后台通信失败。',
      'error.unknown': '操作失败：{message}',
    }

    const EN = {
      'menu.delete': 'Delete session…',
      'dialog.close': 'Close',
      'dialog.cancel': 'Cancel',
      'dialog.busy': 'Working…',
      'dialog.delete.title': 'Delete session',
      'dialog.delete.body': 'Every record of “{title}” moves to the trash. You can restore it there or delete it permanently later.',
      'dialog.delete.note': 'The session disappears from the sidebar immediately.',
      'dialog.delete.confirm': 'Move to trash',
      'dialog.purge.confirm': 'Delete permanently',
      'dialog.empty.confirm': 'Empty trash',
      'untitled': '(untitled session)',
      'toast.deleted': 'Moved to the trash',
      'toast.purged': 'Deleted permanently',
      'toast.emptied': 'Trash emptied',
      'toast.restored': 'Restored. Reload the page to see the session again.',
      'toast.refresh': 'Reload page',
      'section.nav': 'Session trash',
      'section.description': 'Deleted sessions wait here. Restore one to its original place, or delete it permanently to reclaim disk space.',
      'section.refresh': 'Refresh',
      'section.emptyTrash': 'Empty trash',
      'section.empty': 'The trash is empty.',
      'section.loading': 'Reading…',
      'section.restore': 'Restore',
      'section.purge': 'Delete permanently',
      'section.deletedAt': 'Deleted {time}',
      'section.confirmPurge': 'Delete it permanently?',
      'section.confirmEmpty': 'Empty these {count} session(s)?',
      'section.total': '{count} session(s), {size}',
      'section.path': 'Trash location: {path}',
      'error.live': 'This session is still loaded in the running Host (it was opened in this process), so deleting it would leave its writer appending into the trash. Restart DSH Web and delete it again, or archive it instead.',
      'error.not-found': 'No stored record for this session.',
      'error.unmaterialized': 'This session never reached the disk, so there is nothing to delete.',
      'error.unsupported-layout': 'This session is not stored in a per-session directory; it was skipped.',
      'error.unexpected-files': 'The session directory holds non-session files, so it was skipped to avoid deleting them.',
      'error.conflict': 'The target location already holds content, so nothing changed.',
      'error.exists': 'The original location is occupied; refusing to overwrite it.',
      'error.corrupt': 'This trash entry is damaged.',
      'error.io': 'Reading or writing session storage failed: {message}',
      'error.network': 'The request to the Host failed.',
      'error.unknown': 'The operation failed: {message}',
    }

    const LABEL = {
      zh: '会话回收站',
      en: 'Session trash',
    }

    /** Neutral surface tokens shared by every control below. */
    const STYLE = {
      card: {
        border: '0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l1, rgba(127,127,127,0.28)))',
        borderRadius: 'var(--dsw-radius-xl, 12px)',
        background: 'var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1, transparent))',
        padding: '12px 16px',
      },
      button: {
        font: 'inherit',
        fontSize: '13px',
        lineHeight: '22px',
        padding: '2px 10px',
        borderRadius: '8px',
        border: '0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.4))',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary, currentColor)',
        cursor: 'pointer',
      },
      buttonHover: {
        background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.12))',
      },
      danger: {
        color: 'var(--dsw-alias-state-error-primary, #c0392b)',
        borderColor: 'var(--dsw-alias-state-error-primary, #c0392b)',
      },
      secondary: {
        color: 'var(--dsw-alias-label-secondary, #6b7280)',
        fontSize: '12px',
        lineHeight: '18px',
      },
      title: {
        fontSize: '14px',
        lineHeight: '22px',
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary, currentColor)',
        overflowWrap: 'anywhere',
      },
    }

    /**
     * Create one tiny observable store; components read it with useStore.
     * @param initial - starting value.
     * @returns a snapshot store.
     */
    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        set(next) {
          if (next === value) return
          value = next
          for (const listener of [...listeners]) listener()
        },
      }
    }

    /** @param store - snapshot store. @returns its current value, re-rendering on change. */
    function useStore(store) {
      return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
    }

    /** @returns a compact byte size. */
    function formatBytes(bytes) {
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

    /** @returns a localized date-time label, or an empty string for a missing stamp. */
    function formatTime(timestamp) {
      if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
      try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
      } catch {
        return new Date(timestamp).toISOString()
      }
    }

    /**
     * Call one trash endpoint.
     * @param endpoint - endpoint name after the shared root.
     * @param body - optional JSON body; omitted for GET.
     * @returns the envelope's value.
     * @throws {Error & { code?: string, serverMessage?: string }} on refusal or transport failure.
     */
    async function callApi(endpoint, body) {
      const url = `${API_ROOT}/${endpoint}`
      let response
      try {
        response = await fetch(url, body === undefined
          ? { credentials: 'same-origin', headers: { accept: 'application/json' } }
          : {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify(body),
            })
      } catch (error) {
        const failure = new Error(`request failed: ${String(error?.message ?? error)}`)
        failure.code = 'network'
        throw failure
      }
      let payload
      try {
        payload = await response.json()
      } catch {
        const failure = new Error(`host answered ${response.status}`)
        failure.code = 'network'
        throw failure
      }
      if (payload?.ok === true) return payload.value
      const failure = new Error(typeof payload?.error?.message === 'string' ? payload.error.message : `host answered ${response.status}`)
      failure.code = typeof payload?.error?.code === 'string' ? payload.error.code : 'unknown'
      failure.serverMessage = failure.message
      throw failure
    }

    /**
     * Localize one refusal.
     * @param error - thrown failure.
     * @param t - namespace translate seat.
     * @returns the user-facing message.
     */
    function localizeError(error, t) {
      const code = typeof error?.code === 'string' ? error.code : 'unknown'
      const key = `error.${code}`
      const message = typeof error?.serverMessage === 'string' ? error.serverMessage : String(error?.message ?? error)
      const translated = t(key, { message })
      if (translated !== key) return translated
      return t('error.unknown', { message })
    }

    /** Small trash glyph shared by the menu row and the dialog. */
    function TrashIcon({ size = 14, color }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true,
        style: { flex: 'none', display: 'block', color: color ?? 'currentColor' },
      },
      h('path', {
        fill: 'currentColor',
        d: 'M6.2 1.6h3.6l.5 1.1h2.9a.7.7 0 0 1 0 1.4h-.5l-.7 9.2a1.4 1.4 0 0 1-1.4 1.3H4.4A1.4 1.4 0 0 1 3 13.3L2.3 4.1h-.5a.7.7 0 0 1 0-1.4h2.9zm-2.5 2.5.7 9.2a.2.2 0 0 0 .2.2h6.8a.2.2 0 0 0 .2-.2l.7-9.2zM6.4 6.2c.4 0 .7.3.7.7v4a.7.7 0 1 1-1.4 0v-4c0-.4.3-.7.7-.7m3.2 0c.4 0 .7.3.7.7v4a.7.7 0 1 1-1.4 0v-4c0-.4.3-.7.7-.7',
      }))
    }

    /** One button with hover feedback; `tone: 'danger'` carries the error token. */
    function ActionButton({ label, onClick, tone, disabled, autofocus }) {
      const [hover, setHover] = React.useState(false)
      return h('button', {
        type: 'button',
        disabled: disabled === true,
        autoFocus: autofocus === true,
        onClick,
        onMouseEnter: () => { setHover(true) },
        onMouseLeave: () => { setHover(false) },
        style: {
          ...STYLE.button,
          ...tone === 'danger' ? STYLE.danger : {},
          ...hover && disabled !== true ? STYLE.buttonHover : {},
          ...disabled === true ? { opacity: 0.55, cursor: 'default' } : {},
        },
      }, label)
    }

    return {
      inject: ['slots', 'locale'],
      /**
       * Register the dictionaries, the row-menu action, the overlay dialog and
       * toast, and the Trash settings page.
       * @param ctx - Client plugin context.
       */
      apply(ctx) {
        for (const [locale, dict] of [['zh', ZH], ['en', EN]]) {
          ctx.effect(() => ctx.locale.register(NS, locale, dict), `session-trash: ${locale} dictionary`)
        }

        const dialog = createStore(null)
        const toast = createStore(null)

        /** @param text - toast body. */
        function pushToast(text) {
          toast.set({ id: `${Date.now()}-${Math.random()}`, text })
        }
        /** @param request - dialog request, or null to close. */
        function openDialog(request) {
          dialog.set(request)
        }
        function closeDialog() {
          dialog.set(null)
        }

        /** The row-menu entry that starts one confirmed delete. */
        function DeleteMenuItem({ sessionId, displayTitle, useMenuOpenState, t }) {
          const hoverStore = React.useMemo(() => createStore(false), [])
          const hover = useStore(hoverStore)
          const [, setMenuOpen] = useMenuOpenState()
          return h('button', {
            type: 'button',
            role: 'menuitem',
            onMouseEnter: () => { hoverStore.set(true) },
            onMouseLeave: () => { hoverStore.set(false) },
            onClick: () => {
              setMenuOpen(false)
              openDialog({ kind: 'delete', sessionId, title: displayTitle, onDone: undefined })
            },
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              padding: '6px 8px',
              border: 0,
              borderRadius: '6px',
              background: hover ? 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.12))' : 'transparent',
              color: 'var(--dsw-alias-state-error-primary, #c0392b)',
              font: 'inherit',
              fontSize: '13px',
              lineHeight: '22px',
              textAlign: 'left',
              cursor: 'pointer',
            },
          }, h(TrashIcon), h('span', null, t('menu.delete')))
        }

        /** The frame-wide confirmation surface for the sidebar action; it outlives the menu that opened it. */
        function DialogHost({ t }) {
          const request = useStore(dialog)
          if (request === null || request.kind !== 'delete') return null
          return h(DeleteDialog, { key: request.sessionId, request, t })
        }

        /** One delete confirmation with its own busy and failure state. */
        function DeleteDialog({ request, t }) {
          const [busy, setBusy] = React.useState(false)
          const [failure, setFailure] = React.useState(null)
          React.useEffect(() => {
            const onKeyDown = (event) => {
              if (event.key === 'Escape' && !busy) {
                event.stopPropagation()
                closeDialog()
              }
            }
            window.addEventListener('keydown', onKeyDown, true)
            return () => { window.removeEventListener('keydown', onKeyDown, true) }
          }, [busy])
          const run = async () => {
            if (busy) return
            setBusy(true)
            setFailure(null)
            try {
              await callApi('delete', { sessionId: request.sessionId, title: request.title })
              closeDialog()
              pushToast(t('toast.deleted'))
            } catch (error) {
              setFailure(localizeError(error, t))
            } finally {
              setBusy(false)
            }
          }
          return h('div', {
            role: 'presentation',
            onMouseDown: (event) => { if (event.target === event.currentTarget && !busy) closeDialog() },
            style: {
              position: 'fixed',
              inset: '0',
              zIndex: 1200,
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              background: 'rgba(15, 18, 22, 0.32)',
            },
          }, h('div', {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('dialog.delete.title'),
            style: {
              boxSizing: 'border-box',
              width: 'min(420px, 100%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '18px 20px',
              borderRadius: '14px',
              border: '0.5px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.28))',
              background: 'var(--dsw-alias-bg-overlay, #ffffff)',
              color: 'var(--dsw-alias-label-primary, currentColor)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
              fontSize: '13px',
              lineHeight: '21px',
            },
          },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 } },
            h(TrashIcon, { size: 16, color: 'var(--dsw-alias-state-error-primary, #c0392b)' }),
            h('span', null, t('dialog.delete.title'))),
          h('p', { style: { margin: 0 } }, t('dialog.delete.body', { title: request.title === '' ? t('untitled') : request.title })),
          h('p', { style: { ...STYLE.secondary, margin: 0 } }, t('dialog.delete.note')),
          failure === null
            ? null
            : h('p', {
                role: 'alert',
                style: {
                  margin: 0,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.12))',
                  color: 'var(--dsw-alias-state-error-primary, #c0392b)',
                },
              }, failure),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' } },
            h(ActionButton, { label: t('dialog.cancel'), onClick: () => { if (!busy) closeDialog() }, disabled: busy, autofocus: true }),
            h(ActionButton, { label: busy ? t('dialog.busy') : t('dialog.delete.confirm'), onClick: () => { void run() }, tone: 'danger', disabled: busy }))))
        }


        /** One transient notice for the sidebar flow; the Settings page keeps its own inline notice. */
        function ToastHost() {
          const notice = useStore(toast)
          React.useEffect(() => {
            if (notice === null) return undefined
            const timer = setTimeout(() => {
              if (toast.getSnapshot()?.id === notice.id) toast.set(null)
            }, 3200)
            return () => { clearTimeout(timer) }
          }, [notice])
          if (notice === null) return null
          return h('div', {
            role: 'status',
            style: {
              position: 'fixed',
              left: '50%',
              bottom: '28px',
              transform: 'translateX(-50%)',
              zIndex: 1300,
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: 'min(560px, calc(100vw - 48px))',
              padding: '9px 14px',
              borderRadius: '10px',
              border: '0.5px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.28))',
              background: 'var(--dsw-alias-bg-overlay, #ffffff)',
              color: 'var(--dsw-alias-label-primary, currentColor)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
              fontSize: '13px',
              lineHeight: '20px',
            },
          }, h('span', null, notice.text))
        }

        /**
         * The Settings › Trash page. The settings panel is its own modal above the
         * frame overlay layer, so confirmations and notices stay inline here rather
         * than in `shell.overlay`.
         */
        function TrashSection({ t }) {
          const [state, setState] = React.useState({
            phase: 'loading',
            entries: [],
            totalBytes: 0,
            trashRoot: '',
            failure: null,
            notice: null,
            confirm: null,
          })
          const load = React.useCallback(async () => {
            setState(previous => ({ ...previous, phase: 'loading' }))
            try {
              const value = await callApi('list')
              setState(previous => ({
                ...previous,
                phase: 'ready',
                entries: value.entries,
                totalBytes: value.totalBytes,
                trashRoot: value.trashRoot,
                failure: null,
              }))
            } catch (error) {
              setState(previous => ({ ...previous, phase: 'error', failure: localizeError(error, t) }))
            }
          }, [t])
          React.useEffect(() => { void load() }, [load])
          const notify = (notice) => {
            setState(previous => ({ ...previous, notice, confirm: null }))
          }
          const runPurge = async (entryId) => {
            try {
              await callApi('purge', { entryId })
              notify({ text: t('toast.purged') })
            } catch (error) {
              notify({ text: localizeError(error, t), error: true })
            }
            await load()
          }
          const runEmpty = async () => {
            try {
              await callApi('purge', { all: true })
              notify({ text: t('toast.emptied') })
            } catch (error) {
              notify({ text: localizeError(error, t), error: true })
            }
            await load()
          }
          const runRestore = async (entry) => {
            try {
              await callApi('restore', { entryId: entry.entryId })
              notify({ text: t('toast.restored'), action: { label: t('toast.refresh'), run: () => { window.location.reload() } } })
            } catch (error) {
              notify({ text: localizeError(error, t), error: true })
            }
            await load()
          }
          const rows = state.entries.map(entry => {
            const confirming = state.confirm !== null && state.confirm.kind === 'purge' && state.confirm.entryId === entry.entryId
            return h('div', {
              key: entry.entryId,
              style: { ...STYLE.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
            },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: '1 1 240px' } },
              h('span', { style: STYLE.title }, entry.title === '' ? t('untitled') : entry.title),
              h('span', { style: STYLE.secondary }, `${t('section.deletedAt', { time: formatTime(entry.deletedAt) })} · ${formatBytes(entry.sizeBytes)}`),
              entry.cwd === undefined ? null : h('span', { style: { ...STYLE.secondary, overflowWrap: 'anywhere' } }, entry.cwd)),
            confirming
              ? h('div', { style: { display: 'flex', flex: 'none', alignItems: 'center', gap: '8px' } },
                  h('span', { style: STYLE.secondary }, t('section.confirmPurge')),
                  h(ActionButton, { label: t('dialog.cancel'), onClick: () => { setState(previous => ({ ...previous, confirm: null })) } }),
                  h(ActionButton, { label: t('dialog.purge.confirm'), tone: 'danger', onClick: () => { void runPurge(entry.entryId) } }))
              : h('div', { style: { display: 'flex', flex: 'none', gap: '8px' } },
                  h(ActionButton, { label: t('section.restore'), onClick: () => { void runRestore(entry) } }),
                  h(ActionButton, {
                    label: t('section.purge'),
                    tone: 'danger',
                    onClick: () => { setState(previous => ({ ...previous, confirm: { kind: 'purge', entryId: entry.entryId } })) },
                  })))
          })
          const emptyConfirming = state.confirm !== null && state.confirm.kind === 'empty'
          return h('section', {
            'aria-label': t('section.nav'),
            style: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0', fontSize: '13px', lineHeight: '22px' },
          },
          h('p', { style: { ...STYLE.secondary, margin: 0, maxWidth: '58ch' } }, t('section.description')),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            h(ActionButton, { label: t('section.refresh'), onClick: () => { void load() }, disabled: state.phase === 'loading' }),
            emptyConfirming
              ? h('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                  h('span', { style: STYLE.secondary }, t('section.confirmEmpty', { count: state.entries.length })),
                  h(ActionButton, { label: t('dialog.cancel'), onClick: () => { setState(previous => ({ ...previous, confirm: null })) } }),
                  h(ActionButton, { label: t('dialog.empty.confirm'), tone: 'danger', onClick: () => { void runEmpty() } }))
              : h(ActionButton, {
                  label: t('section.emptyTrash'),
                  tone: 'danger',
                  disabled: state.phase !== 'ready' || state.entries.length === 0,
                  onClick: () => { setState(previous => ({ ...previous, confirm: { kind: 'empty' } })) },
                })),
          state.notice === null
            ? null
            : h('div', {
                role: 'status',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l1, rgba(127,127,127,0.28)))',
                  color: state.notice.error === true
                    ? 'var(--dsw-alias-state-error-primary, #c0392b)'
                    : 'var(--dsw-alias-label-primary, currentColor)',
                },
              },
              h('span', null, state.notice.text),
              state.notice.action === undefined
                ? null
                : h(ActionButton, { label: state.notice.action.label, onClick: state.notice.action.run }),
              h(ActionButton, { label: t('dialog.close'), onClick: () => { setState(previous => ({ ...previous, notice: null })) } })),
          state.failure === null ? null : h('p', { role: 'alert', style: { ...STYLE.secondary, color: 'var(--dsw-alias-state-error-primary, #c0392b)', margin: 0 } }, state.failure),
          state.phase === 'loading' && state.entries.length === 0
            ? h('p', { style: { ...STYLE.secondary, margin: 0 } }, t('section.loading'))
            : state.entries.length === 0
              ? h('p', { style: { ...STYLE.secondary, margin: 0 } }, t('section.empty'))
              : rows,
          state.entries.length === 0
            ? null
            : h('p', { style: { ...STYLE.secondary, margin: 0 } }, t('section.total', { count: state.entries.length, size: formatBytes(state.totalBytes) })),
          state.trashRoot === ''
            ? null
            : h('p', { style: { ...STYLE.secondary, margin: 0, overflowWrap: 'anywhere' } }, t('section.path', { path: state.trashRoot })))
        }

        ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
          name: 'sidebar.workspaces.session.menu.item',
          id: 'session-trash.delete',
          order: 550,
          locale: NS,
        }, DeleteMenuItem))

        ctx.slots.inject('shell.overlay', () => [
          ctx.slots.register({ name: 'shell.overlay', id: 'session-trash.dialog', order: 500, locale: NS }, DialogHost),
          ctx.slots.register({ name: 'shell.overlay', id: 'session-trash.toast', order: 900, locale: NS }, ToastHost),
        ])

        /** The settings navigation glyph for this section (the id must equal the section id). */
        function TrashNavIcon({ size, active }) {
          return h(TrashIcon, {
            size: size ?? 16,
            color: active ? 'var(--dsw-alias-label-primary, currentColor)' : 'var(--dsw-alias-label-secondary, currentColor)',
          })
        }

        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'session-trash',
        }, TrashNavIcon))

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'session-trash',
          order: 800,
          // A thunk is re-read on every projection, so the nav label follows the active locale.
          label: () => {
            const active = ctx.locale.getSnapshot().active
            return typeof active === 'string' && active.toLowerCase().startsWith('zh') ? LABEL.zh : LABEL.en
          },
          locale: NS,
        }, TrashSection))
      },
    }
  },
})
