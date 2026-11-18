// Private closed request/response schemas, not a package export or generic public API.
import { BridgeWireError, measureUtf8, validateRequestInput } from './protocol.mjs'
import { validateInvocationContext } from './invocation-context.mjs'
export const CAPABILITY_METHODS = Object.freeze(['system.mediaTranscode', 'system.browserOpen', 'system.browserStep', 'system.browserClose', 'system.imageTransform', 'tasks.request', 'tasks.list', 'tasks.remove', 'tasks.subscribe', 'tasks.complete', 'system.pasteText', 'system.notify', 'system.getDisplays', 'system.captureScreen', 'clipboard.readText', 'clipboard.readImage', 'clipboard.writeImage', 'clipboard.readFiles', 'clipboard.writeFiles', 'files.select', 'files.openPath', 'lifecycle.subscribe', 'context.current', 'shortcuts.current', 'config.get', 'config.set', 'storage.get', 'storage.set', 'storage.delete', 'storage.list', 'storage.files.list', 'storage.files.read', 'storage.files.write', 'storage.files.delete', 'storage.backup.export', 'storage.backup.import', 'ai.complete', 'clipboard.write', 'external.open', 'subInput.show', 'subInput.hide', 'subInput.getText', 'subInput.setText', 'subInput.focus', 'subInput.releaseFocus', 'search.results.update', 'search.results.clear', 'window.create', 'window.show', 'window.hide', 'window.close', 'window.setBounds', 'window.setAlwaysOnTop', 'window.postMessage'])
const invalid = () => { throw new BridgeWireError('INVALID_REQUEST') }
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid()
}
function text(value, bytes) {
  if (typeof value !== 'string') invalid()
  if (measureUtf8(value, bytes) > bytes) throw new BridgeWireError('LIMIT_EXCEEDED')
}
function key(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value) || ['__proto__', 'prototype', 'constructor'].includes(value)) invalid()
}
function jsonValue(value, maxBytes = 524288) {
  if (measureUtf8(JSON.stringify(value), maxBytes) > maxBytes) throw new BridgeWireError('LIMIT_EXCEEDED')
}
function relativePath(value, allowEmpty = false, allowTrailingSlash = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value) || measureUtf8(value, 512) > 512
    || value.startsWith('/') || value.endsWith('/') && !allowTrailingSlash || /[\\:\x00-\x1f\x7f<>"|?*]/u.test(value)) invalid()
  const normalized = allowTrailingSlash && value.endsWith('/') ? value.slice(0, -1) : value
  if (normalized) {
    const parts = normalized.split('/')
    if (parts.length > 12 || parts.some(part => !part || part === '.' || part === '..' || part.length > 180 || /[. ]$/u.test(part)
      || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(part))) invalid()
  }
}
function base64(value, maxBytes = 4 * 1024 * 1024) {
  const maxEncoded = Math.ceil(maxBytes / 3) * 4
  text(value, maxEncoded)
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) invalid()
}
function backup(value) {
  exact(value, ['format', 'version', 'pluginId', 'exportedAt', 'data', 'files'])
  if (value.format !== 'webtools-plugin-storage' || value.version !== 1 || typeof value.pluginId !== 'string'
    || !/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(value.pluginId) || typeof value.exportedAt !== 'string'
    || !Number.isFinite(Date.parse(value.exportedAt)) || !value.data || typeof value.data !== 'object'
    || Array.isArray(value.data) || !Array.isArray(value.files) || value.files.length > 256) invalid()
  jsonValue(value.data)
  let encodedBytes = 0
  const seen = new Set()
  for (const item of value.files) {
    exact(item, ['path', 'data']); relativePath(item.path); base64(item.data)
    if (seen.has(item.path)) invalid()
    seen.add(item.path)
    encodedBytes += item.data.length
    if (encodedBytes > Math.ceil((8 * 1024 * 1024) / 3) * 4 + 2048) throw new BridgeWireError('LIMIT_EXCEEDED')
  }
  jsonValue(value, 15 * 1024 * 1024)
}
export function validateCapabilityRequest(method, payload) {
  if (!CAPABILITY_METHODS.includes(method)) throw new BridgeWireError('NOT_AVAILABLE')
  validateRequestInput(method, payload)
  if (method === 'system.mediaTranscode') { exact(payload, ['inputPath', 'format']); text(payload.inputPath, 32768); if (!/^(?:[a-z]:[\\/]|\\\\)/iu.test(payload.inputPath) || /[\u0000-\u001f]/u.test(payload.inputPath) || !['wav', 'mp3', 'mp4', 'webm'].includes(payload.format)) invalid() }
  else if (method === 'system.browserOpen') {
    exact(payload, ['url']); text(payload.url, 8192)
    let url; try { url = new URL(payload.url) } catch { invalid() }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) invalid()
  } else if (method === 'system.browserClose') { exact(payload, ['id']); text(payload.id, 80) }
  else if (method === 'system.browserStep') {
    if (!payload || !['navigate', 'input', 'click', 'text', 'screenshot'].includes(payload.action)) invalid()
    exact(payload, ['id', 'action', ...(['input', 'click', 'text'].includes(payload.action) ? ['selector'] : []), ...(['navigate', 'input'].includes(payload.action) ? ['value'] : [])])
    text(payload.id, 80)
    if (payload.selector !== undefined) { text(payload.selector, 1024); if (!payload.selector.trim()) invalid() }
    if (payload.value !== undefined) text(payload.value, 65536)
    if (payload.action === 'navigate') validateCapabilityRequest('system.browserOpen', { url: payload.value })
  } else if (method === 'system.imageTransform') {
    exact(payload, ['dataUrl', 'width', 'format', 'quality', ...(Object.hasOwn(payload, 'height') ? ['height'] : [])])
    text(payload.dataUrl, 12000000)
    if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/iu.test(payload.dataUrl)) invalid()
    for (const n of [payload.width, payload.height ?? 1]) if (!Number.isSafeInteger(n) || n < 1 || n > 4096) invalid()
    if (!['png', 'jpeg'].includes(payload.format) || !Number.isInteger(payload.quality) || payload.quality < 1 || payload.quality > 100) invalid()
  } else if (method === 'tasks.request') {
    exact(payload, ['code', 'description', 'schedule']); key(payload.code); text(payload.description, 1024)
    if (!payload.description.trim()) invalid()
    const schedule = payload.schedule
    if (schedule?.kind === 'once') { exact(schedule, ['kind', 'atMs']); if (!Number.isSafeInteger(schedule.atMs) || schedule.atMs < 1) invalid() }
    else if (schedule?.kind === 'cron') {
      if (Object.keys(schedule).some(k => !['kind', 'expression', 'startMs', 'endMs'].includes(k))) invalid()
      text(schedule.expression, 120); if (schedule.expression.trim().split(/\s+/).length !== 5 || !/^[a-z0-9*,/\s-]+$/i.test(schedule.expression)) invalid()
      for (const k of ['startMs', 'endMs']) if (schedule[k] !== undefined && (!Number.isSafeInteger(schedule[k]) || schedule[k] < 1)) invalid()
      if (schedule.startMs && schedule.endMs && schedule.startMs >= schedule.endMs) invalid()
    } else invalid()
  } else if (method === 'tasks.list' || method === 'tasks.subscribe') { if (payload !== null) invalid() }
  else if (method === 'tasks.remove') { exact(payload, ['code']); key(payload.code) }
  else if (method === 'tasks.complete') { exact(payload, ['executionId', 'error']); text(payload.executionId, 128); if (payload.error !== null) text(payload.error, 1024) }
  else if (method === 'system.pasteText') { exact(payload, ['text']); text(payload.text, 65536); if (!payload.text || payload.text.includes('\0')) invalid() }
  else if (method === 'system.notify') { exact(payload, ['title', 'body']); text(payload.title, 240); text(payload.body, 4096); if (!payload.title.trim()) invalid() }
  else if (method === 'system.captureScreen') {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(name => name !== 'displayId')) invalid()
    if (Object.hasOwn(payload, 'displayId')) { text(payload.displayId, 128); if (!payload.displayId.trim() || /[\s\u0000-\u001f\u007f]/u.test(payload.displayId)) invalid() }
  }
  else if (method === 'files.select') { exact(payload, ['kind', 'multiple']); if (!['file', 'directory'].includes(payload.kind) || typeof payload.multiple !== 'boolean') invalid() }
  else if (method === 'files.openPath') { exact(payload, ['path']); text(payload.path, 32768); if (!/^(?:[a-z]:[\\/]|\\\\|\/)/iu.test(payload.path) || /[\u0000-\u001f]/u.test(payload.path)) invalid() }
  else if (['clipboard.readText', 'clipboard.readImage', 'clipboard.readFiles'].includes(method) || method === 'system.getDisplays' || method === 'lifecycle.subscribe' || method === 'context.current' || method === 'shortcuts.current' || method === 'config.get' || ['subInput.hide', 'subInput.getText', 'subInput.focus', 'subInput.releaseFocus'].includes(method)) { if (payload !== null) invalid() }
  else if (method === 'clipboard.writeImage') { exact(payload, ['dataUrl']); text(payload.dataUrl, 15000000); if (!/^data:image\/png;base64,[a-z0-9+/]+={0,2}$/iu.test(payload.dataUrl)) invalid() }
  else if (method === 'clipboard.writeFiles') { exact(payload, ['paths']); if (!Array.isArray(payload.paths) || !payload.paths.length || payload.paths.length > 256) invalid(); for (const path of payload.paths) { text(path, 32768); if (!/^(?:[a-z]:[\\/]|\\\\)/iu.test(path) || /[\u0000-\u001f]/u.test(path)) invalid() } }
  else if (method === 'config.set') { exact(payload, ['key', 'value']); key(payload.key); if (!['string', 'boolean', 'number'].includes(typeof payload.value) || typeof payload.value === 'number' && !Number.isFinite(payload.value)) invalid() }
  else if (method === 'storage.list') { exact(payload, ['prefix']); if (typeof payload.prefix !== 'string' || !/^[a-zA-Z0-9_-]{0,64}$/.test(payload.prefix)) invalid() }
  else if (method === 'storage.files.list') { exact(payload, ['prefix']); relativePath(payload.prefix, true, true) }
  else if (method === 'storage.files.read' || method === 'storage.files.delete') { exact(payload, ['path']); relativePath(payload.path) }
  else if (method === 'storage.files.write') { exact(payload, ['path', 'data']); relativePath(payload.path); base64(payload.data) }
  else if (method === 'storage.backup.export') { if (payload !== null) invalid() }
  else if (method === 'storage.backup.import') { exact(payload, ['backup']); backup(payload.backup) }
  else if (['storage.get', 'storage.set', 'storage.delete'].includes(method)) {
    exact(payload, method === 'storage.set' ? ['key', 'value'] : ['key']); key(payload.key)
    if (method === 'storage.set') jsonValue(payload.value)
  } else if (method === 'external.open') {
    exact(payload, ['url']); text(payload.url, 32768)
    if (!/^https?:\/\//iu.test(payload.url) || /[\s\u0000-\u001f\u007f-\u009f\\]/u.test(payload.url)) invalid()
    let url
    try { url = new URL(payload.url) } catch { invalid() }
    if (!url.hostname || url.username || url.password) invalid()
  } else if (method === 'ai.complete') { exact(payload, ['prompt']); text(payload.prompt, 32768); if (!payload.prompt.trim()) invalid() }
  else if (method === 'subInput.show') { exact(payload, ['placeholder']); text(payload.placeholder, 160) }
  else if (method === 'subInput.setText') { exact(payload, ['text']); text(payload.text, 1024) }
  else if (method === 'search.results.update') {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || Object.keys(payload).some(name => !['query', 'revision', 'items', 'loading', 'error'].includes(name))
      || !['query', 'revision', 'items', 'loading'].every(name => Object.hasOwn(payload, name))) invalid()
    text(payload.query, 1024)
    if (!Number.isSafeInteger(payload.revision) || payload.revision < 1) invalid()
    if (!Array.isArray(payload.items) || payload.items.length > 30 || typeof payload.loading !== 'boolean') invalid()
    if (payload.error !== undefined) text(payload.error, 240)
    const ids = new Set()
    for (const item of payload.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) invalid()
      const keys = Object.keys(item)
      if (keys.some(name => !['id', 'title', 'description', 'icon'].includes(name)) || !['id', 'title'].every(name => Object.hasOwn(item, name))) invalid()
      text(item.id, 128); text(item.title, 240)
      if (ids.has(item.id)) invalid()
      ids.add(item.id)
      if (item.description !== undefined) text(item.description, 512)
      if (item.icon !== undefined) {
        text(item.icon, 65536)
        if (!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/iu.test(item.icon)) invalid()
      }
    }
  } else if (method === 'search.results.clear') { exact(payload, ['query', 'revision']); text(payload.query, 1024); if (!Number.isSafeInteger(payload.revision) || payload.revision < 1) invalid() }
  else if (method === 'window.create') {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || Object.keys(payload).some(name => !['title', 'width', 'height', 'document', 'chrome'].includes(name))) invalid()
    if (payload.title !== undefined) text(payload.title, 240)
    if (payload.document !== undefined) { text(payload.document, 512); if (!payload.document || payload.document.startsWith('/') || payload.document.includes('\\') || payload.document.split('/').some(part => !part || part === '.' || part === '..')) invalid() }
    if (payload.chrome !== undefined && !['host', 'frameless', 'native'].includes(payload.chrome)) invalid()
    for (const name of ['width', 'height']) if (payload[name] !== undefined && (!Number.isInteger(payload[name]) || payload[name] < 1 || payload[name] > 32768)) invalid()
  } else if (method === 'window.show' || method === 'window.hide' || method === 'window.close') { exact(payload, ['id']); key(payload.id) }
  else if (method === 'window.setBounds') {
    exact(payload, ['id', 'x', 'y', 'width', 'height']); key(payload.id)
    for (const name of ['x', 'y']) if (!Number.isInteger(payload[name]) || payload[name] < -32768 || payload[name] > 32768) invalid()
    for (const name of ['width', 'height']) if (!Number.isInteger(payload[name]) || payload[name] < 1 || payload[name] > 32768) invalid()
  } else if (method === 'window.setAlwaysOnTop') { exact(payload, ['id', 'enabled']); key(payload.id); if (typeof payload.enabled !== 'boolean') invalid() }
  else if (method === 'window.postMessage') { exact(payload, ['targetId', 'data']); key(payload.targetId); jsonValue(payload.data) }
  else { exact(payload, ['text']); text(payload.text, 65536) }
  return { method, payload }
}
export function validateCapabilityResult(method, result) {
  validateRequestInput(method, result)
  if (method === 'system.mediaTranscode') { if (result !== null) { exact(result, ['path']); text(result.path, 32768) } }
  else if (method === 'system.browserOpen') { exact(result, ['id']); text(result.id, 80) }
  else if (method === 'system.browserStep') { if (result !== null) text(result, 15000000) }
  else if (method === 'system.imageTransform') {
    exact(result, ['dataUrl', 'width', 'height', 'bytes']); text(result.dataUrl, 15000000)
    if (!/^data:image\/(png|jpeg);base64,[a-z0-9+/]+={0,2}$/iu.test(result.dataUrl)) invalid()
    for (const n of [result.width, result.height, result.bytes]) if (!Number.isSafeInteger(n) || n < 1) invalid()
  } else if (method === 'tasks.request') { if (!result || typeof result !== 'object' || typeof result.code !== 'string') invalid(); jsonValue(result) }
  else if (method === 'tasks.list') { if (!Array.isArray(result)) invalid(); jsonValue(result) }
  else if (method === 'tasks.remove') { if (typeof result !== 'boolean') invalid() }
  else if (method === 'system.getDisplays') {
    if (!Array.isArray(result) || !result.length || result.length > 32) invalid()
    const ids = new Set()
    for (const display of result) {
      exact(display, ['id', 'label', 'bounds', 'workArea', 'scaleFactor', 'rotation', 'primary'])
      text(display.id, 128); text(display.label, 256)
      if (!display.id || ids.has(display.id)) invalid()
      ids.add(display.id)
      for (const rect of [display.bounds, display.workArea]) {
        exact(rect, ['x', 'y', 'width', 'height'])
        if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) invalid()
      }
      if (!Number.isFinite(display.scaleFactor) || display.scaleFactor <= 0 || display.scaleFactor > 8
        || ![0, 90, 180, 270].includes(display.rotation) || typeof display.primary !== 'boolean') invalid()
    }
  } else if (method === 'system.captureScreen') { text(result, 15000000); if (!/^data:image\/png;base64,[a-z0-9+/]+={0,2}$/iu.test(result)) invalid() }
  else if (method === 'clipboard.readText') text(result, 524288)
  else if (method === 'clipboard.readImage') { if (result !== null) { text(result, 15000000); if (!/^data:image\/png;base64,[a-z0-9+/]+={0,2}$/iu.test(result)) invalid() } }
  else if (method === 'clipboard.readFiles') { if (!Array.isArray(result)) invalid(); for (const path of result) text(path, 32768) }
  else if (method === 'files.select') { if (!Array.isArray(result)) invalid(); for (const path of result) text(path, 32768) }
  else if (method === 'context.current') {
    validateInvocationContext(result)
  } else if (method === 'shortcuts.current') {
    if (result !== null) text(result, 80)
  } else if (method === 'config.get') {
    if (!result || typeof result !== 'object' || Array.isArray(result) || Object.keys(result).length > 64) invalid()
    for (const [name, value] of Object.entries(result)) { key(name); if (!['string', 'boolean', 'number'].includes(typeof value)) invalid() }
    jsonValue(result)
  } else if (method === 'ai.complete') { exact(result, ['text']); text(result.text, 32768) }
  else if (method === 'subInput.getText') text(result, 1024)
  else if (method.startsWith('subInput.') || method.startsWith('search.') || method.startsWith('window.') && method !== 'window.create') { if (result !== null) invalid() }
  else if (method === 'window.create') { exact(result, ['id']); key(result.id) }
  else if (method === 'storage.get') jsonValue(result)
  else if (method === 'storage.list') { if (!Array.isArray(result) || result.some(item => { try { key(item); return false } catch { return true } })) invalid() }
  else if (method === 'storage.files.list') {
    if (!Array.isArray(result) || result.length > 256) invalid()
    const seen = new Set()
    for (const item of result) {
      exact(item, ['path', 'size']); relativePath(item.path)
      if (!Number.isSafeInteger(item.size) || item.size < 0 || item.size > 4 * 1024 * 1024 || seen.has(item.path)) invalid()
      seen.add(item.path)
    }
  } else if (method === 'storage.files.read') { if (result !== null) base64(result) }
  else if (method === 'storage.backup.export') backup(result)
  else if (result !== null) invalid()
}
