# 调试、分发与常见错误

[返回作者指南](author-guide.md)

## 用真实宿主调试

从项目根目录启动 `npm run dev` 或 `pnpm dev`，再在插件中心连接开发项目。开发面板可以模拟 Manager 无上下文、Launcher 输入、超级面板的选中文字/文件/目录。选择匹配 `acceptedContexts` 的 Feature，再打开它。模拟路径用于验证匹配和传参，真实文件操作仍须通过正常入口和权限验证。

保存源码后，SDK 重建有效版本，宿主重载当前 Feature 并保留这次连接中最近一次成功模拟的输入。编译失败时检查终端的第一条错误和管理中心的开发诊断。保存修复后等待下一次成功构建。断线时重新运行开发命令，再点「重新连接上次项目」并确认授权。因会话切换而打开的页面和模拟输入需重新选择。正式安装的数据与开发项目的数据各自保存。

## 分发和安装更新

1. 从源码完成 `typecheck`、`build`、`validate`、`pack`、`inspect`。验证和打包使用 `dist`，它由构建生成。
2. 分发 `.wtplugin`，同时提供插件用途、最低宿主、平台/架构、需要的权限、安装步骤、版本说明及数据迁移说明。检查归档没有凭据、测试资料或不必要的运行时依赖。
3. 让用户在插件中心选择该本地包安装。宿主复核清单、文件清单及权限；用户确认后再启用。对有原生模块的 Node 插件，在目标 Windows/Electron 实际打开功能。
4. 发布更新时保留插件 ID，提高 `manifest.json` 内的 `version`，重新构建再安装。仅提高 npm 项目的版本不会更新插件包版本。同 ID 更新可保留现有授权的交集和私有数据，新增权限由用户确认。

生成器默认的 pack 脚本使用固定文件名，打包器拒绝覆盖已有文件。发布更新可显式使用新输出名，例如在生成的插件目录执行：

```powershell
npm run build
npm run validate
npm exec -- webtools-plugin pack dist --out notes-demo-1.1.0.wtplugin --host-version 0.1.0 --project-root .
npm exec -- webtools-plugin inspect notes-demo-1.1.0.wtplugin --host-version 0.1.0
```

使用 pnpm 时对应改为 `pnpm build`、`pnpm validate` 和 `pnpm exec webtools-plugin …`。CLI 的 `build`、`validate`、`pack` 和 `inspect` 支持 `--json`，适合构建脚本采集诊断。开发命令是持续运行的进程，使用文本输出来排错。

维护已安装插件时，可兼容的新设置给出默认值并保留旧键。对 v3 配置的兼容增补保持既有 `configuration.schemaVersion`。删掉、改名或改变旧键类型前先提供备份和迁移路径。v1 配置不兼容时宿主拒绝该更新。v3 可显示配置不兼容并保留原值，用户明确重置时会留下原配置备份。SDK 存储备份范围见[私有存储指南](plugin-storage-guide.md)。

## 按现象定位

| 现象或错误 | 优先排查 |
| --- | --- |
| 找不到 SDK 或生成器 | 从指南所在目录开始，核对两个本地 tgz 及相对路径。Node preload 所需 SDK 放在生产依赖 |
| `CREATE_OUTPUT_EXISTS` / `OUTPUT_EXISTS` | 用尚不存在的项目目录名，或为归档使用新的文件名 |
| `INVALID_FIELD` / `INVENTORY_MISMATCH` | 核对 Schema、Feature 的入口文件及 `dist` 中文件清单，清楚区分源码目录和构建输出 |
| `INCOMPATIBLE_PLUGIN` / `NATIVE_ABI_MISMATCH` | 确认 Manifest/API、最低宿主、Windows 架构及 Electron ABI。纯 JavaScript 插件无需填写原生 ABI |
| `DEV_INVALID_CONTEXT` / `DEV_CONTEXT_UNSUPPORTED` | 检查模拟入口、文件路径、数量及 Feature 的 `acceptedContexts` |
| `ready` 失败或页面显示独立预览 | 从 WebTools 打开 Feature，确认开发面板仍连接当前项目 |
| `PERMISSION_DENIED` / `NOT_AVAILABLE` | 核对插件总体声明、对应 Feature 声明、用户授权和宿主实现。能力未提供时回退 |
| `USER_CANCELLED` / `CANCELLED` | 尊重取消并恢复页面状态。需要前台操作的接口由用户主动点击触发 |
| `STALE_RUNTIME` / `RUNTIME_CLOSED` | 停止旧页面的工作，等待当前 Feature 新实例连接后重新读取上下文 |
| `CONFIG_INCOMPATIBLE` | 保持旧值，核对结构版本、键名与类型。需要重置时先向用户说明影响 |
| 安装后找不到动作 | 检查插件是否启用、权限是否允许、Feature 上下文是否匹配。MCP 专用工具从已连接 Agent 发现 |
| Agent 能连接却看不到插件工具 | 检查「设置 → AI → MCP 服务」及该插件的工具开关、插件授权和 `mcpTool` 声明 |

报告问题时提供插件版本、Manifest 版本、SDK 版本、宿主构建、平台、Feature 入口和错误码。分享诊断前移除令牌、私有路径与业务内容。
