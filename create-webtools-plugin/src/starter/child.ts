import { connectWebTools } from '@webtools/plugin-sdk/web'
import '@webtools/plugin-sdk/ui.css'
import './style.css'

const host = connectWebTools()
const send = document.querySelector<HTMLButtonElement>('#send')!
const message = document.querySelector<HTMLInputElement>('#message')!
const status = document.querySelector<HTMLElement>('#status')!

void host.ready.then(() => {
  const windows = host.windows
  if (!windows || windows.currentId === 'main') {
    status.textContent = '请从模板主窗口打开此页面'
    return
  }
  send.disabled = false
  status.textContent = '子窗口已连接'
  send.addEventListener('click', async () => {
    try {
      await windows.postMessage('main', message.value)
      status.textContent = '已发送到主窗口'
    } catch {
      status.textContent = '发送失败'
    }
  })
}).catch(() => { status.textContent = '未连接 WebTools 宿主' })
