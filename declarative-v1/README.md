# WebTools Plugin SDK

中文入口：[WebTools 插件作者指南](docs/author-guide.md)，包含从创建到发布的操作步骤和完整 API 导航。

This standalone local SDK supports declarative Manifest v1 authoring, bounded Manifest v2 preflight, and production Web/Node Manifest v3 authoring and deterministic `.wtplugin` packing. Runtime v3 packing materializes the production dependency graph from npm or pnpm `node_modules`, including nested and scoped packages, native addons, and declared helper resources. SDK validation is author feedback only; the installed Electron Main remains the install-time authority. The package is distributed as a local `.tgz` and is not published to npm or a plugin marketplace.

## Typed configuration (introduced in SDK 1.5.0)

Manifest v3 may declare `configuration: { schemaVersion: 1, settings: [...] }`. Settings use the existing closed `text`, `enum`, `boolean`, and `number` descriptors (key, label, default, and type-specific bounds/options). Schema version is 1–2147483647, at most 64 fields; text is bounded to 50,000 UTF-16 code units, labels/options to 128, enums to 64 unique options. All defaults and saved values are validated by the Host, with a 512 KiB aggregate values limit. Config is ordinary preference data, not a secret vault.

Web plugins use `connectWebTools().config.get()` and `.config.set(key, value)`. Node Command receives the same methods as `invocation.webtools.config`; Node Window uses the Web SDK facade. `get` needs `plugin.config.read`; `set` needs `plugin.config.write`. Declare the capability in both `requestedCapabilities` and the invoking Feature's `requiredCapabilities`, then obtain the user's grant. SDK possession is not authorization.

Manager can edit an installed, disabled plugin without starting its runtime or granting runtime access. Existing v3 packages without a descriptor remain loadable, with config capabilities unavailable. v1 settings/data are retained independently. Schema/value incompatibility preserves the old file; explicit Manager reset confirms recovery and saves one latest raw-byte backup. Default reads do not create files. The Host install-time package validator remains final authority.

The package version is recorded in `package.json`; build the matching local tarball for that version. It is not published to npm or a plugin marketplace. See the bundled [P4 API guide](docs/p4-api-guide.md) for lifecycle, window and desktop API examples, and the [plugin storage guide](docs/plugin-storage-guide.md) for JSON data, files, backups, permissions, and retention rules.

### Per-Feature global shortcut (1.12.0)

Web and Node Features can read their configured global shortcut. Configure it from Plugin Manager → select a WebTools plugin → Feature → “功能快捷键”; the Host owns registration and conflict handling. `null` means no shortcut is assigned. The call always refers to the Feature handling the current invocation, so a plugin with multiple Features can display or react to each Feature's own binding.

```js
const shortcut = await webtools.shortcuts.current()
console.log(shortcut ?? 'No shortcut assigned')
```

This is a read-only API for the active Feature. Plugins cannot register global shortcuts themselves.

## Optional Web theme and UI styles

Manifest v3 Web plugins can import `@webtools/plugin-sdk/theme.css` for only the Host's Phase 6F-4E color tokens, or `@webtools/plugin-sdk/ui.css` for those tokens plus optional CSS-only layout and control classes. The UI stylesheet has no framework or JavaScript dependency and works with Vanilla, Vue, React, and Svelte. It includes container, button, input, switch, list, tag, menu, tooltip, loading, empty, and error styles. Authors can override its CSS variables/classes or remove the import and keep fully plugin-owned styling. Host injection remains limited to the fixed theme token contract. Manifest v1 declarative pages use Host-rendered UI and do not consume these stylesheets.

From the tooling project that has the tarball installed:

```powershell
pnpm exec webtools-plugin --help
pnpm exec webtools-plugin create basic-plugin --host-version 0.1.0
```

Then, from `basic-plugin/`, install the same local SDK tarball and use the generated scripts:

```powershell
pnpm add --save-dev --ignore-scripts file:..\..\artifacts\webtools-plugin-sdk-1.16.2.tgz
pnpm install --frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run validate
pnpm run plugin:pack
pnpm run inspect
```

The generated declarative starter uses pnpm `9.15.9`. Use the actual target Host version for `--host-version`. Validation and inspection are author feedback only: neither installs a plugin, prompts for consent, nor executes plugin content. WebTools Plugin Center's install-time validation, consent, grants, and lifecycle remain authoritative.

Manifest v1 packages support fixed declarative page blocks. Manifest v2 Web plugin packages must be repacked to Manifest v3. Manifest v3 supports standard Chromium Web features or a Node-capable isolated preload, with runtime dependencies and native resources declared in the package inventory. Node plugins run as local code under the current Windows user and do not receive a WebTools OS sandbox; WebTools privileged Host APIs remain separately mediated.

## Runtime v3 authoring

### Plugin search input and dynamic results (1.9.0)

Web Features can temporarily show a host-owned search field above their page and publish matching results into the same host surface. The host owns text input, Chinese IME composition, arrow-key navigation, Enter/click selection, and Esc behavior; the plugin supplies query-specific results and handles the selected item. Showing the input hides the plugin page while search is active; hiding it or pressing Esc returns to the existing page.

```js
import { connectWebTools } from '@webtools/plugin-sdk/web'

const webtools = connectWebTools()
await webtools.ready
await webtools.subInput.show({ placeholder: '搜索本地条目' })

const removeInputListener = webtools.subInput.onChange(async (query, revision) => {
  const items = query
    ? localItems.filter(item => `${item.title} ${item.description}`.includes(query))
    : []
  await webtools.results.update({ query, revision, items })
})
const removeSelectionListener = webtools.results.onSelect(({ item }) => {
  console.log('Selected:', item.id)
  void webtools.subInput.hide()
})
```

Every input change has a monotonically increasing revision. `results.update` and `results.clear` must echo the exact query and revision; the Host ignores results from an older input revision. Query text is limited to 1024 UTF-8 bytes. Results are limited to 30 entries with unique IDs, bounded title/description text, and optional PNG/JPEG/WebP data-image icons. `loading` and `error` can be supplied while asynchronous work is in progress. The API is optional and does not change ordinary Feature search or add a NativeHost/Rust protocol message.

`subInput.setText` updates the host field and emits the normal input-change event. `getText` reads the current value, `focus` focuses the host input, and `releaseFocus` hides the host search surface and returns to the plugin page. Unsubscribe by calling the functions returned from `onChange` and `onSelect` when the plugin no longer needs those listeners.

File and directory `acceptedContexts` may declare `minItems` and `maxItems` (1–64), for example `{ "type": "files", "sources": ["explorer-selection"], "minItems": 2, "maxItems": 2 }` for a comparison action. Both bounds apply to the total selection. This needs a host and native launcher that support `minItems`.

When a hidden Feature window is reopened with a new invocation, `context.onChange(listener)` notifies the existing page. Call `context.current()` inside the listener to obtain the new context; the returned function unsubscribes. Fetch once on initial connection as well. Older hosts do not deliver this notification.

### Selected-text matching and browser actions (1.8.0)

An accepted context may use `{ type: 'text', sources: ['selected-text'], textMatch: 'http-url' }`. This single closed rule refines local NativeHost discovery; no plugin matcher code or selection disclosure to Electron is used for discovery. Omission preserves ordinary text matching. The rule filters bounded HTTP(S) URL shapes, not full IDNA validity or DNS reachability, and the Host rechecks invocation, URL safety and current grants after explicit activation. An older Native peer omits a conditional Feature instead of broadening it.

Node Commands may use the optional `invocation.webtools.external?.open(url)` with the existing `external.open` capability. Each current activation supplies at most one Host-mediated external-open gesture. URLs are HTTP(S) only, bounded, and credential-free; old Hosts may omit the API. See the [real Selected Text Actions example](../../../examples/plugins/selected-text-actions/README.md) and [full author contract](../../../docs/plugin-development.md#selected-text-action-matching-sdk-180). The example bundles the public adapter; installing the SDK in an author directory alone does not make it available inside an installed Command.

### Optional Node Command text result (1.7.0)

`defineCommand` accepts void or `{ kind: 'text', text: string }` (including async returns). A Selected Text Super Panel command may return one bounded plain-text Quick Result when the Host provides `invocation.resultTarget === 'super-panel'`. Guard that optional field and return void for older Hosts and other surfaces. This adds no Manifest field, new permission, clipboard effect or Web result UI.

Text allows at most 8,192 Unicode scalars and 32,768 UTF-8 bytes, with CRLF/CR normalized to LF; whitespace-only strings, unpaired surrogates, unsupported controls and extra fields are rejected. The Host releases results only after successful execution, owned Utility cleanup and current-source revalidation. Cancellation and cleanup failure discard results. Already accepted inert Native text survives normal Electron idle exit; pending work does not survive a Pipe disconnect. Approved development builds use the same path with separate development evidence. See the [Quick Result author contract](../../../docs/plugin-development.md#optional-super-panel-quick-result-sdk-170) for lifecycle and Shared AI confirmation details.

Manifest v3 Features may declare `presentation: { "type": "window" }` with optional `defaultWidth`, `defaultHeight`, `minWidth`, `minHeight` and `resizable`. Omitted presentation normalizes to `window`. Window Features open in independent BrowserWindows of the existing WebTools Electron Host; Manager remains a management surface. `presentation: { "type": "command" }` supports a Node `entry: { "kind": "node-command", "module": "resources/command.cjs" }` inventoried with role `node-command`. Use `defineCommand` from the Node entry to export an async/void handler. Web/HTML command execution is unsupported; no hidden window is used. Invocation surface (Manager/Launcher/future Super Panel) is independent of presentation. See [Runtime and Surface Lifecycle](../../../docs/plugin-runtime.md).

For a standard Web plugin, declare `runtime: { "kind": "web" }`, each HTML feature entry, and the complete package-local Web file list under `runtimeFiles`. For a Node plugin, use `runtime: { "kind": "node", "preload": "runtime/preload.cjs" }` and include that CJS preload in `runtimeFiles`. The package's production `dependencies`, `optionalDependencies`, and `peerDependencies` are resolved and materialized into the archive by `webtools-plugin pack`; do not copy pnpm symlinks into the manifest by hand. The SDK keeps the package manager's physical layout out of the installed archive.

The host validator verifies the exact archive inventory, package identity/version, native PE architecture, ABI declaration, and package hash again at install. A Node plugin install/update is a local-code trust decision. Files such as `.node`, `.exe`, `.dll`, helper binaries, and resources are packaged as declared files; installation never executes them. A Node preload can use standard `node:` modules and `child_process`, but this is not an OS sandbox against other files visible to the same Windows user. ESM-only runtime dependencies should be loaded with `await import('package')` from the CommonJS preload entry.

Manifest v3 does not declare `network.mode`, `network.domains`, or WASM execution requirements. Browser networking follows Chromium CORS/TLS; localStorage/IndexedDB use a persistent plugin-isolated Session; Workers and WASM are standard runtime features. `process.env.WEBTOOLS_PLUGIN_DATA` identifies the stable plugin-local data folder for Node preloads. The existing `@webtools/plugin-sdk/web` bridge remains the typed API for context, PluginStore, Shared AI, and clipboard; it never returns provider credentials or Manager IPC authority.

See the complete author setup, CLI reference, manifest contract, troubleshooting, and manual install steps in [the plugin development guide](../../../docs/plugin-development.md).

## Browser connection entry

`@webtools/plugin-sdk/web` is a browser-only entry for the isolated Web Plugin runtime. It provides readiness, runtime-close notification and four typed capability families:

```js
import { connectWebTools } from '@webtools/plugin-sdk/web'

const webtools = connectWebTools()
await webtools.ready
const unsubscribe = webtools.onClose(() => {
  // Stop plugin-local work when the runtime closes.
})
const context = await webtools.context.current() // Readonly invocation text or null.
await webtools.storage.set('note', { text: 'Hello' })
const note = await webtools.storage.get('note')
const keys = await webtools.storage.list('note')
await webtools.storage.delete('note')
// Optional namespaces exist only for the declared, currently granted active Feature.
// Call from an explicit foreground user action; Host confirmation is required each time.
const abortController = new AbortController()
const answer = await webtools.ai?.complete({ prompt: 'Summarize this text' }, { signal: abortController.signal })
await webtools.clipboard?.writeText('Copied text')
```

The callback subscription can be removed with `unsubscribe()`. Connection readiness rejects outside a compatible runtime. Main validates installation, package identity, grants, Feature eligibility and live generation on every Host call; declarations and SDK possession are not grants. Storage uses the plugin's Main-derived namespace. Context contains the existing text payload or declared readonly file/directory items; its immutable value has a revocable Host-owned lifetime. Super Panel selection uses the same context API and is delivered only to the selected Feature. See the Native Super Panel documentation for acceptedContexts rules. All methods accept an optional `{ signal }` for local cancellation; provider billing cancellation is best effort.

Shared AI returns text only and never exposes credentials, endpoints, model override or provider metadata. External open, networking, model listing, streaming and tool calling remain unavailable through the Host bridge. There is no public generic request/send/invoke API. Plugin Center and Native Launcher activate installed window/Node command Features through Main's unified Feature activation pipeline. Native searches local validated projection metadata while Electron is absent. Development Features remain in the development panel. The package root and CLI remain Node-based authoring tools, and Host install-time validation is authoritative.

Web Shared AI requires valid provider-reported output token usage to enforce the 1,024-token limit. Missing or malformed usage fails closed; an over-limit output is rejected, never truncated. This requirement does not change existing built-in Translation or other Shared AI callers.

### Lifecycle notifications (1.10.0)

The browser client adds `lifecycle.ready`, `onInitialize`, `onEnter`, `onShow`, `onHide` and `onClose`. Every subscription returns a local unsubscribe function. Re-entering a retained Feature updates its context before the entry event; hotkey recall only changes visibility. Older plugins receive no unsolicited lifecycle events. See the [lifecycle contract and example](../../../docs/plugin-development.md) for event replay, runtime generation, cleanup and older-host behavior.

P5 浏览器与媒体工作流接口、场景及资源行为：[使用指南](docs/p5-browser-media.md)。SDK 1.15.0 需要配套新版宿主。

## Toolchain compatibility (SDK 1.16.2)

Use the matching create-webtools-plugin 1.16.2 tarball and development Node >=22.12. See [version and ABI compatibility](docs/version-compatibility.md) for Manifest v1/v3, minimum Host, optional APIs and native modules.
