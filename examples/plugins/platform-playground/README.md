# Plugin Platform Playground

这是 WebTools 可复用的 Manifest v3 验收插件，覆盖生命周期、窗口、上下文及 P5 私有存储、定时提醒、共享 AI、MCP 工具、浏览器和媒体工作流。插件还包含宿主搜索子输入、剪贴板、粘贴、系统通知、屏幕截图、自定义窗口和可选 UI 样式示例。

共享 AI 验收区域通过 `sharedAI.complete` 请求 WebTools 宿主调用其已配置的 AI 服务。请求经过宿主能力授权和逐次确认，服务配置与凭据由宿主管理；插件不直接连接 AI 服务商，也不会读取 API 密钥。本区域验证共享 AI；同插件的 MCP 样例由独立的 `agent-note` 工具提供。

计数与上下文卡片用于观察页面内存状态和本次调用收到的数据；“插件数据存储”区域单独演示持久化 JSON、文件与备份。插件存储只属于 `org.webtools.plugin-platform-playground`，不读取其他插件或 WebTools 设置。

## 构建与安装

在 `webtools-rs` 仓库根目录构建与验证：

```powershell
pnpm --dir examples/plugins/platform-playground run build
pnpm --dir examples/plugins/platform-playground run validate
pnpm --dir examples/plugins/platform-playground run pack
pnpm --dir examples/plugins/platform-playground run inspect
```

当前验收包版本为 `1.18.0`，包名为 `webtools-plugin-platform-playground-1.18.0.wtplugin`。它沿用稳定的插件 ID，因此从旧版本升级时应继续看到同一份插件数据。SDK 浏览器运行时代码与 CSS 从仓库当前 SDK 源码复制到构建目录。

P5 五类样例已经分批交付并经过用户验收；完整对应关系与证据见 [P5 结项记录](https://github.com/dbt64/webtools-rs/blob/main/docs/p5-completion.md)。浏览器、图片与音视频操作入口位于页面顶部，实现见 `web/workflow.mjs`，API 与限制见 [工作流指南](../../../declarative-v1/docs/p5-browser-media.md)。定时任务另可在配套宿主的“设置 → 定时任务”统一查看、展开日志与删除。

## P5 共享 AI 调用验收

1. 在配套新版 WebTools 的插件中心安装或更新本插件，并允许 `sharedAI.complete` 能力。
2. 在 WebTools 中配置一个共享 AI 服务，然后打开主功能“插件平台验收”。
3. 在“共享 AI 调用验收”区域输入一条简短请求并点击“发送至共享 AI”；在宿主确认窗口中允许本次请求，确认插件显示宿主返回的文本。
4. 再发送一次并在宿主确认窗口中取消，确认插件显示“宿主确认已取消”，不会显示 AI 结果。
5. 请求进行中点击“取消请求”，确认插件请求结束并显示取消状态。取消会中断插件到宿主的请求链路，但不保证服务商侧已经停止处理或计费。
6. 可选错误检查：未配置共享 AI 服务时应显示服务不可用；未授权能力时应显示权限提示；空输入不会发出请求。

这个验收只调用已存在的 `connection.ai.complete({ prompt }, { signal })`。它不会验证插件注册 MCP 工具，也不会让插件选择或读取 AI 服务凭据。

## P5 定时任务验收

新增顶部“定时任务验收”区域，需授权 `plugin.tasks`。提供 30 秒后执行一次、五字段 Cron 周期（可选起止时间）、逐项宿主确认、任务列表、删除、成功失败统计以及故意抛出异步错误的按钮。回调将结果写入插件私有 `schedule-history`，成功时发送通知。关闭窗口后 Rust 托盘仍可唤醒临时插件运行环境。

完整 API、重启/暂停规则、人工步骤及真实宿主自动化方法参阅仓库 `plugin-sdk/declarative-v1/docs/p5-scheduled-tasks.md`。一次任务完成后保留统计历史，删除记录后才能使用相同代码重新创建；停用/卸载/撤权会暂停计划，重新启用后需重新创建确认。

在配套新版 WebTools 的**插件中心**安装或更新此 `.wtplugin`。安装/更新时检查并授权插件声明的能力；测试存储时需要允许 `plugin.storage.read` 和 `plugin.storage.write`。没有授权时页面会显示宿主返回的错误。

## P5 插件私有存储验收

### JSON 键值

1. 打开“插件数据存储”，键名使用 `p5-note`，值输入 `第一份数据`，点击“保存”。
2. 点击“读取”，确认读回 `第一份数据`；点击“列出键名”，确认出现 `p5-note`。
3. 把值改为 `更新后的数据` 并再次保存、读取；确认新值覆盖旧值。点击“删除”后再读取，确认该键已不存在。

### 插件文件

1. 选择一个小于 4 MiB 的本地文件，插件内路径使用 `attachments/sample.bin`，点击“保存所选文件”。
2. 路径前缀填写 `attachments/` 并点击“列出文件”，确认显示保存的路径和大小。
3. 点击“读取并下载”，比较下载文件与原文件。之后点击“删除此文件”，再次列出并确认它已移除。

### 备份与恢复

1. 保存键 `p5-note=备份前` 和文件 `attachments/sample.bin`，点击“导出备份”并保存下载的 JSON。
2. 修改 `p5-note` 为 `备份后`，再新增键 `p5-newer` 和文件 `attachments/newer.bin`。
3. 点击“选择备份并导入”，选择刚导出的 JSON，并在替换确认框中确认。
4. 读取 `p5-note` 应恢复为 `备份前`；列出键和文件时，备份之后新增的 `p5-newer`、`attachments/newer.bin` 应消失。这是整套 SDK 存储数据的替换恢复，不是合并。

### 隐藏、重启与卸载保留

1. 保存一份 JSON 值和文件，隐藏并重新打开插件；再退出插件并重新进入，确认两者仍存在。需要验证完整重启时，可正常退出并重新启动 WebTools 后再进入插件。
2. 在插件中心卸载**此验收插件**并选择保留私有数据；用相同插件 ID 重装后，确认原数据仍在。
3. 再次卸载此验收插件并选择删除私有数据。删除只针对该验收插件的私有数据、配置和 Node 本地数据目录。

导入备份会覆盖当前验收插件的 SDK JSON 键值与 SDK 文件。备份不含 Manifest `config`、共享 AI 凭据或 Node `localDataDirectory`；不要使用其他插件的备份进行此项验收。

## 既有平台验收

- 搜索 `插件测试` 从搜索框打开，查看输入上下文；隐藏后重新召回，确认输入与计数在页面复用期间保留。按 Esc 结束当前插件，再次进入后页面内计数重新开始。
- 在任意应用选中文字后从 Super Panel 打开插件，查看选中文字并尝试“填入输入框”。在资源管理器选中文件或文件夹后从 Super Panel 打开，查看相应项目类型和路径。
- 点击“打开搜索”，输入 `插件开发文档`；用方向键和 Enter 选择结果，确认宿主输入与动态结果回到插件页面。再试不存在的词与 Esc，并用中文输入法提交候选词。
- 测试标题栏的宿主菜单、分离窗口、可选 UI 浅色预览、Host 主题切换、屏幕缩放下布局、剪贴板读写、系统通知、屏幕信息与截图、自定义子窗口和向原应用粘贴。各项是否可用取决于其单独声明的 capability 授权。

本插件只是平台验收工具，不会替宿主授权，也不覆盖真实 Windows 交互的人工验收。存储 API 的完整说明见 SDK 的 [插件私有存储指南](../../../declarative-v1/docs/plugin-storage-guide.md)；P4 生命周期 API 见 [P4 API 指南](../../../declarative-v1/docs/p4-api-guide.md)。

## MCP 工具

1.17.0 在原验收插件内增加 AI 便笺工具。服务由 WebTools 设置内提供，插件声明 agent-note 并导出 agent-note.cjs。见 docs/p5-builtin-mcp-agent-connection.md。此版本使用 Node+Web 混合运行时，便于 UI 与命令共享私有存储。
