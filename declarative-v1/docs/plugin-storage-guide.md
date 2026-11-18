# 插件私有存储

Manifest v3 插件可以通过 SDK 在 WebTools 管理的插件命名空间中保存 JSON 数据和二进制文件。权限按插件与 Feature 声明，并由用户授权。存储按稳定的 `pluginId` 隔离；SDK 包本身不会授予访问权限。

## 声明权限

在 Manifest 根级 `requestedCapabilities` 和实际调用存储的每个 Feature 的 `requiredCapabilities` 中声明读写能力：

```json
{
  "requestedCapabilities": ["plugin.storage.read", "plugin.storage.write"],
  "features": [{
    "id": "main",
    "requiredCapabilities": ["plugin.storage.read", "plugin.storage.write"]
  }]
}
```

在插件中心授予后，当前 Feature 才能读写。只读插件可只申请 `plugin.storage.read`；不要为不使用存储的 Feature 增加权限。

## Web 插件：JSON 键值数据

```js
import { connectWebTools } from '@webtools/plugin-sdk/web'

const webtools = connectWebTools()
await webtools.ready

await webtools.storage.set('settings', { theme: 'dark', schemaVersion: 1 })
const settings = await webtools.storage.get('settings')
const keys = await webtools.storage.list('settings')
await webtools.storage.delete('settings')
```

值必须是 JSON 值；不支持 `undefined`、函数、循环引用、`BigInt`、`Date` 等非 JSON 值。单个值最多 512 KiB，插件最多 200 个键，全部键值序列化后最多 5 MiB。键名为 1–64 个 ASCII 字母、数字、下划线或连字符，不能使用 `__proto__`、`prototype`、`constructor`。`list(prefix)` 返回按字典序排列的匹配键名。

`get(key)` 对不存在的键和已存入的 JSON `null` 都返回 `null`。需要区分时，先用 `list()` 判断键是否存在，或把业务值包在对象中，例如 `{ present: true, value: null }`。

## Web 插件：二进制文件

文件 API 使用插件私有目录中的相对路径；目录分隔符为 `/`。可以按需写入浏览器选择的文件：

```js
const file = document.querySelector('input[type=file]').files[0]
await webtools.storage.files.write('attachments/' + file.name, new Uint8Array(await file.arrayBuffer()))

const saved = await webtools.storage.files.read('attachments/' + file.name)
if (saved) {
  const download = document.createElement('a')
  download.href = URL.createObjectURL(new Blob([saved]))
  download.download = file.name
  download.click()
}

const files = await webtools.storage.files.list('attachments/')
await webtools.storage.files.delete('attachments/old.bin')
```

每个文件最多 4 MiB；每个插件最多 256 个文件、总文件内容最多 32 MiB。路径最多 512 个 UTF-8 字节、12 段，每段最多 180 个字符；绝对路径、`.`/`..`、反斜杠和 Windows 不安全名称会被拒绝。`read()` 找不到文件时返回 `null`；`list(prefix)` 返回 `{ path, size }`。

## Node Command 与插件本地目录

Node Command 可通过 `invocation.webtools.storage` 使用同一套 JSON、文件和备份 API；写操作直接 `await` 即可。Command 不提供 DOM 文件选择器，可从自身业务输入或 Node 文件接口取得字节后调用 `files.write()`。

Node preload 还可以用 `getPluginPaths()` 取得包资源目录和稳定的插件本地数据目录：

```js
const { getPluginPaths } = require('@webtools/plugin-sdk/node')
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// __dirname 是当前 Node preload 文件所在的绝对目录，由 WebTools 在运行时加载。
const paths = getPluginPaths(__dirname)
const cacheFile = join(paths.localDataDirectory, 'cache.json')
await mkdir(paths.localDataDirectory, { recursive: true })
await writeFile(cacheFile, JSON.stringify({ updatedAt: Date.now() }))
const cache = JSON.parse(await readFile(cacheFile, 'utf8'))
```

`packageDirectory` 用于读取已打包的插件资源；`localDataDirectory` 是 Node 代码可用的插件专属目录，适合存放不经过 SDK 键值/文件接口的本地文件。它与 `webtools.storage` 是两个接口：原始 Node 本地文件不包含在下文的 SDK 备份中。Node 插件运行在当前用户权限下，WebTools 插件存储 API 不是 OS 文件系统沙箱。

## 设置和共享凭据的边界

- `config` 是 Manifest 声明、带类型和默认值的用户设置；`storage` 是插件自行管理的私有数据。两者各自有权限。
- `storage` 不会显示或读取其他插件的数据、WebTools 设置、SecretStore 或共享 AI 服务凭据。
- Shared AI 由宿主代理调用。插件只收到结果，不应把服务凭据复制进插件存储。
- SDK 存储 API 不提供任意数据库查询；JSON 数据按键读写，`list(prefix)` 按键名前缀筛选，文件按路径前缀列出。

## 备份与恢复

```js
const backup = await webtools.storage.backup.export()
// 将 JSON.stringify(backup) 提供给用户下载或保存。

// 读取用户明确选择的备份文件后，展示确认，再调用：
await webtools.storage.backup.import(JSON.parse(await file.text()))
```

备份格式为 `{ format: 'webtools-plugin-storage', version: 1, pluginId, exportedAt, data, files }`。文件内容以 Base64 放在 `files` 中。导出/导入只包含 SDK 插件 JSON 数据和 SDK 文件，不包含 `config`、共享 AI 凭据或 Node 的 `localDataDirectory`。

导入要求备份中的 `pluginId` 与当前插件完全一致，并会**替换**当前插件的全部 SDK 键值数据和全部 SDK 文件，不是合并：备份没有的现有键与文件会被移除。因此应在插件 UI 中说明替换行为，并在调用导入前询问用户。数据 JSON 与文件原始字节合计最多 8 MiB；Base64 会使导出的 JSON 文件更大。

## 更新、停用和卸载

- 使用相同 `pluginId` 安装升级包时，SDK 键值数据、SDK 文件和 Node 插件本地目录保持不变。保持 `pluginId` 稳定，才能找到已有数据。
- 停用插件不会删除其数据；再次启用后仍可读取。
- 卸载时宿主会单独询问是否删除插件私有数据。保留时，之后以相同 `pluginId` 重新安装可继续使用；明确选择删除才会清除 SDK 数据/文件、声明式配置和 Node 本地数据目录。
- 存储内容的业务结构由插件负责迁移。建议保留一个如 `schemaVersion` 的键，在读取后按需迁移；Manifest 配置的 schema 迁移规则不自动应用于 `storage`。

## 人工验收：platform-playground 1.14.0

配套验收插件提供 JSON 键值、文件和备份操作入口：

1. 更新安装 `webtools-plugin-platform-playground-1.14.0.wtplugin`，在插件中心授权存储读取与写入。
2. 在“插件数据存储”中将键设为 `p5-note`、值设为 `第一份数据`，点击保存、列出键名和读取；确认读回内容一致。改值后点击删除并重新读取，确认键已不存在。
3. 选择一个小于 4 MiB 的本地文件，插件内路径设为 `attachments/sample.bin`，点击保存所选文件、列出文件、读取并下载；比较下载结果与原文件。
4. 创建一组键值和文件后导出备份。再改掉该键、额外新增一个键和文件，导入刚才的备份并确认替换：原键值/文件恢复，备份之后新增的键/文件消失。
5. 隐藏并重新打开插件，再按 Esc 结束后重新进入，确认未卸载时保存的数据仍存在。
6. 可选：卸载该验收插件时选择保留数据，再用相同 ID 重装并确认数据恢复；再次卸载时选择删除数据，此操作会清除该验收插件的数据。

这组步骤只验收插件存储 API。更新或卸载其他插件不会触及本插件的数据。
