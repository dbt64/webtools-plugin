import test from 'node:test'
import assert from 'node:assert/strict'
const module = await import('../web/bridge-client.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return null
  throw error
})
function harness() {
  assert.ok(module, 'browser SDK connection is missing')
  let close; let complete; let calls = 0; let cancels = 0; let unsubscribed = false
  const facade = { getReady: async () => ({ accepted: true }), onClose: listener => { close = listener; return () => { unsubscribed = true } },
    submit: () => { calls++; return { response: new Promise(resolve => { complete = resolve }), cancel: () => cancels++ } } }
  return { client: module.createBridgeConnection(facade), close: () => close(), complete: value => complete(value), calls: () => calls, cancels: () => cancels, unsubscribed: () => unsubscribed }
}
test('reentry notification lets a retained page read the updated context', async () => {
  const events = new Map()
  let value = { type: 'files', source: 'explorer-selection', items: [{ kind: 'file', path: 'C:\\a.png' }] }
  const facade = { getReady: async () => ({ accepted: true }), onClose: () => () => {},
    onEvent: (name, listener) => { events.set(name, listener); return () => events.delete(name) },
    submit: () => ({ response: Promise.resolve({ ok: true, result: value }), cancel() {} }) }
  const { publicClient, dispose } = module.createBridgeConnection(facade)
  await publicClient.ready
  assert.equal((await publicClient.context.current()).items[0].path, 'C:\\a.png')
  let updated
  const off = publicClient.context.onChange(() => { updated = publicClient.context.current() })
  value = { type: 'files', source: 'explorer-selection', items: [{ kind: 'file', path: 'C:\\b.png' }] }
  events.get('context.changed')(null)
  assert.equal((await updated).items[0].path, 'C:\\b.png')
  off(); dispose()
})

test('new SDK still connects to a pre-P5 event allowlist and reports tasks as unavailable', async () => {
  const calls = []
  const facade = { getReady: async () => ({ accepted: true }), onClose: () => () => {},
    onEvent: (name, _listener) => { if (name === 'tasks.trigger') throw new TypeError('Invalid plugin event listener'); return () => {} },
    submit: (method, payload) => { calls.push({ method, payload }); return { response: Promise.resolve({ ok: true, result: null }), cancel() {} } } }
  const { publicClient: api, dispose } = module.createBridgeConnection(facade)
  await api.ready
  assert.equal(await api.storage.get('legacy-key'), null)
  await assert.rejects(() => api.tasks.list(), error => error.code === 'NOT_AVAILABLE')
  assert.throws(() => api.tasks.onTrigger(() => {}), error => error.code === 'NOT_AVAILABLE')
  assert.deepEqual(calls, [{ method: 'storage.get', payload: { key: 'legacy-key' } }]); dispose()
})
test('public browser client exposes readiness/close and unprivileged typed families; privileged namespaces are absent without authority', async () => {
  assert.ok(module)
  const h = harness(); await h.client.publicClient.ready
  assert.deepEqual(Object.keys(h.client.publicClient).sort(), ['config', 'context', 'lifecycle', 'onClose', 'ready', 'results', 'shortcuts', 'storage', 'subInput', 'tasks'])
  const publicEntry = await import('@webtools/plugin-sdk/web')
  assert.deepEqual(Object.keys(publicEntry), ['connectWebTools'])
  await assert.rejects(publicEntry.connectWebTools().ready, error => error.code === 'NOT_AVAILABLE' && error.retryable === false)
  h.client.dispose()
})
test('SDK abort before emission sends nothing and local abort cannot be re-settled by late response', async () => {
  const h = harness(); await h.client.publicClient.ready
  const before = new AbortController(); before.abort()
  await assert.rejects(h.client.request('bridge.ping', null, { signal: before.signal }), error => error.code === 'CANCELLED')
  assert.equal(h.calls(), 0)
  const after = new AbortController(); const pending = h.client.request('bridge.ping', null, { signal: after.signal })
  await new Promise(resolve => setImmediate(resolve))
  after.abort()
  await assert.rejects(pending, error => error.code === 'CANCELLED')
  h.complete({ ok: true, result: null })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.cancels(), 1)
  await assert.rejects(pending, error => error.code === 'CANCELLED')
  h.client.dispose()
})
test('SDK maps Host failure and closes unresolved work without exposing Host error details', async () => {
  const h = harness(); await h.client.publicClient.ready
  const pending = h.client.request('unknown.call', null)
  await new Promise(resolve => setImmediate(resolve))
  h.complete({ ok: false, error: { code: 'NOT_AVAILABLE', retryable: false } })
  await assert.rejects(pending, error => error.code === 'NOT_AVAILABLE')
  let closed = 0; h.client.publicClient.onClose(() => closed++)
  const second = h.client.request('bridge.ping', null)
  await new Promise(resolve => setImmediate(resolve))
  h.close()
  await assert.rejects(second, error => error.code === 'RUNTIME_CLOSED')
  assert.equal(closed, 1); assert.equal(h.unsubscribed(), true)
})

test('SDK rejects unsupported JSON before invoking the private preload', async () => {
  const h = harness(); await h.client.publicClient.ready
  const attempted = h.client.request('bridge.ping', { invalid: undefined })
  attempted.catch(() => {})
  await new Promise(resolve => setImmediate(resolve))
  try {
    assert.equal(h.calls(), 0)
    await assert.rejects(attempted, error => error.code === 'INVALID_REQUEST')
  } finally { h.client.dispose() }
})

test('SDK retains at most four close subscriptions and unsubscribe releases a slot', async () => {
  const h = harness(); await h.client.publicClient.ready
  let calls = 0
  const callback = () => calls++
  const subscriptions = Array.from({ length: 4 }, () => h.client.publicClient.onClose(callback))
  try {
    assert.throws(() => h.client.publicClient.onClose(callback), error => error.code === 'LIMIT_EXCEEDED')
    subscriptions[0]()
    h.client.publicClient.onClose(callback)
    h.close()
    assert.equal(calls, 4)
  } finally { h.client.dispose() }
})


test('lifecycle subscriptions replay current state, unsubscribe, and stop after runtime close', async () => {
  const events = new Map(); const calls = []; let close
  const facade = { getReady: async () => ({ accepted: true }), onClose: fn => { close = fn; return () => {} },
    onEvent: (name, fn) => { events.set(name, fn); return () => events.delete(name) },
    submit: method => { calls.push(method); return { response: Promise.resolve({ ok: true, result: null }), cancel() {} } } }
  const { publicClient: api } = module.createBridgeConnection(facade)
  await api.ready
  assert.deepEqual(calls, [], 'ordinary SDK use does not enable new events on old plugins')
  let initialized = 0; let closed = 0; const received = []
  api.lifecycle.onInitialize(() => initialized++)
  const off = api.lifecycle.onEnter(event => received.push(event.entryCount))
  api.lifecycle.onClose(() => closed++)
  await api.lifecycle.ready
  assert.equal(initialized, 1)
  assert.deepEqual(calls, ['lifecycle.subscribe'])
  const send = (phase, entryCount) => events.get('lifecycle.changed')({ phase, entryCount, generation: 42, featureId: 'home' })
  send('enter', 1); send('show', 1); send('hide', 1)
  let hidden = 0; api.lifecycle.onHide(() => hidden++)
  assert.equal(hidden, 1, 'late subscription sees the current hidden state')
  let lateEnter; api.lifecycle.onEnter(event => { lateEnter = event })
  assert.equal(lateEnter.entryCount, 1)
  assert.equal(Object.isFrozen(lateEnter), true)
  off(); send('enter', 2)
  assert.deepEqual(received, [1])
  close(); assert.equal(closed, 1)
  assert.equal(events.size, 0)
})
