import { connectWebTools } from '@webtools/plugin-sdk/web'
import markup from './demo.html?raw'

const samples = [
  { id: 'clipboard', title: '剪贴板', description: 'Clipboard · 本地搜索样例' },
  { id: 'file', title: '文件', description: 'File · 选中文件入口' },
  { id: 'window', title: '窗口', description: 'Window · 自定义子窗口' },
]

function mountStarterDemo(root: HTMLElement) {
  // The markup is bundled with the template. Render all invocation data as text.
  root.innerHTML = markup
  const search = root.querySelector<HTMLButtonElement>('#open-search')!
  const searchStatus = root.querySelector<HTMLElement>('#search-status')!
  const filesStatus = root.querySelector<HTMLElement>('#files-status')!
  const files = root.querySelector<HTMLUListElement>('#selected-files')!
  const openChild = root.querySelector<HTMLButtonElement>('#open-child')!
  const closeChild = root.querySelector<HTMLButtonElement>('#close-child')!
  const windowStatus = root.querySelector<HTMLElement>('#window-status')!
  const host = connectWebTools()
  const abort = new AbortController()
  const subscriptions: Array<() => void> = []
  const stop = () => {
    abort.abort()
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    search.disabled = openChild.disabled = closeChild.disabled = true
  }
  subscriptions.push(host.onClose(stop))

  const call = { signal: abort.signal }
  const report = (target: HTMLElement, message: string) => {
    if (!abort.signal.aborted) target.textContent = message
  }
  let contextRevision = 0
  const refreshFiles = async () => {
    const revision = ++contextRevision
    try {
      const context = await host.context.current(call)
      if (abort.signal.aborted || revision !== contextRevision) return
      const paths = context?.type === 'files' ? context.items.map(item => item.path) : []
      files.replaceChildren(...paths.map(path => {
        const item = document.createElement('li')
        item.textContent = path
        return item
      }))
      filesStatus.textContent = paths.length ? '收到 ' + paths.length + ' 个文件' : '本次没有选中文件'
    } catch {
      if (revision !== contextRevision || abort.signal.aborted) return
      files.replaceChildren()
      filesStatus.textContent = '读取调用上下文失败'
    }
  }

  void host.ready.then(() => {
    if (abort.signal.aborted) return
    subscriptions.push(host.context.onChange(() => { void refreshFiles() }))
    void refreshFiles()

    let latestRevision: number | undefined
    subscriptions.push(host.subInput.onChange((value, revision) => {
      latestRevision = revision
      const query = value.trim().toLowerCase()
      const items = query ? samples.filter(item => (item.title + ' ' + item.description).toLowerCase().includes(query)) : []
      void host.results.update({ query: value, revision, items }, call).catch(() => {
        if (revision === latestRevision) report(searchStatus, '更新动态结果失败')
      })
    }))
    subscriptions.push(host.results.onSelect(({ item }) => {
      report(searchStatus, '已选择：' + item.title)
      void host.subInput.hide(call).catch(() => report(searchStatus, '已选择：' + item.title + '（无法隐藏子输入）'))
    }))
    search.disabled = false
    report(searchStatus, '准备就绪')
    search.addEventListener('click', () => {
      void host.subInput.show({ placeholder: '搜索剪贴板、文件或窗口…' }, call)
        .then(() => report(searchStatus, '请在宿主子输入中搜索'))
        .catch(() => report(searchStatus, '无法打开宿主子输入'))
    }, { signal: abort.signal })

    const windows = host.windows
    if (!windows) {
      report(windowStatus, '当前宿主或插件未提供窗口管理能力')
      return
    }
    let childId: string | null = null
    let busy = false
    const updateButtons = () => {
      openChild.disabled = abort.signal.aborted || busy
      closeChild.disabled = abort.signal.aborted || busy || childId === null
    }
    subscriptions.push(windows.onClosed(id => {
      if (id !== childId) return
      childId = null
      busy = false
      report(windowStatus, '子窗口已关闭')
      updateButtons()
    }))
    subscriptions.push(windows.onMessage(({ from, data }) => {
      if (from === childId && typeof data === 'string') report(windowStatus, '子窗口消息：' + data)
    }))
    openChild.addEventListener('click', async () => {
      if (busy) return
      busy = true
      updateButtons()
      try {
        if (childId) await windows.show(childId, call)
        else childId = (await windows.create({ document: 'web/child.html', title: '模板子窗口', width: 460, height: 320 }, call)).id
        report(windowStatus, '子窗口已打开')
      } catch {
        report(windowStatus, '无法打开子窗口，请检查窗口管理授权')
      } finally {
        busy = false
        updateButtons()
      }
    }, { signal: abort.signal })
    closeChild.addEventListener('click', async () => {
      if (!childId || busy) return
      busy = true
      updateButtons()
      try {
        // onClosed marks the window as gone only after the host has closed it.
        await windows.close(childId, call)
      } catch {
        busy = false
        report(windowStatus, '无法关闭子窗口')
        updateButtons()
      }
    }, { signal: abort.signal })
    report(windowStatus, '准备就绪')
    updateButtons()
  }).catch(() => {
    report(searchStatus, '请从 WebTools 打开插件来使用宿主子输入')
    report(windowStatus, '请从 WebTools 打开插件来创建子窗口')
  })
}

mountStarterDemo(document.querySelector<HTMLElement>('#starter-demo')!)
