# Manifest 与启动上下文

[返回作者指南](author-guide.md)

## 选用清单版本

| 形式 | 适用场景 | 如何运行 |
| --- | --- | --- |
| v3 Web | 交互页面、窗口、按权限读取上下文和使用 SDK | Web 页面通过 `@webtools/plugin-sdk/web` 连接宿主 |
| v3 Node | 本地 Node 代码、Node preload、无界面命令、MCP 工具 | 页面仍用 Web SDK。preload 和命令运行在宿主管理的 Node 环境 |
| v1 | 保留或维护已经安装的声明式插件 | 宿主渲染 `pages`，派发清单中声明的 `actions` |

v1 对应 [Manifest v1 Schema](../manifest.schema.json)，可以用 SDK 的旧版 `webtools-plugin create` 创建。新 Web/Node 项目用独立的 v3 生成器。v2 退出生产支持，有源代码时按 v3 重新打包并走正常授权。

## v3 清单需要填什么

| 字段 | 用法 |
| --- | --- |
| `manifestVersion`、`type` | v3 项目使用 `3` 和 `plugin` |
| `id`、`name`、`description`、`author` | ID 是插件身份和私有数据归属，发布更新时保持稳定。显示名称可以修改 |
| `version`、`api` | 插件升级提高自身版本。当前 API 主版本为 `1`。用 `api.minHostVersion` 声明最低产品版本，并实测可选能力 |
| `runtime`、`compatibility` | 选择 `web` 或 `node`。声明目标平台和架构。有原生 `.node` 模块时额外匹配宿主 Electron 的 Node ABI |
| `features` | 定义每个入口的 ID、标题、页面或命令、展示方式、接受的上下文和必要权限 |
| `requestedCapabilities` | 插件总体申请的宿主权限。Feature 的 `requiredCapabilities` 必须来自这个列表 |
| `configuration` | 可选的带类型设置。每个字段提供默认值。已有配置的兼容规则见[版本说明](version-compatibility.md) |
| `runtimeFiles`、`dependencies`、`package` | 归档文件清单、依赖和 `wtplugin` 格式版本。模板的构建与打包流程会生成输出清单，最终以归档内已验证的文件为准 |

把下面这个对象加到生成项目的 `features` 数组中即可新增一个只接受 PNG 的页面入口。这里复用生成器已提供的 `web/index.html`。

```json
{
  "id": "selected-png",
  "title": "查看选中的 PNG",
  "entry": { "kind": "web-bundle", "document": "web/index.html" },
  "acceptedContexts": [
    {
      "type": "files",
      "sources": ["explorer-selection"],
      "extensions": [".png"],
      "minItems": 1,
      "maxItems": 4
    }
  ],
  "requiredCapabilities": []
}
```

页面入口用 `web-bundle`，无界面命令用 `node-command` 与 `presentation.type: "command"`。命令模块应为已登记的 `.cjs`。一个 Node 插件可以同时声明页面和命令。完整字段、枚举、类型和长度见 [Manifest v3 Schema](../manifest.schema.v3.json)。宿主会在安装和调用时复核声明和授权。

## 入口带入什么

| 入口 | 页面收到的 `context.current()` |
| --- | --- |
| 管理中心普通打开 | `null` |
| Launcher 输入 | `{ type: "text", source: "launcher-input", text }` |
| 超级面板选中文字 | `{ type: "text", source: "selected-text", text }` |
| 受支持并授权的剪贴板文字入口 | `{ type: "text", source: "clipboard", text }` |
| 资源管理器选中文件 | `{ type: "files", source: "explorer-selection", items }` |
| 资源管理器目录上下文 | `{ type: "directories", source: "explorer-selection", items }` |
| Feature 快捷键 | 由用户选择是否传递选区。按 Feature 匹配后收到对应上下文，支持无上下文进入的入口可收到 `null` |
| MCP 工具 | 输入来自 Node 命令的 `mcpInput`，按工具自己的 Schema 校验 |

文件项是 `{ kind, path }`。校验扩展名或数量只决定功能匹配。收到路径不会自动获得读取文件、打开路径或截图的权限。目录与文件分开声明。文件和目录的 `minItems`、`maxItems` 取值为 1 至 64。选中文字可声明 `textMatch: "http-url"`。需要同时支持普通打开和选区的同一个 Feature，可以显式加上 `{ "type": "none", "sources": [] }`。
