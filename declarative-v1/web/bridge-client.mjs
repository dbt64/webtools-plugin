import { ERROR_CODES, validateRequestInput } from './protocol.mjs'
import { validateCapabilityRequest, validateCapabilityResult } from './capability-methods.mjs'

function safeError(code) {
  const error = new Error(code === 'CANCELLED' ? 'WebTools call cancelled' : 'WebTools bridge unavailable')
  error.name = 'WebToolsError'
  error.code = ERROR_CODES.includes(code) ? code : 'INTERNAL_ERROR'
  error.retryable = false
  return error
}

function encodeBytes(value) {
  let bytes
  if (value instanceof Uint8Array) bytes = value
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value)
  else throw new TypeError('Expected Uint8Array or ArrayBuffer')
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  return btoa(binary)
}

function decodeBytes(value) {
  if (value === null) return null
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let offset = 0; offset < binary.length; offset += 0x8000) {
    const end = Math.min(offset + 0x8000, binary.length)
    for (let index = offset; index < end; index++) bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

// Internal transport seam, deliberately absent from package exports/public client.
export function createBridgeConnection(facade) {
  const available = facade && typeof facade.getReady === 'function' && typeof facade.submit === 'function' && typeof facade.onClose === 'function'
  const listeners = new Set()
  const eventListeners = new Map()
  const pending = new Set()
  const lifecycleState = new Map()
  let lifecycleSubscription
  function enableLifecycle() {
    lifecycleSubscription ??= capability('lifecycle.subscribe', null).then(() => undefined)
    lifecycleSubscription.catch(() => {})
    return lifecycleSubscription
  }
  let closed = false
  let unsubscribe = () => {}
  let unsubscribeHostEvents = () => {}
  let taskEventsAvailable = false
  function dispose() {
    if (closed) return
    closed = true
    unsubscribe()
    unsubscribeHostEvents()
    for (const cancel of [...pending]) cancel('RUNTIME_CLOSED')
    for (const listener of [...listeners]) { try { listener() } catch { /* Keep SDK cleanup independent of Plugin callback errors. */ } }
    listeners.clear()
    eventListeners.clear()
    lifecycleState.clear()
  }
  if (available) unsubscribe = facade.onClose(dispose)
  if (available && typeof facade.onEvent === 'function') {
    const removeInput = facade.onEvent('subInput.change', payload => {
      if (payload && typeof payload === 'object' && typeof payload.value === 'string' && Number.isSafeInteger(payload.revision)) dispatchEvent('subInput.change', payload.value, payload.revision)
    })
    const removeSelection = facade.onEvent('search.result-selected', payload => {
      if (payload && typeof payload === 'object' && typeof payload.id === 'string' && typeof payload.query === 'string' && Number.isSafeInteger(payload.revision) && payload.item && typeof payload.item === 'object') {
        dispatchEvent('search.result-selected', Object.freeze({ id: payload.id, query: payload.query, revision: payload.revision, item: Object.freeze({ ...payload.item }) }))
      }
    })
    let removeTasks = () => {}
    try { removeTasks = facade.onEvent('tasks.trigger', payload => {
      const listener = [...(eventListeners.get('tasks.trigger') ?? [])][0]
      Promise.resolve().then(() => { if (!listener) throw new Error('No task callback registered'); return listener(Object.freeze({ ...payload })) })
        .then(() => capability('tasks.complete', { executionId: payload.executionId, error: null }),
          error => capability('tasks.complete', { executionId: payload.executionId, error: String(error?.message ?? error).slice(0, 1024) }))
        .catch(() => {})
    }); taskEventsAvailable = true } catch { /* Pre-P5 preload allowlists reject this optional event. */ }
    let removeContext = () => {}
    try { removeContext = facade.onEvent('context.changed', () => dispatchEvent('context.changed')) } catch { /* Older hosts do not expose this event. */ }
    let removeLifecycle = () => {}
    try { removeLifecycle = facade.onEvent('lifecycle.changed', payload => {
      if (!payload || !['enter', 'show', 'hide'].includes(payload.phase)) return
      const event = Object.freeze({ ...payload })
      lifecycleState.set(event.phase === 'enter' ? 'enter' : 'visibility', event)
      dispatchEvent(`lifecycle.${event.phase}`, event)
    }) } catch { /* Older hosts have no lifecycle event stream. */ }
    let removeWindowMessage = () => {}
    let removeWindowClosed = () => {}
    if (facade.capabilityNamespaces?.includes('windows')) {
      removeWindowMessage = facade.onEvent('window.message', payload => dispatchEvent('window.message', payload))
      removeWindowClosed = facade.onEvent('window.closed', payload => dispatchEvent('window.closed', payload.id))
    }
    unsubscribeHostEvents = () => { removeTasks(); removeInput(); removeSelection(); removeContext(); removeLifecycle(); removeWindowMessage(); removeWindowClosed() }
  }
  const ready = Promise.resolve().then(async () => {
    if (!available) throw safeError('NOT_AVAILABLE')
    const outcome = await facade.getReady()
    if (outcome?.accepted !== true) throw safeError(outcome?.error?.code ?? 'NOT_AVAILABLE')
    if (closed) throw safeError('RUNTIME_CLOSED')
  }).catch(error => { throw safeError(error?.code ?? 'NOT_AVAILABLE') })
  ready.catch(() => {}) // Connection may be created before the caller awaits ready.
  const namespaces = Array.isArray(facade?.capabilityNamespaces) ? facade.capabilityNamespaces : []
  async function capability(method, payload, options) {
    if (method.startsWith('tasks.') && !taskEventsAvailable) throw safeError('NOT_AVAILABLE')
    try { validateCapabilityRequest(method, payload) } catch (error) { throw safeError(error.code ?? 'INVALID_REQUEST') }
    const result = await request(method, payload, options)
    try { validateCapabilityResult(method, result) } catch { throw safeError('INTERNAL_ERROR') }
    if (method === 'context.current') return result === null ? null : Object.freeze({ ...result })
    return ['system.pasteText', 'system.notify', 'clipboard.writeImage', 'clipboard.writeFiles', 'files.openPath', 'config.set', 'storage.set', 'storage.delete', 'storage.files.write', 'storage.files.delete', 'storage.backup.import', 'clipboard.write', 'subInput.show', 'subInput.hide', 'subInput.setText', 'subInput.focus', 'subInput.releaseFocus', 'search.results.update', 'search.results.clear'].includes(method) ? undefined : result
  }
  const publicClient = Object.freeze({ ready,
    tasks: Object.freeze({
      request: (input, options) => capability('tasks.request', input, options),
      list: options => capability('tasks.list', null, options),
      remove: (code, options) => capability('tasks.remove', { code }, options),
      onTrigger(listener) {
        if (!taskEventsAvailable) throw safeError('NOT_AVAILABLE')
        if (eventListeners.get('tasks.trigger')?.size) throw new TypeError('Only one task callback may be registered')
        const off = subscribe('tasks.trigger', listener)
        ready.then(() => capability('tasks.subscribe', null)).catch(() => {})
        return off
      },
    }),
    lifecycle: Object.freeze({
      get ready() { return enableLifecycle() },
      onInitialize(listener) {
        if (typeof listener !== 'function') throw new TypeError('Invalid lifecycle listener')
        let active = true
        ready.then(() => { if (active && !closed) { try { listener() } catch {} } }, () => {})
        return () => { active = false }
      },
      onEnter: listener => subscribeLifecycle('enter', listener),
      onShow: listener => subscribeLifecycle('show', listener),
      onHide: listener => subscribeLifecycle('hide', listener),
      onClose: listener => publicClient.onClose(listener),
    }),
    context: Object.freeze({ current: options => capability('context.current', null, options), onChange: listener => subscribe('context.changed', listener) }),
    shortcuts: Object.freeze({ current: options => capability('shortcuts.current', null, options) }),
    config: Object.freeze({ get: options => capability('config.get', null, options),
      set: (key, value, options) => capability('config.set', { key, value }, options) }),
    storage: Object.freeze({ list: (prefix = '', options) => capability('storage.list', { prefix }, options), get: (key, options) => capability('storage.get', { key }, options),
      set: (key, value, options) => capability('storage.set', { key, value }, options),
      delete: (key, options) => capability('storage.delete', { key }, options),
      files: Object.freeze({
        list: (prefix = '', options) => capability('storage.files.list', { prefix }, options),
        read: async (path, options) => decodeBytes(await capability('storage.files.read', { path }, options)),
        write: (path, data, options) => capability('storage.files.write', { path, data: encodeBytes(data) }, options),
        delete: (path, options) => capability('storage.files.delete', { path }, options),
      }),
      backup: Object.freeze({
        export: options => capability('storage.backup.export', null, options),
        import: (value, options) => capability('storage.backup.import', { backup: value }, options),
      }),
    }),
    ...(namespaces.includes('ai') ? { ai: Object.freeze({ complete: (input, options) => capability('ai.complete', input, options) }) } : {}),
    ...(namespaces.includes('clipboard') ? { clipboard: Object.freeze({ readText: options => capability('clipboard.readText', null, options), writeText: (text, options) => capability('clipboard.write', { text }, options), readImage: options => capability('clipboard.readImage', null, options), writeImage: (dataUrl, options) => capability('clipboard.writeImage', { dataUrl }, options), readFiles: options => capability('clipboard.readFiles', null, options), writeFiles: (paths, options) => capability('clipboard.writeFiles', { paths }, options) }) } : {}),
    ...(namespaces.includes('system') ? { system: Object.freeze({ media: Object.freeze({ transcode: (input, options) => capability('system.mediaTranscode', input, options) }), browser: Object.freeze({ open: (url, options) => capability('system.browserOpen', { url }, options), step: (input, options) => capability('system.browserStep', input, options), close: (id, options) => capability('system.browserClose', { id }, options) }), image: Object.freeze({ transform: (input, options) => capability('system.imageTransform', { quality: 85, ...input }, options) }), notify: (title, body = '', options) => capability('system.notify', { title, body }, options), pasteText: (text, options) => capability('system.pasteText', { text }, options), getDisplays: options => capability('system.getDisplays', null, options), captureScreen: (input = {}, options) => capability('system.captureScreen', input, options) }) } : {}),
    ...(namespaces.includes('files') ? { files: Object.freeze({
      select: (input = {}, options) => capability('files.select', { kind: input.kind ?? 'file', multiple: input.multiple ?? false }, options),
      openPath: (path, options) => capability('files.openPath', { path }, options),
    }) } : {}),
    ...(namespaces.includes('windows') ? { windows: Object.freeze({
      currentId: facade.windowId ?? 'main',
      create: (input = {}, options) => capability('window.create', input, options),
      show: (id, options) => capability('window.show', { id }, options),
      hide: (id, options) => capability('window.hide', { id }, options),
      close: (id, options) => capability('window.close', { id }, options),
      setBounds: (id, bounds, options) => capability('window.setBounds', { id, ...bounds }, options),
      setAlwaysOnTop: (id, enabled, options) => capability('window.setAlwaysOnTop', { id, enabled }, options),
      postMessage: (targetId, data, options) => capability('window.postMessage', { targetId, data }, options),
      onMessage: listener => subscribe('window.message', listener),
      onClosed: listener => subscribe('window.closed', listener),
    }) } : {}),
    subInput: Object.freeze({
      show: ({ placeholder = '搜索' } = {}, options) => capability('subInput.show', { placeholder }, options),
      hide: options => capability('subInput.hide', null, options),
      getText: options => capability('subInput.getText', null, options),
      setText: (text, options) => capability('subInput.setText', { text }, options),
      focus: options => capability('subInput.focus', null, options),
      releaseFocus: options => capability('subInput.releaseFocus', null, options),
      onChange: listener => subscribe('subInput.change', listener),
    }),
    results: Object.freeze({
      update: ({ query, revision, items, loading = false, error }, options) => capability('search.results.update', { query, revision, items, loading, ...(error === undefined ? {} : { error }) }, options),
      clear: (query, revision, options) => capability('search.results.clear', { query, revision }, options),
      onSelect: listener => subscribe('search.result-selected', listener),
    }),
    onClose(listener) {
    if (typeof listener !== 'function') throw new TypeError('Invalid close listener')
    if (closed) { listener(); return () => {} }
    if (listeners.size >= 4) throw safeError('LIMIT_EXCEEDED')
    const subscription = () => listener()
    listeners.add(subscription)
    return () => { listeners.delete(subscription) }
  } })
  function subscribeLifecycle(phase, listener) {
    const off = subscribe(`lifecycle.${phase}`, listener)
    if (!closed) enableLifecycle()
    const latest = lifecycleState.get(phase === 'enter' ? 'enter' : 'visibility')
    if (!closed && latest?.phase === phase) { try { listener(latest) } catch {} }
    return off
  }
  function subscribe(event, listener) {
    if (typeof listener !== 'function') throw new TypeError('Invalid search event listener')
    if (closed) return () => {}
    const subscriptions = eventListeners.get(event) ?? new Set()
    if (subscriptions.size >= 8) throw safeError('LIMIT_EXCEEDED')
    subscriptions.add(listener); eventListeners.set(event, subscriptions)
    return () => { subscriptions.delete(listener); if (!subscriptions.size) eventListeners.delete(event) }
  }
  function dispatchEvent(event, ...args) {
    for (const listener of [...(eventListeners.get(event) ?? [])]) {
      try { listener(...args) } catch { /* A plugin callback cannot break host event delivery. */ }
    }
  }
  function request(method, payload, { signal } = {}) {
    return new Promise((resolve, reject) => {
      let settled = false
      let handle
      function finish(error, value) {
        if (settled) return
        settled = true; pending.delete(cancel); signal?.removeEventListener('abort', aborted)
        if (error) reject(safeError(error)); else resolve(value)
      }
      function cancel(code) { finish(code); if (handle) { try { handle.cancel() } catch {} } }
      const aborted = () => cancel('CANCELLED')
      if (signal?.aborted) { finish('CANCELLED'); return }
      if (closed) { finish('RUNTIME_CLOSED'); return }
      try { validateRequestInput(method, payload) } catch (error) { finish(error.code ?? 'INVALID_REQUEST'); return }
      pending.add(cancel)
      signal?.addEventListener('abort', aborted, { once: true })
      ready.then(() => {
        if (settled) return
        if (closed || signal?.aborted) { cancel(closed ? 'RUNTIME_CLOSED' : 'CANCELLED'); return }
        try {
          handle = facade.submit(method, payload)
          Promise.resolve(handle.response).then(outcome => {
            if (outcome?.ok === true) finish(null, outcome.result)
            else finish(outcome?.error?.code ?? 'INTERNAL_ERROR')
          }, () => finish('INTERNAL_ERROR'))
        } catch { finish('INTERNAL_ERROR') }
      }, error => finish(error.code))
    })
  }
  return Object.freeze({ publicClient, request, dispose })
}
