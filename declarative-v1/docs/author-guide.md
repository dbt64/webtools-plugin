# WebTools 插件作者指南

这份指南覆盖 WebTools Windows 宿主和配套开发工具 1.16.2。第一次做插件，先用 **Manifest v3 + Web** 创建一个无需 Node 权限的插件。需要 Node preload、原生模块或无界面命令时再选择 **v3 + Node**。维护旧的声明式页面时继续使用 **Manifest v1**。

| 你要做什么 | 从哪里开始 |
| --- | --- |
| 从零创建一个插件并在 WebTools 中打开 | [快速开始](author-quickstart.md) |
| 声明功能入口、选区匹配、运行时和权限 | [Manifest 与启动上下文](author-manifest.md) |
| 查 API、处理窗口生命周期、使用统一 UI | [SDK API 与运行时](author-runtime.md) |
| 模拟入口、排查问题、打包和发布更新 | [调试、分发与常见错误](author-workflow.md) |
| 找一个已有的插件照着改 | [可运行示例](author-examples.md) |

这里的 **Feature** 是用户实际打开或执行的一项功能。一个插件包可以有多个 Feature，分别接受不同的内容、申请不同的权限。**宿主**是已安装的 WebTools，负责窗口、权限、持久化和调用。**SDK** 是作者在项目里安装的开发依赖和公开接口。插件版本、Manifest、SDK 和最低宿主版本各有各的作用，见[版本与兼容](version-compatibility.md)。

详细专题包括[窗口和桌面能力](p4-api-guide.md)、[私有存储与备份](plugin-storage-guide.md)、[后台定时任务](p5-scheduled-tasks.md)、[浏览器与媒体处理](p5-browser-media.md)。从 npm SDK 包解压时，这些页面都位于 `docs/`。
