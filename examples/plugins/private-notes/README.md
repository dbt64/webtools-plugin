# Private Notes example plugin

This standalone example uses only the WebTools declarative page and the plugin-private key/value store. It contains no JavaScript plugin runtime, network action, Shared AI request, token, or asset.

## Requirements

- WebTools with Manifest v1 / API major 1 support.
- The local `@webtools/plugin-sdk` tarball and its `webtools-plugin` command. The Author Kit includes the tools and the packaged example.
- A supported Node.js and pnpm installation for authoring and packaging.

## Build and install

To rebuild from the extracted Author Kit, run the following from its root:

```powershell
mkdir notes-tooling
cd notes-tooling
npm init -y
npm install --save-dev "file:../artifacts/webtools-plugin-sdk-1.16.2.tgz"
npm exec -- webtools-plugin validate ../examples/private-notes --host-version 0.1.0
npm exec -- webtools-plugin pack ../examples/private-notes --out private-notes.wtplugin --host-version 0.1.0
npm exec -- webtools-plugin inspect private-notes.wtplugin --host-version 0.1.0
```

To use the SDK in another project, give those same commands the path to this example's directory. Pack refuses to overwrite an existing archive. You can install the prebuilt `artifacts/private-notes.wtplugin` directly.

In WebTools, open **应用 → 插件管理**, choose **从本地文件安装**, select `private-notes.wtplugin`, review the requested `manager.page`, `plugin.storage.read`, and `plugin.storage.write` capabilities, grant only what you want, and enable the plugin. Open **Private Notes**, select **Save note**, enter text in the host-provided prompt, and use **Load saved note** to read it back.

## Disable, update, and uninstall

Disable or re-enable the plugin from Plugin Center. Its data remains scoped to the plugin and survives those state changes. Install an updated `.wtplugin` through the same host-owned picker and review any changed capability request. On uninstall, WebTools asks whether to delete the plugin's private data; choose keep or delete explicitly. This example does not access other plugins' data or WebTools settings.

## Limits

Only the fixed host UI and declared storage actions execute. The manifest cannot run custom code, load a Vue view, read files, inspect the Shared AI token, invoke Electron directly, or bypass host permission checks.
