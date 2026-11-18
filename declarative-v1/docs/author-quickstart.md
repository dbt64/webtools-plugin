# 快速开始

[返回作者指南](author-guide.md)

准备 Windows 上的 WebTools，开发环境使用 **Node.js 22.12 或更高版本**，并选择 npm 或 pnpm。首次安装模板的前端构建依赖需要联网。两个 `.tgz` 是本地开发工具，插件中心安装的是生成的 `.wtplugin`。示例假定当前目录有以下文件：

```text
artifacts/
  create-webtools-plugin-1.16.2.tgz
  webtools-plugin-sdk-1.16.2.tgz
```

## 创建项目

下面任选一套命令。默认示例是 Vanilla + Web。若换成 Vue、React 或 Svelte，给 `--framework` 传对应小写名称。项目目录 `notes-demo` 必须尚不存在。

**npm**

```powershell
mkdir tooling
cd tooling
npm init -y
npm install --save-dev "file:../artifacts/create-webtools-plugin-1.16.2.tgz"
npm exec -- create-webtools-plugin notes-demo --framework vanilla --runtime web --package-manager npm --yes
cd notes-demo
npm install --save-dev "@webtools/plugin-sdk@file:../../artifacts/webtools-plugin-sdk-1.16.2.tgz"
```

**pnpm**

```powershell
mkdir tooling
cd tooling
pnpm init
pnpm add --save-dev "file:../artifacts/create-webtools-plugin-1.16.2.tgz"
pnpm exec create-webtools-plugin notes-demo --framework vanilla --runtime web --package-manager pnpm --yes
cd notes-demo
pnpm add --save-dev "@webtools/plugin-sdk@file:../../artifacts/webtools-plugin-sdk-1.16.2.tgz"
```

若创建 Node 项目，改用 `--runtime node`，安装 SDK 时用 `npm install --save` 或 `pnpm add --save-prod`。因为生成的 Node preload 运行时会加载 SDK，所以打包需要把它作为生产依赖。Web 项目由 Vite 把 SDK 的 Web 入口编进前端。

## 打开项目并修改

1. 在生成项目目录运行 `npm run dev` 或 `pnpm dev`。
2. 在 WebTools 管理中心的插件中心开启开发者模式，点击「连接开发项目…」，选中 `notes-demo` 目录并授权。可先用管理中心窗口菜单的「分离为独立窗口」保留开发面板。
3. 选择 Manager 的无上下文入口，打开 **Home**。点击「打开宿主子输入」，输入「文件」，选中动态结果。模板还包含文件入口和子窗口。
4. 修改 Vanilla 项目的 `web/src/demo.html`，例如替换其中一个标题。保存后观察已打开的开发窗口重新加载。浏览器预览可检查页面样式，宿主能力需要在 WebTools 中验证。

## 生成正式包

开发终端按 Ctrl+C，结束开发连接。在生成的项目目录运行：

```powershell
npm run typecheck
npm run build
npm run validate
npm run pack
npm run inspect
```

pnpm 使用 `pnpm typecheck`、`pnpm build`、`pnpm validate`、`pnpm run pack` 和 `pnpm inspect`。这里必须写 `pnpm run pack`，因为 `pnpm pack` 生成的是 npm tarball。

插件中心选择本地安装，打开 `notes-demo.wtplugin`，检查清单与权限，安装并启用。此时正式插件独立于开发连接，日常使用不需要运行开发命令。接下来可阅读 [Manifest](author-manifest.md) 或 [更新与分发](author-workflow.md)。
