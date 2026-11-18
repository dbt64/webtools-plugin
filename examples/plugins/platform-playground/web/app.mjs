import { connectWebTools } from './sdk/index.mjs'

const $ = selector => document.querySelector(selector)
const input = $('#plugin-input')
const inputCount = $('#input-count')
const counterOutput = $('#counter-value')
const contextBadge = $('#context-badge')
const contextSummary = $('#context-summary')
const contextContent = $('#context-content')
const applyContextButton = $('#apply-context')
const clearContextButton = $('#clear-context')
const status = $('#status')
const openHostSearchButton = $('#open-host-search')
const searchDemoStatus = $('#search-demo-status')
const themePreviewToggle = $('#theme-preview-toggle')
const themePreview = $('#theme-preview')

const state = { count: 0, context: null, connection: null, searchItems: [
  { id: 'clip-1', title: '剪贴板：WebTools 插件开发文档', description: '最近复制 · 文档片段' },
  { id: 'clip-2', title: '剪贴板：宿主子输入框 API', description: '最近复制 · API 说明' },
  { id: 'clip-3', title: '剪贴板：搜索结果键盘操作', description: '最近复制 · 快捷键笔记' },
  { id: 'clip-4', title: '剪贴板：窗口生命周期验收', description: '最近复制 · 验收清单' },
  { id: 'clip-5', title: '剪贴板：Electron 启动分析', description: '最近复制 · 性能记录' },
] }

themePreviewToggle.addEventListener('change', () => {
  const theme = themePreviewToggle.checked ? 'light' : 'dark'
  themePreview.dataset.previewTheme = theme
  themePreviewToggle.setAttribute('aria-pressed', String(themePreviewToggle.checked))
})

function setStatus(message) {
  status.textContent = message
}

function setInput(value) {
  input.value = value
  updateInputCount()
  input.focus()
  input.setSelectionRange(input.value.length, input.value.length)
}

function updateInputCount() {
  const length = [...input.value].length
  inputCount.textContent = `${length} 字符`
}

function formatContext(context) {
  if (!context) return { label: '无上下文', summary: '本次打开没有携带文字、文件或文件夹。', content: '' }

  if (context.type === 'text') {
    const sourceNames = {
      'launcher-input': '搜索框输入',
      clipboard: '剪贴板',
      'selected-text': '前台选中文字',
    }
    return {
      label: '文字',
      summary: `来源：${sourceNames[context.source] ?? context.source} · ${[...context.text].length} 个字符`,
      content: context.text,
    }
  }

  if (context.type === 'files' || context.type === 'directories') {
    const kind = context.type === 'files' ? '文件' : '文件夹'
    const lines = context.items.map((item, index) => `${index + 1}. [${item.kind}] ${item.path}`)
    return {
      label: kind,
      summary: `来自资源管理器 · ${context.items.length} 个项目`,
      content: lines.join('\n'),
    }
  }

  return { label: '未知上下文', summary: '宿主返回了当前样例无法识别的上下文。', content: JSON.stringify(context, null, 2) }
}

function renderContext(context) {
  state.context = context
  const view = formatContext(context)
  contextBadge.textContent = view.label
  contextSummary.textContent = view.summary
  contextContent.textContent = view.content || '没有携带上下文'
  const hasContext = Boolean(context)
  applyContextButton.disabled = !hasContext
  clearContextButton.disabled = !hasContext
}

input.addEventListener('input', updateInputCount)

$('#increment').addEventListener('click', () => {
  state.count += 1
  counterOutput.textContent = String(state.count)
  setStatus('计数已更新；再次召回窗口时应保留当前状态。')
})

$('#reset-counter').addEventListener('click', () => {
  state.count = 0
  counterOutput.textContent = '0'
  setStatus('计数已重置。')
})

openHostSearchButton.addEventListener('click', async () => {
  if (!state.connection) {
    searchDemoStatus.textContent = '宿主尚未连接，请等待连接完成后重试。'
    return
  }
  openHostSearchButton.disabled = true
  openHostSearchButton.textContent = '正在打开…'
  searchDemoStatus.textContent = '正在请求宿主显示搜索输入框…'
  try {
    await state.connection.subInput.show({ placeholder: '搜索示例剪贴板' })
    searchDemoStatus.textContent = '宿主搜索已打开；可输入内容并用方向键与 Enter 选择。'
    setStatus('宿主搜索已打开；可输入内容并用方向键与 Enter 选择。')
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
    searchDemoStatus.textContent = `无法打开宿主搜索输入${code ? `（${code}）` : ''}。请确认插件窗口仍由 WebTools 宿主管理。`
    setStatus('宿主搜索请求失败；详情已显示在按钮旁。')
  } finally {
    openHostSearchButton.disabled = false
    openHostSearchButton.textContent = '打开搜索'
  }
})

applyContextButton.addEventListener('click', () => {
  if (state.context?.type === 'text') setInput(state.context.text)
  else if (state.context?.items) setInput(state.context.items.map(item => item.path).join('\n'))
  setStatus('上下文已填入插件输入框。')
})

clearContextButton.addEventListener('click', () => {
  renderContext(null)
  setStatus('页面中的上下文展示已清除；不会更改宿主中的原始选择。')
})

async function connect() {
  try {
    const connection = connectWebTools()
    state.connection = connection
    const refreshAgentNote = async () => {
      try { $('#agent-note-value').textContent = await connection.storage.get('agent-note') ?? '尚无 AI 便笺' }
      catch (error) { $('#agent-note-value').textContent = `读取失败：${error?.code ?? error}` }
    }
    $('#agent-note-refresh').addEventListener('click', refreshAgentNote)
    window.addEventListener('focus', refreshAgentNote)

    if (connection.tasks) {
      connection.tasks.onTrigger(async event => {
        // Register at module initialization; this also runs in the hidden,
        // short-lived page opened by a scheduled trigger.
        await new Promise(resolve => setTimeout(resolve, 150))
        const history = await connection.storage.get('schedule-history')
        const failure = event.code.endsWith('-fail')
        const records = [...(Array.isArray(history) ? history : []), { code: event.code, executionId: event.executionId,
          scheduledAtMs: event.scheduledAtMs, finishedAtMs: Date.now(), result: failure ? 'intentional failure' : 'success' }].slice(-30)
        await connection.storage.set('schedule-history', records)
        if (failure) throw new Error('Playground intentional scheduled callback failure')
        await connection.system?.notify('WebTools 定时任务', `任务 ${event.code} 已完成`)
      })
      const refreshTasks = async () => {
        const tasks = await connection.tasks.list()
        const list = $('#task-list'); list.replaceChildren()
        for (const task of tasks) {
          const row = document.createElement('p')
          const text = document.createElement('span')
          text.textContent = `${task.code} · ${task.running ? '执行中' : task.enabled && task.nextRunMs ? `下次 ${new Date(task.nextRunMs).toLocaleString()}` : '已结束'} · 成功 ${task.successes} / 失败 ${task.failures}${task.lastError ? ` · ${task.lastError}` : ''} `
          const cancel = document.createElement('button'); cancel.className = 'button button-secondary'; cancel.textContent = '删除任务'
          cancel.addEventListener('click', async () => { try { await connection.tasks.remove(task.code); await refreshTasks() } catch (error) { $('#task-status').textContent = String(error?.code ?? error) } })
          row.append(text, cancel); list.append(row)
        }
        if (!tasks.length) list.textContent = '没有定时任务'
        const history = await connection.storage.get('schedule-history')
        $('#task-history').textContent = Array.isArray(history) ? history.map(r => `${new Date(r.finishedAtMs).toLocaleString()} · ${r.code} · ${r.result}`).join('\n') : '尚无执行记录'
      }
      const taskAction = (selector, action) => $(selector).addEventListener('click', async () => {
        try { await action(); $('#task-status').textContent = '操作完成'; await refreshTasks() }
        catch (error) { $('#task-status').textContent = `操作失败：${error?.code ?? error?.message ?? error}` }
      })
      const createOnce = failure => connection.tasks.request({ code: `${$('#task-code').value.trim()}${failure ? '-fail' : ''}`,
        description: failure ? '验收：30 秒后故意抛出异步错误' : '验收：30 秒后记录执行并发送通知', schedule: { kind: 'once', atMs: Date.now() + 30000 } })
      taskAction('#task-once', () => createOnce(false))
      taskAction('#task-failure', () => createOnce(true))
      taskAction('#task-recurring', () => connection.tasks.request({ code: $('#task-code').value.trim(), description: '验收：按 Cron 周期记录执行并发送通知',
        schedule: { kind: 'cron', expression: $('#task-cron').value.trim(),
          ...($('#task-start').value ? { startMs: new Date($('#task-start').value).getTime() } : {}),
          ...($('#task-end').value ? { endMs: new Date($('#task-end').value).getTime() } : {}) } }))
      taskAction('#task-refresh', async () => {})
    }
    const lifecycleLog = []
    const recordLifecycle = (label, event) => {
      lifecycleLog.push(`${new Date().toLocaleTimeString()} ${label}${event ? ` · 第 ${event.entryCount} 次进入 · ${event.featureId} · 运行代次 ${event.generation}` : ''}`)
      if (lifecycleLog.length > 16) lifecycleLog.shift()
      $('#lifecycle-log').textContent = lifecycleLog.join('\n')
    }
    let shortcutRead = 0
    const refreshFeatureShortcut = async () => {
      const request = ++shortcutRead
      const output = $('#feature-shortcut')
      try {
        const shortcut = await connection.shortcuts.current()
        if (request === shortcutRead) output.textContent = shortcut || '未设置'
      } catch (error) {
        if (request === shortcutRead) output.textContent = `读取失败（${error?.code ?? 'NOT_AVAILABLE'}）`
      }
    }
    if (connection.lifecycle) {
      connection.lifecycle.onInitialize(() => recordLifecycle('初始化完成'))
      connection.lifecycle.onEnter(event => { recordLifecycle('进入功能', event); void refreshFeatureShortcut() })
      connection.lifecycle.onShow(event => recordLifecycle('显示窗口', event))
      connection.lifecycle.onHide(event => recordLifecycle('隐藏窗口', event))
      connection.lifecycle.onClose(() => recordLifecycle('运行结束'))
      connection.lifecycle.ready.catch(() => recordLifecycle('当前宿主不支持生命周期通知，请使用配套新版平台'))
    }
    await connection.ready
    void refreshFeatureShortcut()
    const sharedAiStatus = $('#shared-ai-status')
    const sharedAiSend = $('#shared-ai-send')
    const sharedAiCancel = $('#shared-ai-cancel')
    const sharedAiResult = $('#shared-ai-result')
    let activeAiController = null
    if (typeof connection.ai?.complete === 'function') {
      sharedAiSend.disabled = false
      sharedAiStatus.textContent = '已连接宿主。点击发送后，宿主会请求确认并调用共享 AI 服务。'
      sharedAiSend.addEventListener('click', async () => {
        const prompt = $('#shared-ai-prompt').value.trim()
        if (!prompt) {
          sharedAiStatus.textContent = '请输入要发送的内容。'
          return
        }
        if (activeAiController) return

        const controller = new AbortController()
        activeAiController = controller
        sharedAiSend.disabled = true
        sharedAiCancel.disabled = false
        sharedAiResult.textContent = '等待宿主确认并返回结果…'
        sharedAiStatus.textContent = '请求已交给宿主；请在宿主确认窗口中选择允许或取消。'
        try {
          const result = await connection.ai.complete({ prompt }, { signal: controller.signal })
          sharedAiResult.textContent = result.text
          sharedAiStatus.textContent = '共享 AI 已返回结果。'
        } catch (error) {
          const code = error?.code ?? 'INTERNAL_ERROR'
          sharedAiResult.textContent = '没有返回结果。'
          if (code === 'CANCELLED') sharedAiStatus.textContent = '本次插件请求已取消；这不保证服务商侧已停止处理。'
          else if (code === 'USER_CANCELLED') sharedAiStatus.textContent = '宿主确认已取消，本次没有取得 AI 结果。'
          else if (code === 'NOT_AVAILABLE') sharedAiStatus.textContent = '宿主没有可用的共享 AI 服务；请先在 WebTools 中配置服务。'
          else if (code === 'PERMISSION_DENIED' || code === 'UNAUTHORIZED') sharedAiStatus.textContent = '插件尚未获准使用 sharedAI.complete；请在插件能力授权中启用。'
          else sharedAiStatus.textContent = `共享 AI 请求失败（${code}）。`
        } finally {
          if (activeAiController === controller) activeAiController = null
          sharedAiSend.disabled = typeof connection.ai?.complete !== 'function'
          sharedAiCancel.disabled = true
        }
      })
      sharedAiCancel.addEventListener('click', () => activeAiController?.abort())
    } else {
      sharedAiStatus.textContent = '当前授权或宿主版本未提供共享 AI 调用。请确认 sharedAI.complete 已授权并使用配套新版 WebTools。'
      sharedAiResult.textContent = '尚无结果'
    }
    const storageStatus = $('#storage-status')
    const storageAction = (selector, action) => $(selector).addEventListener('click', async () => {
      try { await action($('#storage-key').value.trim()); }
      catch (error) { storageStatus.textContent = `操作失败：${error?.code ?? error?.message ?? error}` }
    })
    storageAction('#storage-save', async key => { await connection.storage.set(key, $('#storage-value').value); storageStatus.textContent = `已保存 ${key}` })
    storageAction('#storage-load', async key => { const value = await connection.storage.get(key); $('#storage-value').value = value == null ? '' : String(value); storageStatus.textContent = value == null ? '没有找到该键' : `已读取 ${key}` })
    storageAction('#storage-list', async prefix => { const keys = await connection.storage.list(prefix); storageStatus.textContent = keys.length ? `匹配的键：${keys.join('、')}` : '没有匹配的键' })
    storageAction('#storage-delete', async key => { await connection.storage.delete(key); storageStatus.textContent = `已删除 ${key}` })
    const storageFilesStatus = $('#storage-files-status')
    const storageFilePath = () => $('#storage-file-path').value.trim()
    const reportStorageFileError = error => { storageFilesStatus.textContent = `操作失败：${error?.code ?? error?.message ?? error}` }
    const downloadBytes = (bytes, name) => {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = name || 'plugin-file.bin'; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    $('#storage-file-write').addEventListener('click', async () => {
      try {
        const file = $('#storage-file-input').files?.[0]
        if (!file) throw new Error('请先选择本地文件')
        const path = storageFilePath()
        await connection.storage.files.write(path, new Uint8Array(await file.arrayBuffer()))
        $('#storage-file-input').value = ''
        storageFilesStatus.textContent = `已保存 ${file.name} 到 ${path}（${file.size} 字节）。如修改本地文件，请重新选择并保存。`
      } catch (error) { reportStorageFileError(error) }
    })
    $('#storage-file-read').addEventListener('click', async () => {
      try {
        const path = storageFilePath()
        const bytes = await connection.storage.files.read(path)
        if (!bytes) { storageFilesStatus.textContent = `没有找到 ${path}`; return }
        downloadBytes(bytes, path.split('/').pop())
        storageFilesStatus.textContent = `已读取 ${path}（${bytes.byteLength} 字节），浏览器已开始下载`
      } catch (error) { reportStorageFileError(error) }
    })
    $('#storage-file-delete').addEventListener('click', async () => {
      try { const path = storageFilePath(); await connection.storage.files.delete(path); storageFilesStatus.textContent = `已删除 ${path}` }
      catch (error) { reportStorageFileError(error) }
    })
    $('#storage-file-list').addEventListener('click', async () => {
      try {
        const files = await connection.storage.files.list($('#storage-file-prefix').value.trim())
        storageFilesStatus.textContent = files.length ? files.map(file => `${file.path}（${file.size} 字节）`).join('；') : '没有匹配的文件'
      } catch (error) { reportStorageFileError(error) }
    })
    const storageBackupStatus = $('#storage-backup-status')
    $('#storage-backup-export').addEventListener('click', async () => {
      try {
        const backup = await connection.storage.backup.export()
        const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
        const anchor = document.createElement('a')
        anchor.href = url; anchor.download = `webtools-plugin-storage-${backup.pluginId}.json`; anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        storageBackupStatus.textContent = `已导出 ${Object.keys(backup.data).length} 个键和 ${backup.files.length} 个文件`
      } catch (error) { storageBackupStatus.textContent = `导出失败：${error?.code ?? error?.message ?? error}` }
    })
    const storageBackupInput = $('#storage-backup-input')
    $('#storage-backup-pick').addEventListener('click', () => storageBackupInput.click())
    storageBackupInput.addEventListener('change', async () => {
      const file = storageBackupInput.files?.[0]
      if (!file) return
      try {
        const backup = JSON.parse(await file.text())
        if (!window.confirm('导入会替换此插件当前的键值数据和文件。要继续吗？')) return
        await connection.storage.backup.import(backup)
        storageBackupStatus.textContent = `已从 ${file.name} 恢复插件数据和文件`
      } catch (error) { storageBackupStatus.textContent = `导入失败：${error?.code ?? error?.message ?? error}` }
      finally { storageBackupInput.value = '' }
    })
    $('#paste-send').addEventListener('click', async () => {
      const status = $('#paste-status')
      try { if (!connection.system) throw new Error('请使用配套新版平台并授予粘贴权限'); await connection.system.pasteText($('#paste-text').value); status.textContent = '已向原应用发送粘贴' }
      catch (error) { status.textContent = `粘贴失败：${error?.code ?? error?.message ?? error}` }
    })
    $('#notification-send').addEventListener('click', async () => {
      const status = $('#notification-status')
      try { if (!connection.system) throw new Error('请使用配套新版平台并授予系统通知权限'); await connection.system.notify('WebTools 插件通知', '系统通知能力测试成功'); status.textContent = '已发送，请查看 Windows 通知' }
      catch (error) { status.textContent = `操作失败：${error?.code ?? error?.message ?? error}` }
    })
    const screenDisplay = $('#screen-display')
    const screenStatus = $('#screen-status')
    const readDisplays = async () => {
      try {
        if (!connection.system) throw new Error('请使用配套新版平台并授予屏幕能力')
        const displays = await connection.system.getDisplays()
        screenDisplay.replaceChildren(new Option('主显示器', ''))
        for (const display of displays) {
          const label = `${display.primary ? '主显示器 · ' : ''}${display.label} · ${display.bounds.width}×${display.bounds.height} DIP · ${display.scaleFactor}x`
          screenDisplay.append(new Option(label, display.id))
          if (display.primary) screenDisplay.value = display.id
        }
        screenStatus.textContent = displays.length
          ? `已读取 ${displays.length} 台显示器；坐标与尺寸使用 DIP。`
          : '当前没有可用显示器。'
      } catch (error) { screenStatus.textContent = `读取失败：${error?.code ?? error?.message ?? error}` }
    }
    $('#screen-refresh').addEventListener('click', () => { void readDisplays() })
    $('#screen-capture').addEventListener('click', async () => {
      try {
        if (!connection.system) throw new Error('请使用配套新版平台并授予屏幕能力')
        const input = screenDisplay.value ? { displayId: screenDisplay.value } : {}
        const image = await connection.system.captureScreen(input)
        const preview = $('#screen-preview')
        preview.src = image
        preview.style.display = 'block'
        screenStatus.textContent = '屏幕截图已完成。'
      } catch (error) { screenStatus.textContent = `截图失败：${error?.code ?? error?.message ?? error}` }
    })
    void readDisplays()
    let selectedPath = ''
    let clipboardImage = null
    const clipboardStatus = $('#clipboard-status')
    const clipboardAction = (selector, action) => $(selector).addEventListener('click', async () => {
      try { if (!connection.clipboard) throw new Error('请使用配套新版平台并授予剪贴板权限'); await action(connection.clipboard) }
      catch (error) { clipboardStatus.textContent = `操作失败：${error?.code ?? error?.message ?? error}` }
    })
    clipboardAction('#clipboard-read-text', async api => { const text = await api.readText(); $('#clipboard-text').value = text; clipboardStatus.textContent = text ? '已读取文字' : '剪贴板没有文字' })
    clipboardAction('#clipboard-write-text', async api => { await api.writeText($('#clipboard-text').value); clipboardStatus.textContent = '已复制文字' })
    clipboardAction('#clipboard-read-image', async api => { clipboardImage = await api.readImage(); const img = $('#clipboard-image'); img.style.display = clipboardImage ? 'block' : 'none'; if (clipboardImage) img.src = clipboardImage; clipboardStatus.textContent = clipboardImage ? '已读取图片' : '剪贴板没有图片' })
    clipboardAction('#clipboard-write-image', async api => { if (!clipboardImage) throw new Error('请先读取图片'); await api.writeImage(clipboardImage); clipboardStatus.textContent = '已复制图片' })
    clipboardAction('#clipboard-read-files', async api => { const paths = await api.readFiles(); clipboardStatus.textContent = paths.length ? `已读取：${paths.join('；')}` : '剪贴板没有文件' })
    clipboardAction('#clipboard-write-files', async api => { if (!selectedPath) throw new Error('请先在下方选择文件或文件夹'); await api.writeFiles([selectedPath]); clipboardStatus.textContent = `已复制：${selectedPath}` })
    const filesStatus = $('#files-status')
    const selectPath = kind => async () => {
      try {
        if (!connection.files) throw new Error('请使用配套新版平台并授予文件权限')
        const paths = await connection.files.select({ kind })
        if (!paths.length) { filesStatus.textContent = '已取消选择'; return }
        selectedPath = paths[0]; filesStatus.textContent = `已选择：${selectedPath}`
      } catch (error) { filesStatus.textContent = `选择失败：${error?.code ?? error?.message ?? error}` }
    }
    $('#choose-file').addEventListener('click', selectPath('file'))
    $('#choose-folder').addEventListener('click', selectPath('directory'))
    $('#open-selected-path').addEventListener('click', async () => {
      try {
        if (!selectedPath) { filesStatus.textContent = '请先选择文件或文件夹'; return }
        await connection.files.openPath(selectedPath); filesStatus.textContent = `已打开：${selectedPath}`
      } catch (error) { filesStatus.textContent = `打开失败：${error?.code ?? error?.message ?? error}` }
    })
    const windows = connection.windows
    let childId = null
    let pinned = false
    const windowStatus = $('#window-status')
    if (windows) {
      windowStatus.textContent = windows.currentId === 'main' ? '主窗口已就绪' : '这是子窗口，可向主窗口发送文字'
      windows.onMessage(event => { windowStatus.textContent = `收到来自 ${event.from} 的消息：${event.data}` })
      windows.onClosed(id => { if (id === childId) childId = null; windowStatus.textContent = `窗口已关闭：${id}` })
      const run = (selector, task) => $(selector).addEventListener('click', async () => {
        try { await task() } catch (error) { windowStatus.textContent = `操作失败：${error?.code ?? error?.message ?? error}` }
      })
      run('#window-create', async () => {
        if (childId) { await windows.show(childId); windowStatus.textContent = '已显示现有子窗口'; return }
        const button = $('#window-create'); button.disabled = true
        try { const child = await windows.create({ title: '插件子窗口验收', width: 640, height: 480, document: 'web/child.html' }); childId = child.id; windowStatus.textContent = `子窗口已打开：${childId}` }
        finally { button.disabled = false }
      })
      run('#window-send', async () => { const target = windows.currentId === 'main' ? childId : 'main'; if (!target) throw new Error('请先打开子窗口'); await windows.postMessage(target, $('#window-message').value); windowStatus.textContent = '文字已发送' })
      run('#window-hide', async () => { if (!childId) throw new Error('请先打开子窗口'); await windows.hide(childId); windowStatus.textContent = '子窗口已隐藏' })
      run('#window-show', async () => { if (!childId) throw new Error('请先打开子窗口'); await windows.show(childId); windowStatus.textContent = '子窗口已显示' })
      run('#window-resize', async () => { if (!childId) throw new Error('请先打开子窗口'); await windows.setBounds(childId, { x: 100, y: 100, width: 760, height: 540 }); windowStatus.textContent = '已调整子窗口位置和尺寸' })
      run('#window-top', async () => { if (!childId) throw new Error('请先打开子窗口'); pinned = !pinned; await windows.setAlwaysOnTop(childId, pinned); windowStatus.textContent = pinned ? '子窗口已置顶' : '子窗口已取消置顶' })
      run('#window-close', async () => { if (!childId) throw new Error('请先打开子窗口'); await windows.close(childId); windowStatus.textContent = '正在关闭子窗口' })
    } else windowStatus.textContent = '当前宿主不支持窗口能力，请使用配套版本并授予权限。'
    $('#runtime-badge').textContent = '宿主已连接'
    $('#runtime-badge').classList.add('badge-connected')
    let contextRequest = 0
    const refreshContext = async () => {
      const request = ++contextRequest
      try {
        const context = await connection.context.current()
        if (request === contextRequest) renderContext(context)
      } catch {
        if (request === contextRequest) { renderContext(null); contextSummary.textContent = '读取本次上下文失败。' }
      }
    }
    connection.context.onChange(() => { void refreshContext() })
    await refreshContext()
    connection.subInput.onChange((value, revision) => {
      const query = value.trim().toLocaleLowerCase()
      const items = query
        ? state.searchItems.filter(item => `${item.title} ${item.description}`.toLocaleLowerCase().includes(query))
        : []
      void connection.results.update({ query: value, revision, items })
    })
    connection.results.onSelect(selection => {
      const selectedText = `${selection.item.title}\n${selection.item.description}`
      $('#search-demo-selection').textContent = selectedText
      setInput(selectedText)
      setStatus(`已选择动态结果：${selection.item.title}`)
      void connection.subInput.hide()
    })
    setStatus('插件页面已连接，当前上下文来自本次 Feature 调用。')
  } catch (error) {
    $('#runtime-badge').textContent = '宿主未连接'
    contextBadge.textContent = '读取失败'
    contextSummary.textContent = '请从 WebTools 宿主打开此 Feature。'
    contextContent.textContent = error instanceof Error ? error.message : 'WebTools Bridge unavailable'
    searchDemoStatus.textContent = '宿主连接失败，当前无法打开宿主搜索输入。'
    setStatus('未能连接插件宿主；离开 WebTools 直接打开本页面时会出现此提示。')
  }
}

void connect()
