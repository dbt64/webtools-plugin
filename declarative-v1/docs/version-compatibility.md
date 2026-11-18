# 开发工具与插件兼容

当前配套 SDK 与生成器版本：1.16.2。以本地 tgz 提供，尚未发布 npm。先安装生成器，再在生成的项目中安装同一发布版本 SDK；Web 模板用开发依赖，Node 模板的 preload 直接加载 SDK，必须用生产依赖。

开发工具要求 Node >=22.12。开发机器的 Node 与宿主内部的 Node 是两个运行环境。当前验证宿主为产品 0.1.0、Windows x64、Electron 44.4.5，Electron 内 Node 24.21.0、modules ABI 149；SDK 随附 runtime-target.json，生成器随附目标快照。

| 版本 | 作用 |
| --- | --- |
| SDK/生成器 1.16.2 | 作者使用的开发工具发布版本 |
| 插件自己的 version | 插件安装、升级的版本，模板初始为 1.0.0 |
| Manifest v1/v3 | 插件清单模型；v1 声明式插件和已有 v3 插件继续保留 |
| Plugin API major 1 | API 兼容主版本，与 SDK 发布版本无关 |
| wtplugin packageVersion 1 | 插件归档格式，区别于 npm tgz |
| api.minHostVersion | 最低宿主产品版本；同为 0.1.0 的不同预览可能具有不同可选能力，仍需声明、授权与可用性检查 |
| compatibility.nodeAbi | 仅带原生 .node 扩展时，用来匹配宿主 Electron ABI |

纯 JavaScript Node 模板不声明 nodeAbi。加入原生扩展时需要针对宿主的 Electron、平台和架构重编译，声明相应 ABI；为开发机器 Node 编译出的二进制不能自动用于 Electron。SDK 的打包/验证只检查归档，不会执行原生模块，最终运行兼容性由宿主复核。

新生成器输出 webtools-toolchain.json，用于说明作者构建时的目标，不覆盖宿主判断。升级工具不强制迁移旧插件清单、源码或用户数据；新 API 的能力判断、取消和资源清理规则仍见各 API 指南。Manifest v2 只有预检诊断支持，不能作为生产插件安装。

首次安装模板构建依赖需要 npm 网络访问；本次开发工具包不包含完整离线依赖仓库。两个工具包版本一致不意味着产品、Manifest 或 API 主版本也必须相同。
