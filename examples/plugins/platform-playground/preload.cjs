// UI uses the public WebTools bridge. MCP commands execute in a separate, bounded Node invocation.
const { contextBridge } = require('electron')
const { createServer } = require('node:http')
const { mkdir, writeFile } = require('node:fs/promises')
const { join } = require('node:path')
let server
let starting
const page = `<!doctype html><meta charset="utf-8"><title>WebTools 自动化示例</title><style>body{font:24px system-ui;padding:48px}input,button{font:inherit;padding:12px}#result{margin-top:32px}</style><h1>插件网页自动化验收</h1><input id="note" aria-label="测试文字"><button id="apply">应用</button><p id="result">等待填写</p><script>document.querySelector('#apply').onclick=()=>document.querySelector('#result').textContent='已收到：'+document.querySelector('#note').value</script>`
contextBridge.exposeInMainWorld('workflowDemo', Object.freeze({
  // A plugin-owned fixture server; only this static page is exposed on loopback.
  start: () => starting ??= new Promise((resolve, reject) => {
    server = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(page) })
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { server.unref(); resolve('http://127.0.0.1:' + server.address().port) })
  }),
  sampleAudio: async () => {
    const rate = 16000; const buffer = Buffer.alloc(44 + rate * 2)
    buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8)
    buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22)
    buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34)
    buffer.write('data', 36); buffer.writeUInt32LE(rate * 2, 40)
    for (let n = 0; n < rate; n++) buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * n / rate) * 4000), 44 + n * 2)
    await mkdir(process.env.WEBTOOLS_PLUGIN_DATA, { recursive: true })
    const path = join(process.env.WEBTOOLS_PLUGIN_DATA, 'workflow-sample.wav')
    await writeFile(path, buffer); return path
  },
}))
window.addEventListener('unload', () => server?.close(), { once: true })
