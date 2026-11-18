import test from 'node:test'
import assert from 'node:assert/strict'
import { createBridgeConnection } from '../web/bridge-client.mjs'

function connection(capabilityNamespaces = ['ai', 'clipboard']) {
  const calls = []
  const facade = { capabilityNamespaces, getReady: async () => ({ accepted: true }), onClose: () => () => {},
    submit: (method, payload) => { calls.push({ method, payload }); return { response: Promise.resolve({ ok: true,
      result: method === 'context.current' ? { type: 'text', source: 'launcher-input', text: '中文 exact' }
        : method === 'config.get' ? { label: 'hello' } : method === 'ai.complete' ? { text: 'answer' } : method === 'storage.get' ? { saved: true } : method === 'storage.list' ? ['note-a']
          : method === 'system.getDisplays' ? [{ id: 'display-1', label: '主显示器', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1, rotation: 0, primary: true }]
            : method === 'system.captureScreen' ? 'data:image/png;base64,iVBORw0KGgo=' : null }), cancel: () => {} } } }
  return { client: createBridgeConnection(facade), calls }
}
test('system notification SDK sends validated title and body', async () => {
  const { client, calls } = connection(['system']); const api = client.publicClient; await api.ready
  assert.equal(await api.system.notify('标题', '内容'), undefined)
  assert.deepEqual(calls, [{ method: 'system.notify', payload: { title: '标题', body: '内容' } }])
  await assert.rejects(() => api.system.notify(' ', '内容'))
  client.dispose()
})
test('system paste SDK sends validated text', async () => {
  const { client, calls } = connection(['system']); const api = client.publicClient; await api.ready
  assert.equal(await api.system.pasteText('测试文字'), undefined)
  assert.deepEqual(calls, [{ method: 'system.pasteText', payload: { text: '测试文字' } }])
  await assert.rejects(() => api.system.pasteText(''))
  await assert.rejects(() => api.system.pasteText('x\0y'))
  client.dispose()
})
test('system screen SDK lists displays and returns a PNG capture', async () => {
  const { client, calls } = connection(['system']); const api = client.publicClient; await api.ready
  assert.deepEqual(await api.system.getDisplays(), [{ id: 'display-1', label: '主显示器', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1, rotation: 0, primary: true }])
  assert.equal(await api.system.captureScreen({ displayId: 'display-1' }), 'data:image/png;base64,iVBORw0KGgo=')
  assert.deepEqual(calls, [
    { method: 'system.getDisplays', payload: null },
    { method: 'system.captureScreen', payload: { displayId: 'display-1' } },
  ])
  await assert.rejects(() => api.system.captureScreen({ displayId: 'bad id' }))
  client.dispose()
})
test('public SDK exposes the five typed families; optional privileged namespaces reflect Host-provided availability', async () => {
  const { client, calls } = connection(); const api = client.publicClient; await api.ready
  assert.deepEqual(Object.keys(api).sort(), ['ai', 'clipboard', 'config', 'context', 'lifecycle', 'onClose', 'ready', 'results', 'shortcuts', 'storage', 'subInput', 'tasks'])
  assert.equal(api.request, undefined); assert.equal(api.external, undefined)
  const context = await api.context.current(); assert.equal(context.text, '中文 exact'); assert.equal(Object.isFrozen(context), true)
  assert.deepEqual(await api.config.get(), { label: 'hello' })
  assert.equal(await api.config.set('label', 'saved'), undefined)
  assert.deepEqual(await api.storage.get('note'), { saved: true })
  assert.deepEqual(await api.storage.list('note'), ['note-a'])
  assert.equal(await api.storage.set('note', { saved: true }), undefined)
  assert.equal(await api.storage.delete('note'), undefined)
  assert.deepEqual(await api.ai.complete({ prompt: 'hello' }), { text: 'answer' })
  assert.equal(await api.clipboard.writeText('safe'), undefined)
  assert.deepEqual(calls.map(c => c.method), ['context.current', 'config.get', 'config.set', 'storage.get', 'storage.list', 'storage.set', 'storage.delete', 'ai.complete', 'clipboard.write'])
  const denied = connection([]); assert.equal(denied.client.publicClient.ai, undefined); assert.equal(denied.client.publicClient.clipboard, undefined)
  client.dispose(); denied.client.dispose()
})
test('SDK closed schemas reject authority/provider fields, path keys, non-JSON, and byte excess before transport', async () => {
  const { client, calls } = connection(); const api = client.publicClient; await api.ready
  for (const run of [
    () => api.config.set('../other-plugin', 'forged'),
    () => api.config.set('label', { arbitrary: 'JSON' }),
    () => api.config.set('label', NaN),
    () => api.ai.complete({ prompt: 'safe', providerId: 'forged' }),
    () => api.ai.complete({ prompt: 'x'.repeat(32769) }),
    () => api.storage.get('../another-plugin'),
    () => api.storage.set('note', { __proto__: { forged: true } }),
    () => api.storage.set('note', 'x'.repeat(524288)),
    () => api.clipboard.writeText('x'.repeat(65537)),
  ]) await assert.rejects(run)
  assert.equal(calls.length, 0); client.dispose()
})
test('typed capability cancellation before readiness emits no request', async () => {
  const { client, calls } = connection(); const controller = new AbortController(); controller.abort()
  await assert.rejects(() => client.publicClient.ai.complete({ prompt: 'safe' }, { signal: controller.signal }), e => e.code === 'CANCELLED')
  assert.equal(calls.length, 0); client.dispose()
})

test('declared window capability exposes managed business windows and typed messaging', async () => {
  const calls = []
  const events = new Map()
  const facade = { capabilityNamespaces: ['windows'], windowId: 'main', getReady: async () => ({ accepted: true }), onClose: () => () => {},
    onEvent: (name, listener) => { events.set(name, listener); return () => events.delete(name) },
    submit: (method, payload) => { calls.push({ method, payload }); return { response: Promise.resolve({ ok: true, result: method === 'window.create' ? { id: 'child-1' } : null }), cancel() {} } } }
  const { publicClient: api, dispose } = createBridgeConnection(facade)
  await api.ready
  assert.equal(api.windows.currentId, 'main')
  const child = await api.windows.create({ title: 'Preview', width: 640, height: 480 })
  await api.windows.show(child.id)
  await api.windows.setBounds(child.id, { x: 20, y: 30, width: 640, height: 480 })
  await api.windows.setAlwaysOnTop(child.id, true)
  await api.windows.postMessage(child.id, { type: 'ping' })
  const messages = []; const closed = []
  api.windows.onMessage(message => messages.push(message))
  api.windows.onClosed(id => closed.push(id))
  events.get('window.message')({ from: 'child-1', data: { type: 'pong' } })
  events.get('window.closed')({ id: 'child-1' })
  assert.deepEqual(messages, [{ from: 'child-1', data: { type: 'pong' } }])
  assert.deepEqual(closed, ['child-1'])
  assert.deepEqual(calls, [
    { method: 'window.create', payload: { title: 'Preview', width: 640, height: 480 } },
    { method: 'window.show', payload: { id: 'child-1' } },
    { method: 'window.setBounds', payload: { id: 'child-1', x: 20, y: 30, width: 640, height: 480 } },
    { method: 'window.setAlwaysOnTop', payload: { id: 'child-1', enabled: true } },
    { method: 'window.postMessage', payload: { targetId: 'child-1', data: { type: 'ping' } } },
  ])
  dispose()
})

test('window capability payload validation rejects invalid geometry and forbidden receiver ids', async () => {
  const { client, calls } = connection(['windows'])
  const api = client.publicClient
  await api.ready
  for (const run of [
    () => api.windows.create({ width: -1 }),
    () => api.windows.create({ title: 'x'.repeat(241) }),
    () => api.windows.show('__proto__'),
    () => api.windows.setBounds('child', { x: 0, y: 0, width: 0, height: 200 }),
    () => api.windows.postMessage('child', { callback() {} }),
  ]) await assert.rejects(run)
  assert.equal(calls.length, 0)
  client.dispose()
})
