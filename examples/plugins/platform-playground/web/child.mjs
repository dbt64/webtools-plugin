import { connectWebTools } from './sdk/index.mjs'

const status = document.querySelector('#status')
const api = connectWebTools()
try {
  await api.ready
  if (!api.windows) throw new Error('宿主不支持自定义窗口')
  status.textContent = '子窗口已连接'
  api.windows.onMessage(({ data }) => { status.textContent = `收到主窗口消息：${data}` })
  document.querySelector('#send').addEventListener('click', async () => {
    try { await api.windows.postMessage('main', document.querySelector('#message').value); status.textContent = '已发送给主窗口' }
    catch (error) { status.textContent = `发送失败：${error?.code ?? error?.message}` }
  })
} catch (error) { status.textContent = `连接失败：${error?.code ?? error?.message}` }
