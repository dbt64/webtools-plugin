# WebTools Plugin

WebTools 插件 SDK、项目生成器、作者指南和示例插件。Windows 宿主、插件安装与权限管理、Electron 插件运行时在 [webtools-rs](https://github.com/dbt64/webtools-rs)。

- [插件作者指南](declarative-v1/docs/author-guide.md)
- [Manifest v3 项目生成器](create-webtools-plugin/README.md)
- [v1 和 v3 示例插件](examples/plugins)

SDK 和生成器版本均为 **1.16.2**。需要 Node.js 22.12 或以上和 pnpm 9.15.9。从仓库根目录安装开发依赖并校验：

```powershell
pnpm install --frozen-lockfile
pnpm run toolchain:check
pnpm test
```

在 `declarative-v1/` 和 `create-webtools-plugin/` 各运行 `pnpm pack` 生成配套本地工具包。生成的插件项目用 `pnpm run pack` 制作由 WebTools 安装的 `.wtplugin`。完整创建、调试和升级步骤见[快速开始](declarative-v1/docs/author-quickstart.md)。

宿主在 `plugin-sdk/` 通过 Git 子模块固定此仓库的版本。验证器一致性和真实宿主交互测试位于宿主仓库。此仓库采用 [MIT 许可证](LICENSE)。
