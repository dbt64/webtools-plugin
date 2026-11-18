# 浏览器、图片与音视频工作流

SDK 1.15.0。对应配套宿主预览 P5-Browser-Media-20261115-r2；旧宿主没有这些可选接口。Manifest v3 在 requestedCapabilities 和使用该接口的 Feature.requiredCapabilities 中声明相应能力，用户在插件管理中授权后重新打开插件。

## 可视浏览器

`system.browser.automation` 提供 `connection.system.browser`（Web 页面）。在用户点击时打开 HTTP(S) 网页：

```js
const { id } = await connection.system.browser.open('https://example.com')
await connection.system.browser.step({ id, action: 'input', selector: '#query', value: '示例' })
await connection.system.browser.step({ id, action: 'click', selector: '#submit' })
const text = await connection.system.browser.step({ id, action: 'text', selector: 'main' })
const png = await connection.system.browser.step({ id, action: 'screenshot' })
await connection.system.browser.close(id)
```

`step` 还支持 `{ id, action: 'navigate', value: 'https://...' }`。CSS 选择器作用于主文档；当前基础接口没有 XPath、iframe 穿透、任意 JavaScript、自动下载与弹窗。元素不存在返回失败；点击触发异步页面更新时，插件应等待业务就绪后继续读取，接口不隐式等待网页业务完成。

每个运行实例最多两个窗口；单个窗口按步骤顺序调用，同一时刻只执行一步。单步最多 15 秒，超时关闭对应浏览器；`step` 支持 `{signal}` 取消，取消会关闭浏览器。返回的 ID 不能在其他运行实例使用。

浏览器可手动操作，打开后普通插件可能因失焦隐藏，召回插件即可查看执行结果。隐藏保留浏览器；结束插件、禁用、运行实例回收会关闭浏览器。网页没有插件 SDK、Node 或宿主 preload。网页登录数据按插件隔离并保留；卸载选择删除数据时一并删除。

## 图片处理

`system.media.image` 提供 `connection.system.image.transform`，也可由 Node Command 的 `webtools.system.image.transform` 调用：

```js
const result = await connection.system.image.transform({
  dataUrl, width: 320, format: 'jpeg', quality: 85,
})
// result: { dataUrl, width, height, bytes }
```

输入 PNG/JPEG/WebP Data URL，输出 PNG 或 JPEG；height 可选，不填保留比例。质量 1–100，默认 85。每边输出最大 4096 像素，源图最多 32M 像素，输入 Data URL 最多 12,000,000 字符，输出最多 8 MiB。动态图片只处理静态图像，不保留动画、EXIF 或专业色彩处理效果。扩展算法可由 Node 插件自行依赖 Sharp 等库实现；普通插件不因此需要安装它们。

## 音视频转换

`system.media.transcode` 提供 `connection.system.media.transcode`（有界面的 Feature）：

```js
const controller = new AbortController()
const result = await connection.system.media.transcode(
  { inputPath, format: 'mp3' }, { signal: controller.signal },
)
// 点击后显示宿主保存对话框；取消选择返回 null，完成返回 { path }。
// controller.abort() 取消正在运行的转换。
```

宿主内置 FFmpeg 6.1.1 Windows x64，通过独立进程执行；插件不需要携带该大依赖。固定输出 WAV（PCM）、MP3、MP4（H.264/AAC）、WebM（VP9/Opus），输入支持情况由内置 FFmpeg 决定。不开放任意命令行参数。

每窗口同时一次转换，最长两分钟；隐藏时继续，结束插件或取消会停止进程。转换先写同目录临时文件，成功后才替换用户选定目标；失败/取消清理临时文件并保留原目标。禁止用目标覆盖源文件。复杂剪辑、Sharp 全部算子、任意 FFmpeg 参数仍由信任的 Node 插件自身依赖实现；这不构成 Node 代码的系统沙箱。

FFmpeg 二进制的 GPLv3 许可、构建说明与源码地址随依赖和预览交付，见 THIRD-PARTY/ffmpeg。

## 可操作示例

`examples/plugins/platform-playground` 1.18.0 页面最上方包含三项工作流。示例网页由此 Node 插件自身提供本地静态 HTTP 页面，不依赖外部网站或登录。插件页面和 MCP 工具继续共用同一插件及已有数据。
