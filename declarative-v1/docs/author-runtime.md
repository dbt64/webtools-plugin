# SDK API 与运行时

[返回作者指南](author-guide.md)

## Web 页面

在 Web 入口导入 `connectWebTools`，等待 `ready` 后调用。可选命名空间需要存在才可使用，具体方法仍由宿主检查当前 Feature、授权和用户操作。例如某个 Feature 开启了窗口权限，另一个 Feature 复用同一页面，也可能没有这项权限。

```js
import { connectWebTools } from '@webtools/plugin-sdk/web'

const host = connectWebTools()
const output = document.querySelector('#output')
const lifetime = new AbortController()
let revision = 0

function refreshContext() {
  const current = ++revision
  void host.context.current({ signal: lifetime.signal }).then(context => {
    if (current !== revision || lifetime.signal.aborted) return
    output.textContent = context?.type === 'text' ? context.text : '本次没有文字输入'
  }).catch(error => {
    if (current === revision && !lifetime.signal.aborted) output.textContent = error.code ?? '读取失败'
  })
}

try {
  await host.ready
  const unsubscribe = host.context.onChange(refreshContext)
  host.onClose(() => {
    lifetime.abort()
    unsubscribe()
  })
  refreshContext()
} catch {
  output.textContent = '请在 WebTools 中打开此插件'
}
```

在对应 HTML 中放置 `<p id="output"></p>`。上下文会随再次进入而更新。把路径或选中文字作为文本渲染，并用请求序号避免慢响应覆盖最新上下文。

| 想要做的事 | 公共接口 | 还需要什么 |
| --- | --- | --- |
| 读取入口内容和绑定的快捷键 | `context.current/onChange`、`shortcuts.current` | 匹配 Feature 声明。快捷键由用户配置 |
| 显示宿主子输入和动态结果 | `subInput.show/onChange/hide`、`results.update/clear/onSelect` | 用输入事件给出的原始 `query` 和 `revision` 发布结果。异步处理时丢弃过期响应 |
| 带类型设置 | `config.get/set` | `configuration` 声明及对应 `plugin.config.read/write` |
| 私有 JSON、文件和备份 | `storage`、`storage.files`、`storage.backup` | 对应 `plugin.storage.read/write`；导入备份前说明替换范围 |
| 子窗口与消息 | `windows.create/show/hide/close/postMessage`、`onMessage/onClosed` | `plugin.window.manage`；子窗口随所属 Feature 结束 |
| 选择、打开文件 | `files.select/openPath` | `system.file.select` 或 `system.path.open`；由用户触发 |
| 剪贴板 | `clipboard.readText/readImage/readFiles` 及对应写入方法 | `clipboard.current.read` 或 `clipboard.write`；按宿主要求确认 |
| 通知、回到原应用粘贴、显示器与截图 | `system.notify/pasteText/getDisplays/captureScreen` | 分别使用 `system.notification`、`system.input.paste`、`system.screen.capture` |
| 受控浏览器和媒体处理 | `system.browser`、`system.image`、`system.media` | 对应能力声明与用户操作，详见[工作流指南](p5-browser-media.md) |
| 调用宿主共享 AI | `ai.complete({ prompt })` | `sharedAI.complete`、宿主已配置服务和用户确认 |
| 登记、查看、删除定时任务 | `tasks.request/list/remove/onTrigger` | `plugin.tasks` 和用户确认，详见[定时任务指南](p5-scheduled-tasks.md) |

方法签名和错误码见 [Web SDK 类型](../web/index.d.ts)。[窗口和桌面 API](p4-api-guide.md)提供授权、返回值和前台触发细节。[私有存储指南](plugin-storage-guide.md)解释设置、备份和 Node 本地目录的边界。

## 生命周期和资源

| 事件 | 建议动作 |
| --- | --- |
| `onInitialize` | 初始化页面需要的状态；打开后可使用 `ready` 等待连接 |
| `onEnter` | 重新读取此次调用上下文，包括复用已有窗口时的新输入 |
| `onShow` | 恢复页面可见时才需要的刷新 |
| `onHide` | 暂停刷新，保留仍有用的页面状态 |
| `onClose` | 取消请求、事件订阅、定时器和自有资源 |

窗口隐藏后可能继续存在。结束运行会销毁该运行实例和它拥有的子窗口。用户认为已保存的数据应在保存动作成功时持久化，关闭回调里的异步工作没有完成保证。需要在插件页面关闭后继续到点运行时，使用宿主的[定时任务](p5-scheduled-tasks.md)。

## 视觉与窗口

```js
import '@webtools/plugin-sdk/ui.css'
```

模板已引入共享样式。可以直接使用 `wt-container`、`wt-stack`、`wt-card`、`wt-button`、`wt-field` 和 `wt-input`。只需要颜色等主题变量时，改用 `@webtools/plugin-sdk/theme.css`。使用自有 CSS 时，保留标签、键盘焦点、可读对比度和错误提示。分别检查宿主深浅色、窄窗口及文字缩放。

`windows.create({ document: 'web/child.html', title })` 要求子页面位于包内。默认使用宿主标题栏。业务上只需一个辅助窗时保存返回的 ID，重复点击时显示原窗口，收到 `onClosed` 后清理 ID。

## Node preload 与命令

Node 构建产物从插件包读取，用户数据写到 `getPluginPaths(__dirname).localDataDirectory`。需要向页面暴露能力时，用 preload 提供窄接口，检测每个参数。Node 插件以当前 Windows 用户权限运行，只有确实需要 Node 时才选择该运行时。

模板把命令源放在 `assets/normalize-selection.cjs`，构建把它复制到 `resources/` 并作为 `node-command` 归档。对应 Feature 在超级面板选中文字后运行，命令可向面板返回有界文本结果：

```js
module.exports = ({ context, signal }) => {
  signal.throwIfAborted()
  if (context?.type !== 'text' || context.source !== 'selected-text') return
  const text = context.text.replace(/[\s\u0000-\u001f]+/gu, ' ').trim()
  if (text) return { kind: 'text', text: Array.from(text).slice(0, 8192).join('') }
}
```

通过 `invocation.webtools` 使用这个运行时支持的宿主能力，详见 [Node SDK 类型](../node.d.mts)。普通命令无 DOM，运行完成后释放自有资源。定时运行用 `invocation.task`。MCP 工具声明 `mcpTool.inputSchema` 及可选 `outputSchema`，读取 `invocation.mcpInput` 并返回 JSON 对象。它与页面上的共享 AI 调用是两个入口，[示例页](author-examples.md)有可运行的 MCP 验收插件。
