import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readFileSync } from 'node:fs'
export const TOOLCHAIN = Object.freeze(JSON.parse(readFileSync(new URL('./toolchain.json', import.meta.url), 'utf8')))

const FRAMEWORKS = new Set(['vanilla', 'vue', 'react', 'svelte'])
const RUNTIMES = new Set(['web', 'node'])
const MANAGERS = new Set(['pnpm', 'npm'])
const SDK_VERSION = TOOLCHAIN.sdkVersion

function invalid() { return Object.assign(new Error('Invalid create options or unsafe project path.'), { code: 'CREATE_INVALID_INPUT' }) }
function exists() { return Object.assign(new Error('The target directory already exists.'), { code: 'CREATE_OUTPUT_EXISTS' }) }
function safeSlug(value) {
  const slug = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/gu, '-').replace(/^-+|-+$/gu, '').replace(/-{2,}/gu, '-')
  if (!slug || slug.length > 48) throw invalid()
  return slug
}
function validateId(value) {
  if (typeof value !== 'string' || value.length > 128 || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u.test(value)
    || value === 'webtools' || value.startsWith('webtools.')) throw invalid()
  return value
}
function json(value) { return `${JSON.stringify(value, null, 2)}\n` }
function starterFile(name) { return readFileSync(new URL(`./starter/${name}`, import.meta.url), 'utf8') }

function frameworkSource(framework, nodeRuntime) {
  const nodeSample = nodeRuntime ? " + ' · Plugin preload: ' + window.pluginSample.runtime + ', launch #' + window.pluginSample.count + '; ' + window.pluginSample.readExample()" : ''
  if (framework === 'vue') return {
    files: {
      'web/src/main.ts': `import { createApp } from 'vue'\nimport App from './App.vue'\nimport './style.css'\n\ncreateApp(App).mount('#app')\n`,
      'web/src/App.vue': `<script setup lang="ts">\nimport { onMounted, ref } from 'vue'\nimport { connectWebTools } from '@webtools/plugin-sdk/web'\n\nconst status = ref('Connecting to WebTools…')\nonMounted(async () => {\n  try { await connectWebTools().ready; document.documentElement.dataset.framework = 'vue'; status.value = 'WebTools API ready'${nodeSample} }\n  catch { status.value = 'Standalone preview' }\n})\n</script>\n\n<template><div class="wt-container"><header class="wt-stack"><p class="wt-eyebrow">WEBTOOLS PLUGIN</p><h1 class="wt-title">Hello from Vue</h1><span class="wt-tag">{{ status }}</span></header></div></template>\n`,
    },
    plugin: "import vue from '@vitejs/plugin-vue'\n",
    plugins: 'plugins: [vue()],',
    dependency: { vue: '^3.5.43' },
    devDependency: { '@vitejs/plugin-vue': '^6.0.9', 'vue-tsc': '^3.3.12' },
    buildCheck: 'vue-tsc --noEmit -p tsconfig.web.json && webtools-plugin build',
  }
  if (framework === 'react') return {
    files: {
      'web/src/main.tsx': `import React from 'react'\nimport { createRoot } from 'react-dom/client'\nimport { connectWebTools } from '@webtools/plugin-sdk/web'\nimport './style.css'\n\nfunction App() {\n  const [status, setStatus] = React.useState('Connecting to WebTools…')\n  React.useEffect(() => { connectWebTools().ready.then(() => { document.documentElement.dataset.framework = 'react'; setStatus('WebTools API ready'${nodeSample}) }, () => setStatus('Standalone preview')) }, [])\n  return <main className="wt-container"><header className="wt-stack"><p className="wt-eyebrow">WEBTOOLS PLUGIN</p><h1 className="wt-title">Hello from React</h1><span className="wt-tag">{status}</span></header><section className="wt-card wt-stack"><p className="wt-copy starter-note">Use the optional SDK styles as a starting point. Override the CSS locally or remove the import whenever your plugin needs a different design.</p><label className="wt-field"><span className="wt-label">Example input</span><input className="wt-input" type="text" placeholder="Type something…" /></label><div className="starter-actions"><button className="wt-button wt-button-primary" type="button">Primary action</button><button className="wt-button" type="button">Secondary action</button></div></section></main>\n}\n\ncreateRoot(document.getElementById('app')!).render(<App />)\n`,
    },
    plugin: "import react from '@vitejs/plugin-react'\n",
    plugins: 'plugins: [react()],',
    dependency: { react: '^19.3.0', 'react-dom': '^19.3.0' },
    devDependency: { '@types/react': '^19.3.0', '@types/react-dom': '^19.3.0', '@vitejs/plugin-react': '^5.1.4' },
    buildCheck: 'webtools-plugin build',
  }
  if (framework === 'svelte') return {
    files: {
      'web/src/main.ts': `import { mount } from 'svelte'\nimport App from './App.svelte'\nimport './style.css'\n\nmount(App, { target: document.getElementById('app')! })\n`,
      'web/src/App.svelte': `<script lang="ts">\n  import { onMount } from 'svelte'\n  import { connectWebTools } from '@webtools/plugin-sdk/web'\n  let status = $state('Connecting to WebTools…')\n  onMount(() => { connectWebTools().ready.then(() => { document.documentElement.dataset.framework = 'svelte'; status = 'WebTools API ready'${nodeSample} }, () => status = 'Standalone preview') })\n</script>\n\n<div class="wt-container"><header class="wt-stack"><p class="wt-eyebrow">WEBTOOLS PLUGIN</p><h1 class="wt-title">Hello from Svelte</h1><span class="wt-tag">{status}</span></header></div>\n`,
    },
    plugin: "import { svelte } from '@sveltejs/vite-plugin-svelte'\n",
    plugins: 'plugins: [svelte()],',
    dependency: { svelte: '^5.57.1' },
    devDependency: { '@sveltejs/vite-plugin-svelte': '^6.2.1', 'svelte-check': '^4.7.6' },
    buildCheck: 'svelte-check --tsconfig ./tsconfig.web.json && webtools-plugin build',
  }
  return {
    files: {
      'web/src/main.ts': `import { connectWebTools } from '@webtools/plugin-sdk/web'\nimport './style.css'\n\nconst status = document.querySelector<HTMLElement>('#status')!\nconnectWebTools().ready.then(() => { document.documentElement.dataset.framework = 'vanilla'; status.textContent = 'WebTools API ready'${nodeSample} }, () => { status.textContent = 'Standalone preview' })\n`,
    },
    plugin: '',
    plugins: '',
    dependency: {},
    devDependency: {},
    buildCheck: 'webtools-plugin build',
  }
}

function filesFor({ name, id, displayName, framework, runtime, packageManager }) {
  const node = runtime === 'node'
  const view = frameworkSource(framework, node)
  for (const [relativePath, contents] of Object.entries(view.files)) {
    if (/^web\/src\/main\.(?:ts|tsx)$/u.test(relativePath)) {
      view.files[relativePath] = contents.replace(
        "import './style.css'\n",
        "import '@webtools/plugin-sdk/ui.css'\nimport './style.css'\n",
      )
    }
  }
  const manifest = {
    manifestVersion: 3,
    id,
    name: displayName,
    description: `${displayName} WebTools plugin`,
    author: { name: 'Plugin author' },
    version: '1.0.0',
    api: { apiMajor: 1, minHostVersion: TOOLCHAIN.productVersion },
    type: 'plugin',
    requestedCapabilities: ['plugin.window.manage'],
    runtime: node ? { kind: 'node', preload: 'preload/index.cjs' } : { kind: 'web' },
    compatibility: { platforms: [TOOLCHAIN.platform], architectures: [TOOLCHAIN.architecture] },
    features: [
      {
        id: 'home', title: 'Home', entry: { kind: 'web-bundle', document: 'web/index.html' },
        requiredCapabilities: ['plugin.window.manage'],
      },
      {
        id: 'selected-files', title: '查看选中文件',
        entry: { kind: 'web-bundle', document: 'web/index.html' },
        requiredCapabilities: ['plugin.window.manage'],
        acceptedContexts: [{ type: 'files', sources: ['explorer-selection'], minItems: 1, maxItems: 64 }],
      },
      ...(node ? [{
        id: 'normalize-selection', title: '整理选中文字',
        entry: { kind: 'node-command', module: 'resources/normalize-selection.cjs' },
        presentation: { type: 'command' },
        acceptedContexts: [{ type: 'text', sources: ['selected-text'] }],
      }] : []),
    ],
    runtimeFiles: [
      { path: 'web/index.html', role: 'web', mediaType: 'text/html' },
      { path: 'web/child.html', role: 'web', mediaType: 'text/html' },
      ...(node ? [
        { path: 'preload/index.cjs', role: 'node-preload', mediaType: 'text/javascript' },
        { path: 'resources/normalize-selection.cjs', role: 'node-command', mediaType: 'text/javascript' },
      ] : []),
    ],
    dependencies: [],
    package: { format: 'wtplugin', packageVersion: 1 },
  }
  const frameworkTypecheck = framework === 'vue' ? 'vue-tsc --noEmit -p tsconfig.web.json'
    : framework === 'svelte' ? 'svelte-check --tsconfig ./tsconfig.web.json'
      : 'tsc --noEmit -p tsconfig.web.json'
  const sdkInstall = packageManager === 'pnpm'
    ? `pnpm add ${node ? '--save-prod' : '--save-dev'} "@webtools/plugin-sdk@file:<path-to-webtools-plugin-sdk-${SDK_VERSION}.tgz>"`
    : `npm install ${node ? '--save' : '--save-dev'} "@webtools/plugin-sdk@file:<path-to-webtools-plugin-sdk-${SDK_VERSION}.tgz>"`
  const authorCommands = packageManager === 'pnpm'
    ? `${sdkInstall}\npnpm install\npnpm dev\npnpm build\npnpm validate\npnpm run pack`
    : `${sdkInstall}\nnpm install\nnpm run dev\nnpm run build\nnpm run validate\nnpm run pack`
  const scripts = {
    dev: 'webtools-plugin dev',
    build: 'webtools-plugin build',
    typecheck: `${frameworkTypecheck}${node ? ' && tsc --noEmit -p tsconfig.preload.json' : ''}`,
    validate: `webtools-plugin validate dist --host-version ${TOOLCHAIN.productVersion} --project-root .`,
    pack: `webtools-plugin pack dist --out ${name}.wtplugin --host-version ${TOOLCHAIN.productVersion} --project-root .`,
    inspect: `webtools-plugin inspect ${name}.wtplugin --host-version ${TOOLCHAIN.productVersion}`,
  }
  const sdkDependency = SDK_VERSION
  const dependencies = node ? { '@webtools/plugin-sdk': sdkDependency } : {}
  const devDeps = {
    ...(!node ? { '@webtools/plugin-sdk': sdkDependency } : {}),
    '@types/node': '^24.19.1',
    typescript: '~5.9.2',
    vite: '^7.3.6',
    ...view.dependency,
    ...view.devDependency,
  }
  const files = {
    'package.json': json({ name, version: '1.0.0', private: true, type: 'module', engines: { node: TOOLCHAIN.developmentNode }, ...(packageManager === 'pnpm' ? { packageManager: 'pnpm@9.15.9' } : {}), scripts, dependencies, devDependencies: devDeps }),
    'webtools-toolchain.json': json(TOOLCHAIN),
    'manifest.json': json(manifest),
    'tsconfig.web.json': json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, skipLibCheck: true, ...(framework === 'react' ? { jsx: 'react-jsx' } : {}), ...(framework === 'svelte' ? { allowJs: true, checkJs: true } : {}), lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['vite/client', ...(framework === 'react' ? ['react', 'react-dom'] : [])] }, include: ['web/src/**/*'] }),
    'vite.config.ts': `import { fileURLToPath } from 'node:url'\nimport { defineConfig } from 'vite'\n${view.plugin}export default defineConfig({\n  base: './',\n  ${view.plugins}\n  build: {\n    outDir: '../dist/web',\n    emptyOutDir: true,\n    rollupOptions: {\n      input: { index: fileURLToPath(new URL('./web/index.html', import.meta.url)), child: fileURLToPath(new URL('./web/child.html', import.meta.url)) },\n      output: { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' },\n    },\n  },\n})\n`,
    'web/index.html': `<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${displayName.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</title></head><body><div id="app">${framework === 'vanilla' ? '<div class="wt-container"><header class="wt-stack"><p class="wt-eyebrow">WEBTOOLS PLUGIN</p><h1 class="wt-title">Hello from Vanilla</h1><span id="status" class="wt-tag">Connecting to WebTools…</span></header></div>' : ''}</div><div id="starter-demo"></div><script type="module" src="./src/demo.ts"></script><script type="module" src="/src/main.${framework === 'react' ? 'tsx' : 'ts'}"></script></body></html>\n`,
    'web/src/style.css': `.wt-container { width: min(100%, 760px); margin-inline: auto; padding: 24px; }\n.starter-actions { display: flex; flex-wrap: wrap; gap: 8px; }\n.file-list { padding-inline-start: 1.25rem; overflow-wrap: anywhere; }\n`,
    'README.md': `# ${displayName}\n\nAn independent WebTools Manifest v3 ${runtime.toUpperCase()} plugin using ${framework}.\n\n## Workflow\n\n\`\`\`sh\n${authorCommands}\n\`\`\`\n\nThe build writes a Host-ready directory to \`dist/\`; validate and pack operate on that output. Packing writes \`${name}.wtplugin\` beside this README so later builds can safely regenerate \`dist/\`. The WebTools Host repeats authoritative validation during installation. In pnpm, \`pnpm pack\` creates a Node package tarball; use \`pnpm run pack\` to create this plugin's \`.wtplugin\` file.\n`,
    'web/child.html': starterFile('child.html'),
    'web/src/child.ts': starterFile('child.ts'),
    'web/src/demo.html': starterFile('demo.html'),
    'web/src/demo.ts': starterFile('demo.ts'),
    '.gitignore': 'node_modules/\ndist/\n.webtools/\n*.wtplugin\n',
  }
  files['README.md'] += '\n## Optional theme and UI styles\n\nThe Web starter imports `@webtools/plugin-sdk/ui.css`, a framework-free stylesheet with Host theme tokens and optional CSS classes for common controls and states. The import is ordinary plugin CSS: override it from `web/src/style.css` or remove it if you want to own all styling. For only the color tokens, import `@webtools/plugin-sdk/theme.css` instead.\n'
  files['README.md'] += '\n## Run the examples in WebTools\n\n- Open **Home** from plugin management. Click **打开宿主子输入**, type **文件** or **window**, and press Enter on a result. These results are local sample data.\n- Select one or more files in Explorer and open **查看选中文件** from Super Panel. Only the paths from the current invocation are displayed.\n- In Home, click **打开子窗口** and send a message back to the main window. Close it using **关闭子窗口**. The Host asks for `plugin.window.manage` at installation.\n'
  if (node) files['README.md'] += '- Select text in Notepad, call up Super Panel and choose **整理选中文字**. The result appears in Super Panel and repeated whitespace becomes a single space. Its implementation is in `assets/normalize-selection.cjs`. A Web starter does not declare Node commands.\n'
  files['README.md'] += `\n## Version and runtime compatibility\n\nDevelopment Node: ${TOOLCHAIN.developmentNode}. SDK and generator: ${SDK_VERSION}. Tested Host: ${TOOLCHAIN.productVersion}, Electron ${TOOLCHAIN.electronVersion}, ${TOOLCHAIN.platform}/${TOOLCHAIN.architecture}. See webtools-toolchain.json for the target snapshot. Manifest v3, Plugin API major 1 and wtplugin format 1 are independent of these package versions. Pure JavaScript Node plugins omit nodeAbi; if you add a native .node module, rebuild it for the Host Electron ABI ${TOOLCHAIN.nodeAbi} and declare compatibility.nodeAbi. Your development Node ABI is not the Host ABI. Install/update still checks manifest compatibility and asks for permissions.\n`
  for (const [relative, content] of Object.entries(view.files)) files[relative] = content
  if (node) {
    files['preload/package.json'] = json({ type: 'commonjs' })
    files['tsconfig.preload.json'] = json({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, types: ['node'], outDir: 'dist/preload', rootDir: 'preload', esModuleInterop: true }, include: ['preload/**/*.ts'] })
    files['preload/index.ts'] = `import { readFileSync, writeFileSync } from 'node:fs'\nimport { join } from 'node:path'\nimport { getPluginPaths } from '@webtools/plugin-sdk/node'\n\ndeclare const __dirname: string\ndeclare function require(id: string): { contextBridge: { exposeInMainWorld(key: string, value: unknown): void } }\nconst { contextBridge } = require('electron')\nconst paths = getPluginPaths(__dirname)\nconst countFile = join(paths.localDataDirectory, 'launch-count.json')\nlet count = 0\ntry { count = Number(JSON.parse(readFileSync(countFile, 'utf8')).count) || 0 } catch {}\ncount += 1\nwriteFileSync(countFile, JSON.stringify({ count }), 'utf8')\ncontextBridge.exposeInMainWorld('pluginSample', {\n  runtime: 'node',\n  count,\n  readResource(name: string) { return readFileSync(join(paths.packageDirectory, 'resources', name), 'utf8') },\n})\n`
    files['preload/index.ts'] = `import { readFileSync, writeFileSync } from 'node:fs'\nimport { join } from 'node:path'\nimport { getPluginPaths } from '@webtools/plugin-sdk/node'\n\ndeclare const __dirname: string\ndeclare function require(id: string): { contextBridge: { exposeInMainWorld(key: string, value: unknown): void } }\nconst { contextBridge } = require('electron')\nconst paths = getPluginPaths(__dirname)\nconst countFile = join(paths.localDataDirectory, 'launch-count.json')\nlet count = 0\ntry { count = Number(JSON.parse(readFileSync(countFile, 'utf8')).count) || 0 } catch {}\ncount += 1\nwriteFileSync(countFile, JSON.stringify({ count }), 'utf8')\ncontextBridge.exposeInMainWorld('pluginSample', {\n  runtime: 'node',\n  count,\n  readExample() { return readFileSync(join(paths.packageDirectory, 'resources', 'example.txt'), 'utf8').trim() },\n})\n`
    files['web/src/plugin-api.d.ts'] = `export {}\n\ndeclare global {\n  interface Window {\n    readonly pluginSample: {\n      readonly runtime: 'node'\n      readonly count: number\n      readExample(): string\n    }\n  }\n}\n`
    files['assets/example.txt'] = 'This text came from the Node plugin package resources.\n'
    files['assets/normalize-selection.cjs'] = starterFile('normalize-selection.cjs')
  }
  return files
}

async function ensureSafeTarget(cwd, directory) {
  const rootStat = await lstat(cwd).catch(() => undefined)
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) throw invalid()
  const root = await realpath(cwd)
  const targetText = String(directory ?? '').trim()
  if (!targetText || path.isAbsolute(targetText) || targetText.split(/[\\/]/u).some(part => !part || part === '.' || part === '..')) throw invalid()
  const target = path.resolve(root, targetText)
  const rel = path.relative(root, target)
  if (!rel || rel.startsWith(`..${path.sep}`) || rel === '..' || path.isAbsolute(rel)) throw invalid()
  let parent = root
  for (const segment of rel.split(path.sep).slice(0, -1)) {
    parent = path.join(parent, segment)
    const info = await lstat(parent).catch(() => undefined)
    if (!info?.isDirectory() || info.isSymbolicLink() || await realpath(parent) !== parent) throw invalid()
  }
  const existing = await lstat(target).catch(() => undefined)
  if (existing) throw exists()
  return { root, target }
}

export async function createPluginProject(directory, options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const { root, target } = await ensureSafeTarget(cwd, directory)
  const projectName = safeSlug(options.projectName ?? path.basename(target))
  const framework = options.framework ?? 'vanilla'
  const runtime = options.runtime ?? 'web'
  const packageManager = options.packageManager ?? 'pnpm'
  if (!FRAMEWORKS.has(framework) || !RUNTIMES.has(runtime) || !MANAGERS.has(packageManager)) throw invalid()
  const id = validateId(options.id ?? `org.example.${projectName}`)
  const displayName = String(options.displayName ?? projectName).trim()
  if (!displayName || displayName.length > 80) throw invalid()
  const files = filesFor({ name: projectName, id, displayName, framework, runtime, packageManager })
  const created = []
  try {
    await mkdir(target)
    created.push(target)
    for (const folder of ['assets', 'dist', 'web', 'web/src', ...(runtime === 'node' ? ['preload'] : [])]) {
      await mkdir(path.join(target, folder))
      created.push(path.join(target, folder))
    }
    const verifiedRoot = await realpath(root)
    if (await realpath(target) !== path.join(verifiedRoot, path.relative(root, target))) throw invalid()
    for (const [relative, contents] of Object.entries(files)) {
      const output = path.join(target, ...relative.split('/'))
      const parent = await realpath(path.dirname(output))
      const rel = path.relative(target, parent)
      if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw invalid()
      await writeFile(output, contents, { flag: 'wx' })
      created.push(output)
    }
    return { directory: path.relative(cwd, target).split(path.sep).join('/'), manifest: JSON.parse(files['manifest.json']) }
  } catch (error) {
    // The destination was proven absent; remove only paths created by this call.
    for (const item of created.reverse()) await import('node:fs/promises').then(fs => fs.rm(item, { recursive: true, force: true })).catch(() => {})
    throw error
  }
}
