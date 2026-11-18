module.exports = async ({ mcpInput, webtools }) => {
  if (typeof mcpInput.text === 'string') await webtools.storage.set('agent-note', mcpInput.text)
  return { text: await webtools.storage.get('agent-note') ?? '' }
}
