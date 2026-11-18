/** @type {import('@webtools/plugin-sdk/node').McpToolHandler<{ text: string }, { characterCount: number }>} */
module.exports = ({ mcpInput }) => ({
  characterCount: [...mcpInput.text.trim()].length,
})
