# 可运行示例

[返回作者指南](author-guide.md)

| 示例 | 适合查什么 | 如何验收 |
| --- | --- | --- |
| 生成的 Vanilla Web 模板 | 最小主窗口、宿主子输入、文件上下文、子窗口消息和统一 UI | 安装 Web 模板，打开 Home，搜索「文件」，随后试着打开子窗口并向主窗口发送消息 |
| 生成的 Vue Node 模板 | Web 页面与 preload、无界面命令和超级面板结果 | 在记事本选中带多余空格的文字，呼出超级面板并运行「整理选中文字」 |
| 插件平台验收（仓库 `examples/plugins/platform-playground`） | 生命周期、私有存储、通知、定时任务、共享 AI、MCP、浏览器和媒体 | 检查插件申请的权限，按页内步骤使用对应示例 |
| MCP 工具验收（仓库 `examples/plugins/mcp-tool-playground`） | 将纯 Node 命令声明成 Agent 工具 | 启用插件及工具，在「设置 → AI」开启本机 MCP 服务并连接 Agent。调用 `org.webtools.mcp-tool-playground.text-stats`，输入 `{"text":"你好 WebTools"}`，预期为 `{"characterCount":11}` |
| Private Notes（仓库 `examples/plugins/private-notes`） | v1 声明式页面与数据存储 | 安装便笺后执行保存和读取，关闭宿主再打开确认笔记仍在 |

使用独立作者资料包时，即可在 `examples/` 查看 Vanilla Web 与 Vue Node 的完整源码，在 `artifacts/` 安装预先构建的模板和验收插件。使用 npm SDK 时，按[快速开始](author-quickstart.md)生成同款模板。无需装示例插件才能编写自己的插件。

**文件上下文练习**。生成模板后，在 `web/src/demo.ts` 找到 `refreshFiles`。把选中的文件逐条渲染出来，再从资源管理器选一个真实文件，通过超级面板开启「查看选中文件」。从管理中心打开 Home 时看到空列表，然后回到文件入口确认路径更新。

**换成自己的搜索结果**。在 `web/src/demo.ts` 中替换本地 `samples`，让不同关键词产生不同结果。尝试空输入、无匹配、键盘 Enter 和鼠标选择，检查页面显示选中项。给每个结果保留稳定 ID，同一次查询的更新用宿主发来的修订号。

**更新练习**。安装初版后保存一项插件数据。保持 ID，提高包版本，重新构建并用新文件名打包。直接安装更新，确认原数据仍可访问。测试卸载删除时只使用专门创建的样例。
