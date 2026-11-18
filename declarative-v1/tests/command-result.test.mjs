import assert from 'node:assert/strict'
import test from 'node:test'
import { defineCommand } from '../node.mjs'

test('SDK retains the guarded optional command result contract without changing void execution', () => {
  assert.equal(defineCommand(() => {})({}), undefined)
  const command = defineCommand(invocation => invocation.resultTarget === 'super-panel' ? { kind: 'text', text: 'synthetic' } : undefined)
  assert.equal(command({}), undefined)
  assert.deepEqual(command({ resultTarget: 'super-panel' }), { kind: 'text', text: 'synthetic' })
})
