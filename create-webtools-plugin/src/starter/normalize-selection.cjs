/** @param {import('@webtools/plugin-sdk/node').CommandInvocation} invocation */
module.exports = function normalizeSelection({ context, signal }) {
  signal.throwIfAborted()
  if (context?.type !== 'text' || context.source !== 'selected-text') return
  const text = context.text.replace(/[\s\u0000-\u001f]+/gu, ' ').trim()
  if (!text) return
  return { kind: 'text', text: Array.from(text).slice(0, 8192).join('') }
}
