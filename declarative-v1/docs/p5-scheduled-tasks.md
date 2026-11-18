# P5 定时任务开发指南

对应 `@webtools/plugin-sdk` **1.15.1** 和包含 P5 的 **Rust 托盘宿主**。插件为 Manifest v3 的 Web 或 Node 运行时。SDK 版本与产品版本独立；仅更新 SDK 不会为旧宿主增加调度能力。

## 声明与授权

在 `requestedCapabilities` 以及接收任务的 Feature 的 `requiredCapabilities` 中声明 `plugin.tasks`。读写执行日志还需声明 `plugin.storage.read`、`plugin.storage.write`；通知需 `system.notification`。

```json
{
  "requestedCapabilities": ["plugin.tasks", "plugin.storage.read", "plugin.storage.write"],
  "features": [{
    "id": "reminder",
    "title": "提醒",
    "entry": { "kind": "web-bundle", "document": "web/index.html" },
    "requiredCapabilities": ["plugin.tasks", "plugin.storage.read", "plugin.storage.write"]
  }]
}
```

这是清单片段，其他必填字段仍按完整 Manifest v3 规范提供。安装和启用的能力授权不会自动创建任务。每次 `tasks.request()` 都要求当前插件窗口的用户操作，并弹出宿主拥有的原生确认窗口，显示插件、任务描述、代码和时间规则；取消后不会写入任务。普通 Node 命令可在一次用户激活期间请求创建任务；定时触发的 Node 命令没有该激活权限。开发项目预览中的任务持久化不可用，请安装 `.wtplugin` 验收。

## Web API

```js
import { connectWebTools } from '@webtools/plugin-sdk/web'
const webtools = connectWebTools()

// 必须在每次页面初始化时注册；隐藏的临时页面也会执行这里。
webtools.tasks.onTrigger(async ({ code, executionId, scheduledAtMs }) => {
  const history = await webtools.storage.get('task-history')
  await webtools.storage.set('task-history', [
    ...(Array.isArray(history) ? history : []),
    { code, executionId, scheduledAtMs, completedAtMs: Date.now() },
  ].slice(-30))
  // return/resolve 记录成功，throw/reject 记录失败。
})

await webtools.ready
document.querySelector('#create').onclick = async () => {
  await webtools.tasks.request({
    code: 'daily-reminder',
    description: '每天上午 9:30 保存提醒记录',
    schedule: { kind: 'cron', expression: '30 9 * * *' },
  })
}
```

一次任务：

```js
await webtools.tasks.request({
  code: 'one-reminder',
  description: '30 秒后提醒一次',
  schedule: { kind: 'once', atMs: Date.now() + 30_000 },
})
```

限定周期窗口：

```js
await webtools.tasks.request({
  code: 'weekday-window',
  description: '接下来一小时内，每个工作日每五分钟执行',
  schedule: {
    kind: 'cron', expression: '*/5 * * * MON-FRI',
    startMs: Date.now(), endMs: Date.now() + 3_600_000,
  },
})
const tasks = await webtools.tasks.list()
await webtools.tasks.remove('weekday-window') // Promise<boolean>
```

- `code`：插件内唯一，1–64 个 ASCII 字母、数字、`_`、`-`；不要使用 `constructor`、`prototype`、`__proto__`。代码由插件选择，所有权由宿主绑定当前插件和 Feature，调用不能指定其他插件。
- `description`：非空，最多 1024 UTF-8 字节，用于用户确认。
- `once.atMs`：未来的 Unix 毫秒时间戳。
- `cron.expression`：标准五字段“分 时 日 月 周”。支持 `*`、逗号列表、范围和步长；月可写 JAN–DEC，周可写 SUN–SAT；周日为 0 或 7。使用本机时区，无秒字段、`@daily` 或自定义时区。当日和周均有限制时，按 cron 的 OR 规则匹配。
- `startMs`、`endMs`：可选 Unix 毫秒边界；开始必须早于结束。不在结束窗口后补执行过期周期。
- 每插件最多保留 64 条任务（包括已结束历史）；重复代码必须先删除，正在执行的同代码不能重新创建。
- `onTrigger()` 只允许一个回调，返回本地取消订阅函数。回调执行期限 30 秒；没有注册、超时、页面故障、被撤销或异步抛错均作为失败处理。任务没有默认用户手势，不能据此截图、读取当前剪贴板或粘贴到前台。

`list()` 仅列出本插件的记录，包含 `code`、`featureId`、`schedule`、`enabled`、`running`、`nextRunMs`、`createdAtMs`、`lastRunMs`、`successes`、`failures` 和 `lastError`。一次任务完成后保留一条 `enabled: false` 的统计历史；这是本实现为可核对结果保留的行为，**不会再次执行**。删除任务会删除记录与未来执行，不撤销已经提交的回调副作用。

## Node 命令

Node `node-command` Feature 使用现有命令处理器接收 `task`；不依赖页面事件。Node 页面 Feature 则与 Web 一样使用隐藏页面和 `onTrigger()`。

```js
const { defineCommand } = require('@webtools/plugin-sdk/node')
module.exports = defineCommand(async ({ task, webtools, signal }) => {
  if (task) {
    await webtools.storage.set('last-task', {
      code: task.code, executionId: task.executionId, scheduledAtMs: task.scheduledAtMs,
    })
    return
  }
  // 普通用户调用可以请求定时任务；仍须通过真实宿主确认。
  await webtools.tasks.request({ code: 'command-once', description: '稍后运行此命令',
    schedule: { kind: 'once', atMs: Date.now() + 30_000 } })
})
```

Node 命令的 `task` 仅在定时执行时出现。处理器 resolve 表示成功，throw/reject 表示失败；复用现有 30 秒命令执行期限和执行子进程清理逻辑。定时执行不提供普通用户调用的前台手势。

## 宿主与重启规则

Rust 托盘启动即加载并轮询计划，不要求先打开搜索框或 Electron。生产记录保存在 `%APPDATA%\Nook\plugin-scheduled-tasks.json`；测试使用显式 `WT_PROFILE_ROOT`，不在仓库里保存用户计划。

到期任务取得临时宿主所有权，经现有命名管道启动或复用 Electron。每次执行重新读取已安装插件和当前授权。Web 使用单独的隐藏运行环境，不替换已有插件窗口、不发 launcher enter/show 事件、不获取焦点；完成后只清理本次创建的运行环境。Node 命令使用现有受控命令子进程。最后一个任务结束后释放所有权，Electron 仅在没有其他窗口或工作时正常退出。

同任务不会重叠。整个触发（包括等待授权队列与页面加载）有 60 秒执行生存期，超时后撤销授权并等待本次运行环境停止，再释放同代码执行锁；已过期的排队授权即使稍后获准也不会启动插件。该期限位于 Rust 90 秒传输等待以内，并为既有清理期限留出余量。回调本身另受 30 秒期限约束。

宿主运行期间睡眠或延迟造成的多个错过周期合并为一次；进程重启后周期任务直接计算下一个未来时间，不补跑历史。一旦宿主停止期间错过一次任务，它在下次启动后尝试一次。宿主中断时处于运行状态的任务记为失败，不重放不确定的执行。

停用、卸载或撤销 `plugin.tasks` 会暂停计划；失效 Feature/包在触发时也会暂停，不会每分钟反复唤醒 Electron。重新启用插件不会自动恢复这些计划，需用户删除旧记录并再次确认创建。回调自身的普通错误只累加失败统计，周期任务仍按后续计划运行。

## 人工验收

导入 `webtools-plugin-platform-playground-1.15.0.wtplugin`，确认升级并启用新增能力，打开“插件平台验收”顶部“定时任务验收”。

1. 点击“30 秒后执行一次”，先在宿主确认窗口取消；刷新应无新增任务。再次创建并确认，刷新可见下次时间。
2. 关闭插件及 Manager 窗口，保留 Rust 托盘。到期后收到通知；重新打开插件刷新，成功数为 1、记录已结束，执行历史有相同稳定代码。
3. 点击“30 秒后故意失败”并确认。到期后刷新，失败数为 1，`lastError` 包含 intentional failure。
4. 使用不同代码创建 `* * * * *` 周期，设置起止边界。跨分钟验证下一次时间与成功数；删除后不再运行。结束时间经过后不再补执行。
5. 创建周期后停用插件；计划暂停。重新启用后刷新，已暂停记录不自动恢复，删除并重新创建才能继续。卸载与撤销权限具有相同暂停语义。
6. 保留其他插件窗口并等待任务到期，原窗口应不被替换、关闭或抢焦点；结束后其他窗口保持可用。全部窗口关闭时，任务完成后 Electron 应正常退出。
7. 周期任务存在时退出整个托盘，错过多个周期后重新启动。应只安排未来的下一次；一次任务过期则只尝试一次，不能出现积压风暴。

自动化真实宿主验收脚本为仓库的 `scripts/verify-p5-scheduled-tasks.mjs`；它使用独立测试目录预置“已确认”夹具任务，并验证 Rust 定时、真实 Web/Node 执行、成功失败统计、存储副作用及 Electron 空闲退出。原生确认的可见内容和取消行为仍需上述人工验收。

## 平台统一管理（2026-11-15）

在设置 → 定时任务查看全部插件任务、最近 30 次执行日志并确认删除。插件内 list/remove 仍限定当前插件。旧记录的历史统计保留，新执行才开始记录日志。详见仓库 docs/p5-schedule-management.md 与配套验收报告。
