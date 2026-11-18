# 插件生命周期、窗口和桌面 API

本文面向 Manifest v3 的插件作者，介绍生命周期、窗口和桌面能力。打包、完整 Manifest 和其他能力见 [插件作者指南](author-guide.md)。使用新接口需要包含该能力的宿主，并检查实际授权。SDK 发布版本和宿主产品版本分别记录。

## 连接和权限

Web 插件页面从 `@webtools/plugin-sdk/web` 导入 `connectWebTools`，等待连接后使用接口：

```js
import { connectWebTools } from '@webtools/plugin-sdk/web'

const host = connectWebTools()
await host.ready
```

需要授权的接口，在 Manifest 的 `requestedCapabilities` 和使用它的 Feature 的 `requiredCapabilities` 中都要声明；安装或更新时用户还需授权。不同 Feature 的权限可能不同，即使它们打开的是同一个页面，也应按当前 Feature 检查可用能力。可选命名空间如 `host.files`、`host.clipboard`、`host.system`、`host.windows` 使用前应确认存在；调用仍可能因为未授权或宿主版本不支持而失败。捕获错误时可以使用错误对象的 `code`，例如 `PERMISSION_DENIED`、`NOT_AVAILABLE`、`USER_CANCELLED`。

示意片段（合并到实际 Manifest 的相应位置，不能作为完整 Manifest 使用）：

```json
{
  "requestedCapabilities": ["system.file.select", "system.path.open"],
  "features": [{
    "requiredCapabilities": ["system.file.select", "system.path.open"]
  }]
}
```

## 生命周期与上下文

`host.lifecycle.onInitialize/onEnter/onShow/onHide/onClose` 分别用于初始化、进入、显示、隐藏与连接关闭通知；订阅方法返回取消订阅函数。`host.context.current()` 返回当前调用上下文或 `null`，`host.context.onChange` 订阅上下文变更。

```js
const stopEnter = host.lifecycle.onEnter(async () => {
  const context = await host.context.current()
  // 根据 context.type 判断 text、files 或 directories，再更新页面。
})
const stopHide = host.lifecycle.onHide(() => { /* 暂停不需要的刷新 */ })
const stopClose = host.lifecycle.onClose(() => { /* 同步释放页面持有的资源 */ })
await host.lifecycle.ready
// 不再需要订阅时调用 stopEnter()、stopHide()、stopClose()。
```

失焦隐藏并不结束插件页面，页面状态可在召回时保留；再次显式进入同一 Feature 时会更新上下文。结束运行会关闭该 Feature 的运行实例及其拥有的子窗口。不要把关闭回调当作可靠的异步保存机会：崩溃或强制终止不保证回调执行，宿主也不会等待关闭回调里的异步工作。

## 文件、剪贴板和原应用

| 能力 | Web 页面接口 | 权限 |
| --- | --- | --- |
| 选择文件或文件夹 | `host.files.select({ kind: 'file' 或 'directory', multiple })` | `system.file.select` |
| 用系统程序打开本地路径 | `host.files.openPath(path)` | `system.path.open` |
| 读取当前剪贴板 | `host.clipboard.readText/readImage/readFiles()` | `clipboard.current.read` |
| 写入剪贴板 | `host.clipboard.writeText/writeImage/writeFiles(...)` | `clipboard.write` |
| 粘贴文字到打开插件前的应用 | `host.system.pasteText(text)` | `system.input.paste` |

例如，让用户选择并打开文件：

```js
openButton.addEventListener('click', async () => {
  if (!host.files) return
  const paths = await host.files.select({ kind: 'file', multiple: false })
  if (paths.length > 0) await host.files.openPath(paths[0])
})
```

取消选择返回空数组。`readImage()` 返回 PNG data URL 或 `null`，`readFiles()` 返回文件或文件夹路径数组；把路径写入剪贴板使用 `writeFiles(paths)`。`pasteText` 会尝试返回原前台应用并替换系统剪贴板内容，再执行粘贴；应在用户明确触发操作时调用。打开 HTTP(S) 链接使用现有 `external.open` 能力；Node 命令可使用 `invocation.webtools.external?.open(url)`，应声明并获授 `external.open`。

## 通知和屏幕

授权 `system.notification` 后可调用 `host.system.notify(title, body)`。授权 `system.screen.capture` 后，可用 `getDisplays()` 查询显示器信息和 DIP 坐标，用 `captureScreen({ displayId })` 获取 PNG data URL；省略 ID 截取主显示器。截图必须由插件页面当前的明确用户操作触发，Windows 通知是否显示则取决于系统通知设置。

## 插件子窗口

声明并获得 `plugin.window.manage` 后，插件可创建属于当前 Feature 的子窗口：

```js
if (host.windows) {
  const { id } = await host.windows.create({ title: '预览', width: 640, height: 480 })
  await host.windows.show(id)
  // 之后可调用 host.windows.hide(id)、setBounds(id, bounds)、
  // setAlwaysOnTop(id, true)、postMessage(id, data) 或 close(id)。
}
```

`windows.currentId`、`onMessage`、`onClosed` 用于区分窗口和收发消息；监听方法返回取消订阅函数。默认 `chrome: 'host'` 使用宿主标题栏；也可选择 `native` 或 `frameless`，后者需要插件提供自己的拖动和关闭控件。子窗口由所属 Feature 管理，其主 Feature 结束时一并关闭。

## 快捷键与兼容性

用户可在插件管理中为某个 Feature 设置全局快捷键；插件通过 `host.shortcuts.current()` 读取当前 Feature 的绑定或 `null`，不能通过这个接口自行注册快捷键。用户可选择是否带入选区；不匹配的选区不会作为其他类型传入插件。一个功能可以声明多种 `acceptedContexts`，不必为每种内容绑定一个按键。截图工具里的位图选区与图片文件路径不同，当前快捷键入口不保证接收位图。

旧 SDK 页面不需要订阅新生命周期事件才能使用已有接口；旧配置缺少快捷键选区选项时默认为关闭。Manifest v1 继续走原有声明式兼容路径；Manifest v2 已退役，需重新打包为 v3。新接口不能凭插件 SDK 自行补进旧宿主，使用新能力时应部署支持该能力的配套宿主，并按实际授权处理不可用情况。Node 无界面命令使用 `@webtools/plugin-sdk/node` 的 `defineCommand` 和 `invocation.webtools`，其接口集合不同于 Web 页面，不应假定存在 `host.windows` 或全部桌面 API。
