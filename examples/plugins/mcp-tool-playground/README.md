# MCP 工具验收

安装插件并启用，在 WebTools「设置 → AI」开启本机 MCP 服务并确认此插件的工具开关已开启。点击「连接 AI Agent」，可以为受支持的客户端一键配置，也可以查看手动导入所需的 URL 与 Authorization 请求头。调用 `org.webtools.mcp-tool-playground.text-stats`，传入 `{"text":"你好 WebTools"}`，预期返回 `{"characterCount":11}`。
