# 三网 TCP 延迟 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an administrator-triggered, low-load 93-target three-network TCP latency tab to each VPS detail page, with visitors able to read only the administrator's latest saved result.

**Architecture:** The frontend constructs all targets from a fixed 31-province catalog and creates short-lived native Komari `tcp` PingTasks in batches of 24. A pure snapshot module validates and serializes the 93 ordered results; the existing Komari theme-settings save capability persists that snapshot for public readers. A lazy detail-page component owns the administrator-only task lifecycle, while visitors only render normalized state from the app store.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Naive UI, existing Komari JSON-RPC client, Node test runner, Vite.

## Global Constraints

- Do not modify Komari backend files, Agent files, database schema, reverse-proxy configuration, deployment files, or open ports.
- Do not add runtime dependencies, external services, Canvas, ECharts, animation loops, automatic retries, scheduled tests, or visitor-triggered probes.
- Use only the fixed `*.ip.zstaticcdn.com:80` target catalog supplied in the design; never accept a target, port, protocol, client UUID, or node list from user-controlled input.
- A test may create at most 93 tasks, must create at most 24 concurrently, uses a 5-second task interval, waits at most 12 further seconds per batch, and must delete every task it created in `finally`.
- Only a Komari-authenticated administrator may invoke write/admin RPCs. Visitors must never call `admin:*` methods, create a timer, poll, or make a new request after the public settings load.
- Persist only `{ version, nodes[uuid].testedAt, nodes[uuid].values }`; each values array has exactly 93 integer milliseconds in `0..60000` or `null`.
- Preserve the existing load/ping charts, ambient effects, Live2D behavior, residual-value calculator, package layout, and release ZIP contract.

Every new test that imports a TypeScript source module must begin with this exact Vite prelude before its test cases:

```js
import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'

let vite
before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
})
after(async () => {
  await vite.close()
})
```

---

### Task 1: Verify the required native persistence contract

**Files:**
- Modify: `docs/superpowers/specs/2026-07-15-three-network-tcp-latency-design.md` only if the verified endpoint name or parameters differ from its documented abstraction.
- Modify: `docs/superpowers/plans/2026-07-15-three-network-tcp-latency.md` only if the verified endpoint name or parameters differ from this plan.

**Interfaces:**
- Consumes: an authenticated administrator session against the exact Komari version that will host the theme.
- Produces: a verified native request that accepts a complete `theme_settings` object, preserves unknown keys, and makes `threeNetworkTcpSnapshots` visible to `common:getPublicInfo`.

- [ ] **Step 1: Inspect the installed Komari admin route/RPC source and the runtime method list**

Use the exact Komari deployment source for the target version and, while logged in as an administrator, invoke the existing method discovery APIs:

```ts
const rpc = getSharedRpc()
const methods = await rpc.getMethods()
const help = await rpc.getHelp()
console.table(methods.filter(method => method.startsWith('admin:')))
console.table(help.filter(method => method.name.includes('Theme') || method.name.includes('Public') || method.name.includes('Setting')))
```

Record the existing administrator method or same-origin REST endpoint that saves managed theme settings. Record its exact request shape and response shape from the Komari source; do not infer the endpoint name from UI labels.

Also verify the authorization model: `src/utils/api.ts` exposes only `MeInfo.logged_in`, so the authenticated session shown by `appStore.isLoggedIn` must be the Komari administrator session that is authorized for `admin:*` methods. If the target Komari deployment supports non-administrator logged-in accounts, record its existing public role field and add it to `MeInfo`/the app store before rendering the control; do not use a client-side username allowlist.

- [ ] **Step 2: Verify unknown-key preservation with a disposable value**

Starting from the complete current settings object, send one authenticated update containing a disposable internal key and immediately re-read public info:

```ts
const before = await rpc.getPublicInfo()
const candidate = {
  ...(before.theme_settings ?? {}),
  __naiveExtendedProbe: 'remove-after-check',
}
// Call the exact native write capability discovered in Step 1 with candidate.
const after = await rpc.getPublicInfo()
console.assert(after.theme_settings?.__naiveExtendedProbe === 'remove-after-check')
```

Restore `before.theme_settings` immediately after the check. The check passes only when all pre-existing keys remain byte-for-byte equivalent in their native values and the disposable key is returned by `common:getPublicInfo`.

- [ ] **Step 3: Apply the stop condition before changing theme source**

Do not continue to Task 2 unless all statements are true:

```text
The native write capability requires Komari administrator authentication.
`appStore.isLoggedIn` either represents that administrator authentication or is paired with a verified public administrator-role field.
It accepts a complete theme-settings object without clearing unrelated keys.
It returns or is followed by a public-info response containing the new internal key.
It does not require a Komari backend or Agent code change.
```

If any statement is false, stop implementation, remove the disposable key if it exists, and return to feature design. Do not substitute localStorage, a custom endpoint, a new service, a retained periodic PingTask, or a database write.

- [ ] **Step 4: Commit the verified contract record**

```bash
git add docs/superpowers/specs/2026-07-15-three-network-tcp-latency-design.md docs/superpowers/plans/2026-07-15-three-network-tcp-latency.md
git commit -m "docs: verify TCP latency persistence contract"
```

### Task 2: Add the immutable target catalog and safe snapshot primitives

**Files:**
- Create: `src/utils/threeNetworkTargets.ts`
- Create: `src/utils/threeNetworkSnapshot.ts`
- Create: `tests/three-network-targets.test.mjs`
- Create: `tests/three-network-snapshot.test.mjs`

**Interfaces:**
- Produces: `THREE_NETWORK_TARGETS`, `THREE_NETWORK_TARGET_COUNT`, `ThreeNetworkTarget`, `ThreeNetworkSnapshot`, `ThreeNetworkSnapshots`, `parseThreeNetworkSnapshots`, `mergeThreeNetworkSnapshot`, and `serializeThreeNetworkSnapshots`.
- Consumes later: the task runner uses `THREE_NETWORK_TARGETS[index]`; the store and component use the parse/merge functions exclusively.

- [ ] **Step 1: Write the failing catalog and snapshot tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'

test('creates exactly 93 fixed IPv4 TCP targets in province/carrier order', async () => {
  const catalog = await vite.ssrLoadModule('/src/utils/threeNetworkTargets.ts')
  assert.equal(catalog.THREE_NETWORK_TARGET_COUNT, 93)
  assert.equal(catalog.THREE_NETWORK_TARGETS.length, 93)
  assert.deepEqual(catalog.THREE_NETWORK_TARGETS.slice(0, 3).map(item => item.host), [
    'he-cu-v4.ip.zstaticcdn.com', 'he-cm-v4.ip.zstaticcdn.com', 'he-ct-v4.ip.zstaticcdn.com',
  ])
  assert.deepEqual(catalog.THREE_NETWORK_TARGETS.slice(-3).map(item => item.host), [
    'cq-cu-v4.ip.zstaticcdn.com', 'cq-cm-v4.ip.zstaticcdn.com', 'cq-ct-v4.ip.zstaticcdn.com',
  ])
  assert.ok(catalog.THREE_NETWORK_TARGETS.every(item => item.port === 80))
  assert.ok(Object.isFrozen(catalog.THREE_NETWORK_TARGETS))
})

test('accepts only complete version-one snapshots and preserves other nodes', async () => {
  const snapshots = await vite.ssrLoadModule('/src/utils/threeNetworkSnapshot.ts')
  const values = Array.from({ length: 93 }, (_, index) => index === 1 ? null : index)
  const first = snapshots.parseThreeNetworkSnapshots(JSON.stringify({
    version: 1,
    nodes: { first: { testedAt: '2026-07-15T00:00:00.000Z', values } },
  }))
  assert.equal(first.nodes.first.values.length, 93)
  assert.equal(first.nodes.first.values[1], null)
  const merged = snapshots.mergeThreeNetworkSnapshot(first, 'second', {
    testedAt: '2026-07-15T00:01:00.000Z', values: Array(93).fill(25),
  })
  assert.deepEqual(Object.keys(merged.nodes).sort(), ['first', 'second'])
  assert.deepEqual(snapshots.parseThreeNetworkSnapshots('{bad json}'), { version: 1, nodes: {} })
  assert.deepEqual(snapshots.parseThreeNetworkSnapshots(JSON.stringify({
    version: 1, nodes: { broken: { testedAt: 'no', values: [1] } },
  })), { version: 1, nodes: {} })
})
```

- [ ] **Step 2: Run the focused tests and confirm the modules are absent**

Run: `node --test --test-concurrency=1 tests/three-network-targets.test.mjs tests/three-network-snapshot.test.mjs`

Expected: FAIL because the target catalog and snapshot module do not exist.

- [ ] **Step 3: Implement the fixed catalog**

Create `src/utils/threeNetworkTargets.ts` with this complete province order and generated carrier triples. Use `Object.freeze` for the catalog and each returned entry.

```ts
export const PROVINCES = Object.freeze([
  ['he', '河北'], ['sx', '山西'], ['ln', '辽宁'], ['jl', '吉林'], ['hl', '黑龙江'],
  ['js', '江苏'], ['zj', '浙江'], ['ah', '安徽'], ['fj', '福建'], ['jx', '江西'],
  ['sd', '山东'], ['ha', '河南'], ['hb', '湖北'], ['hn', '湖南'], ['gd', '广东'],
  ['hi', '海南'], ['sc', '四川'], ['gz', '贵州'], ['yn', '云南'], ['sn', '陕西'],
  ['gs', '甘肃'], ['qh', '青海'], ['nm', '内蒙古'], ['gx', '广西'], ['xz', '西藏'],
  ['nx', '宁夏'], ['xj', '新疆'], ['bj', '北京'], ['tj', '天津'], ['sh', '上海'], ['cq', '重庆'],
] as const)
export const CARRIERS = Object.freeze([
  ['cu', '联通'], ['cm', '移动'], ['ct', '电信'],
] as const)
export interface ThreeNetworkTarget {
  readonly key: string
  readonly provinceCode: string
  readonly provinceName: string
  readonly carrierCode: 'cu' | 'cm' | 'ct'
  readonly carrierName: string
  readonly host: string
  readonly port: 80
}
export const THREE_NETWORK_TARGETS = Object.freeze(PROVINCES.flatMap(([provinceCode, provinceName]) =>
  CARRIERS.map(([carrierCode, carrierName]) => Object.freeze({
    key: `${provinceCode}-${carrierCode}`,
    provinceCode,
    provinceName,
    carrierCode,
    carrierName,
    host: `${provinceCode}-${carrierCode}-v4.ip.zstaticcdn.com`,
    port: 80 as const,
  })),
))
export const THREE_NETWORK_TARGET_COUNT = THREE_NETWORK_TARGETS.length
```

- [ ] **Step 4: Implement strict snapshot functions**

```ts
export interface ThreeNetworkSnapshot {
  testedAt: string
  values: readonly (number | null)[]
}
export interface ThreeNetworkSnapshots {
  version: 1
  nodes: Record<string, ThreeNetworkSnapshot>
}
export const EMPTY_THREE_NETWORK_SNAPSHOTS: ThreeNetworkSnapshots = Object.freeze({ version: 1, nodes: {} })
export function parseThreeNetworkSnapshots(value: unknown): ThreeNetworkSnapshots
export function mergeThreeNetworkSnapshot(
  current: ThreeNetworkSnapshots,
  uuid: string,
  snapshot: ThreeNetworkSnapshot,
): ThreeNetworkSnapshots
export function serializeThreeNetworkSnapshots(value: ThreeNetworkSnapshots): string
```

`parseThreeNetworkSnapshots` accepts only a JSON string containing `version: 1`; only UUID keys with a valid ISO date and exactly 93 values survive. A value must be `null` or an integer in `0..60000`. Return a fresh `{ version: 1, nodes: {} }` for unreadable input and omit only invalid node entries in an otherwise valid root. `mergeThreeNetworkSnapshot` validates its two inputs, returns a fresh object, and never mutates the input object or arrays.

- [ ] **Step 5: Run the focused tests**

Run: `node --test --test-concurrency=1 tests/three-network-targets.test.mjs tests/three-network-snapshot.test.mjs`

Expected: PASS with two passing suites.

- [ ] **Step 6: Commit the pure domain layer**

```bash
git add src/utils/threeNetworkTargets.ts src/utils/threeNetworkSnapshot.ts tests/three-network-targets.test.mjs tests/three-network-snapshot.test.mjs
git commit -m "feat: add three-network TCP data model"
```

### Task 3: Add typed native PingTask wrappers and a bounded task runner

**Files:**
- Modify: `src/utils/api.ts`
- Modify: `src/utils/rpc.ts`
- Create: `src/utils/threeNetworkTcpTasks.ts`
- Create: `tests/three-network-tcp-tasks.test.mjs`

**Interfaces:**
- Consumes: the exact PingTask parameter names verified from current Komari source in Task 1, `THREE_NETWORK_TARGETS`, and the generic RPC client.
- Produces: `PingTaskDefinition`, `CreatedPingTask`, `ThreeNetworkTaskResult`, `runThreeNetworkTcpTest(options)`, and typed `KomariRpc` methods for add/list/delete/read.

- [ ] **Step 1: Write failing runner tests with injected RPC, clock, sleep, and cancellation**

```js
test('runs fixed targets in batches of 24 and rounds only valid first records', async () => {
  const { runThreeNetworkTcpTest } = await vite.ssrLoadModule('/src/utils/threeNetworkTcpTasks.ts')
  const calls = []
  const values = await runThreeNetworkTcpTest({
    uuid: 'node-1', now: () => 1000, sleep: async () => {},
    rpc: {
      async addPingTask(task) { calls.push(task); return { id: calls.length } },
      async getPingRecords(id) { return { records: [{ task_id: id, time: '2026-07-15T00:00:00.000Z', value: 12.6 }] } },
      async deletePingTask() {},
    },
  })
  assert.equal(calls.length, 93)
  assert.ok(calls.every(task => task.type === 'tcp' && task.interval === 5 && task.clients.length === 1 && task.clients[0] === 'node-1'))
  assert.equal(values.length, 93)
  assert.equal(values[0], 13)
})

test('converts per-target errors to null and deletes every created task after cancellation', async () => {
  const controller = new AbortController()
  let deleted = 0
  const promise = runThreeNetworkTcpTest({
    uuid: 'node-1', signal: controller.signal, now: () => 1000, sleep: async () => controller.abort(),
    rpc: {
      async addPingTask() { return { id: 99 } },
      async getPingRecords() { return { records: [] } },
      async deletePingTask() { deleted++ },
    },
  })
  await assert.rejects(promise, { name: 'AbortError' })
  assert.equal(deleted, 1)
})
```

- [ ] **Step 2: Run the focused runner test and confirm the module is absent**

Run: `node --test --test-concurrency=1 tests/three-network-tcp-tasks.test.mjs`

Expected: FAIL because `threeNetworkTcpTasks.ts` is missing.

- [ ] **Step 3: Add exact typed RPC methods and data types**

In `src/utils/api.ts`, add types that match the verified native response rather than reusing the incomplete existing chart-only `PingTask` interface. In `src/utils/rpc.ts`, add methods with the exact verified parameter shape, following the existing `getRecords` wrapper pattern:

```ts
async addPingTask(task: PingTaskDefinition): Promise<CreatedPingTask>
async deletePingTask(id: number): Promise<void>
async getAllPingTasks(): Promise<CreatedPingTask[]>
async getPingRecords(taskId: number, hours: number, maxCount: number): Promise<{ records: PingRecord[] }>
```

The add wrapper must construct only `{ name, type: 'tcp', target, clients: [uuid], interval: 5 }` from validated values. The delete wrapper must receive an integer positive ID. Never expose `client.call('admin:*')` from a component.

- [ ] **Step 4: Implement the bounded runner**

```ts
export const THREE_NETWORK_BATCH_SIZE = 24
export const THREE_NETWORK_TASK_INTERVAL_SECONDS = 5
export const THREE_NETWORK_BATCH_WAIT_MS = 12_000
export interface ThreeNetworkTaskRunnerOptions {
  uuid: string
  rpc: Pick<KomariRpc, 'addPingTask' | 'deletePingTask' | 'getPingRecords'>
  signal?: AbortSignal
  now?: () => number
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
  onProgress?: (completed: number, failures: number) => void
}
export async function runThreeNetworkTcpTest(options: ThreeNetworkTaskRunnerOptions): Promise<(number | null)[]>
```

Build task names as `naive-tcp-v1-${uuid}-${now()}-${index}`. Iterate `THREE_NETWORK_TARGETS` in consecutive slices of 24; create one batch with `Promise.allSettled`, wait 5 seconds, and read only created task IDs until the batch has records or the extra 12-second deadline expires. Select the first record whose `task_id` matches and timestamp is after the batch start; round nonnegative finite values and return `null` otherwise. Throw `DOMException('Cancelled', 'AbortError')` when the signal aborts. Keep all successfully created IDs in one array and delete them with `Promise.allSettled` in `finally`, including IDs from a partially created batch.

- [ ] **Step 5: Expand the test for timeouts, malformed records, batch boundaries, and task cleanup**

Add assertions that task 24 is the first task of the second batch, a negative/NaN/foreign-task record becomes `null`, each created task receives at most five read requests (the first read plus four 3-second waits before the 12-second deadline), and delete calls equal the number of successful creates after both success and failure.

- [ ] **Step 6: Run the focused runner test**

Run: `node --test --test-concurrency=1 tests/three-network-tcp-tasks.test.mjs`

Expected: PASS with all batching, error, abort, and cleanup cases passing.

- [ ] **Step 7: Commit the task transport layer**

```bash
git add src/utils/api.ts src/utils/rpc.ts src/utils/threeNetworkTcpTasks.ts tests/three-network-tcp-tasks.test.mjs
git commit -m "feat: run bounded TCP latency tasks"
```

### Task 4: Normalize and persist snapshots through the verified native setting capability

**Files:**
- Modify: `src/stores/app.ts`
- Modify: `src/utils/rpc.ts`
- Create: `src/utils/threeNetworkSettings.ts`
- Create: `tests/three-network-settings.test.mjs`

**Interfaces:**
- Consumes: `ThreeNetworkSnapshots`, `parseThreeNetworkSnapshots`, `mergeThreeNetworkSnapshot`, `serializeThreeNetworkSnapshots`, and the exact native settings writer verified in Task 1.
- Produces: `appStore.threeNetworkTcpSnapshots` and `saveThreeNetworkSnapshot(uuid, snapshot, currentSettings)`.

- [ ] **Step 1: Write failing store and settings-writer tests**

```js
test('normalizes malformed public snapshot settings to an empty v1 object', async () => {
  const { createPinia, setActivePinia } = await import('pinia')
  const { useAppStore } = await vite.ssrLoadModule('/src/stores/app.ts')
  setActivePinia(createPinia())
  const store = useAppStore()
  store.publicSettings = { theme_settings: { threeNetworkTcpSnapshots: '{not json}' } }
  assert.deepEqual(store.threeNetworkTcpSnapshots, { version: 1, nodes: {} })
})

test('writes a merged current-node snapshot without deleting unrelated settings', async () => {
  const { saveThreeNetworkSnapshot } = await vite.ssrLoadModule('/src/utils/threeNetworkSettings.ts')
  const { parseThreeNetworkSnapshots } = await vite.ssrLoadModule('/src/utils/threeNetworkSnapshot.ts')
  const settings = { sakuraEnabled: true, threeNetworkTcpSnapshots: JSON.stringify({ version: 1, nodes: {} }) }
  let written
  await saveThreeNetworkSnapshot({
    uuid: 'node-1', snapshot: { testedAt: '2026-07-15T00:00:00.000Z', values: Array(93).fill(10) },
    currentSettings: settings,
    writeSettings: async value => { written = value },
  })
  assert.equal(written.sakuraEnabled, true)
  assert.equal(parseThreeNetworkSnapshots(written.threeNetworkTcpSnapshots).nodes['node-1'].values[0], 10)
})
```

- [ ] **Step 2: Run the focused settings test and confirm failure**

Run: `node --test --test-concurrency=1 tests/three-network-settings.test.mjs`

Expected: FAIL because the snapshot store value and writer helper do not exist.

- [ ] **Step 3: Implement a pure read-modify-write helper**

```ts
export interface SaveThreeNetworkSnapshotOptions {
  uuid: string
  snapshot: ThreeNetworkSnapshot
  currentSettings: Record<string, unknown> | null | undefined
  writeSettings: (settings: Record<string, unknown>) => Promise<void>
}
export async function saveThreeNetworkSnapshot(options: SaveThreeNetworkSnapshotOptions): Promise<Record<string, unknown>>
```

Copy all current settings with `{ ...(currentSettings ?? {}) }`, parse only `threeNetworkTcpSnapshots`, merge the validated current-node value, serialize it, call `writeSettings` once, and return the exact candidate object. Reject invalid UUID/snapshot data before calling the writer. Never mutate the input settings object and never manually stringify any other setting.

- [ ] **Step 4: Add store normalization and the verified native writer wrapper**

Add this computed value to `src/stores/app.ts` and export it in the returned store object:

```ts
const threeNetworkTcpSnapshots = computed(() => parseThreeNetworkSnapshots(
  publicSettings.value?.theme_settings?.threeNetworkTcpSnapshots,
))
```

In `src/utils/rpc.ts`, implement one typed wrapper for the exact administrator settings capability confirmed by Task 1. The wrapper must require the full `Record<string, unknown>` object, must not silently retry, and must re-read `common:getPublicInfo` after the write to verify the serialized `threeNetworkTcpSnapshots` value exactly matches the candidate. A mismatch throws an error and leaves the prior visitor result in place.

- [ ] **Step 5: Run the focused settings tests**

Run: `node --test --test-concurrency=1 tests/three-network-settings.test.mjs`

Expected: PASS with malformed-setting fallback and unrelated-key preservation verified.

- [ ] **Step 6: Commit snapshot persistence**

```bash
git add src/stores/app.ts src/utils/rpc.ts src/utils/threeNetworkSettings.ts tests/three-network-settings.test.mjs
git commit -m "feat: persist TCP latency snapshots"
```

### Task 5: Build the lazy, read-only-first detail component and wire the tab

**Files:**
- Create: `src/components/ThreeNetworkTcpLatency.vue`
- Modify: `src/views/InstanceDetail.vue`
- Create: `tests/three-network-component-contract.test.mjs`

**Interfaces:**
- Consumes: `appStore.isLoggedIn`, `appStore.threeNetworkTcpSnapshots`, fixed catalog, task runner, snapshot settings writer, and node UUID/online props.
- Produces: one lazy `tcp-network` tab after `ping`, with administrator controls and visitor-only rendering.

- [ ] **Step 1: Write failing component and tab contract tests**

```js
test('adds the TCP tab after the existing ping chart and lazy-loads its component', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(new URL('../src/views/InstanceDetail.vue', import.meta.url), 'utf8')
  assert.match(source, /defineAsyncComponent\(\(\) => import\('\@\/components\/ThreeNetworkTcpLatency\.vue'\)\)/)
  assert.match(source, /<NTabPane name="ping"[\s\S]*?<\/NTabPane>\s*<NTabPane name="tcp-network" tab="三网 TCP 延迟">/)
})

test('renders visitor snapshots without administrator RPCs and bounds administrator controls', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(new URL('../src/components/ThreeNetworkTcpLatency.vue', import.meta.url), 'utf8')
  assert.match(source, /defineProps<\{[\s\S]*uuid: string[\s\S]*online: boolean/)
  assert.match(source, /v-if="appStore\.isLoggedIn"/)
  assert.match(source, /runThreeNetworkTcpTest/)
  assert.match(source, /onBeforeUnmount/)
  assert.match(source, /controller\.abort\(\)/)
  assert.doesNotMatch(source, /setInterval|Canvas|echarts|fetch\(/)
})
```

- [ ] **Step 2: Run the component contract test and confirm failure**

Run: `node --test --test-concurrency=1 tests/three-network-component-contract.test.mjs`

Expected: FAIL because the component and third tab do not exist.

- [ ] **Step 3: Implement `ThreeNetworkTcpLatency.vue`**

Use `NButton`, `NDataTable` or a semantic CSS grid, `NEmpty`, `NProgress`, `NTag`, and `NText`; do not add a card inside the existing tab surface. Render the normalized current-node snapshot immediately. A missing snapshot renders the static text `管理员尚未完成测试`.

Create `isRunning`, `completed`, `failures`, `error`, and one `AbortController | null`. For `appStore.isLoggedIn`, show a primary “开始三网 TCP 测试” button, disabled when `!online || isRunning`; while running replace it with a secondary “取消测试” button and a determinate progress indicator. `startTest` creates the controller, calls `runThreeNetworkTcpTest`, creates a complete snapshot with `new Date().toISOString()`, calls `saveThreeNetworkSnapshot` with the store's current settings and the verified RPC writer, then refreshes public info. In `catch`, ignore `AbortError` and render other errors; in `finally`, clear the controller and running state. `onBeforeUnmount` aborts the controller.

Group the static catalog by province. Desktop uses the three carrier columns in `cu`, `cm`, `ct` order. Under `640px`, use a one-column province group with three labelled rows. A value displays as `<integer> ms`; `null` displays `失败`. Use three deterministic classes: `good` for `< 80`, `warn` for `80..180`, `bad` for `> 180`; `null` uses `muted`. Preserve focus outlines and use CSS variables/Naive colors for light and dark modes.

- [ ] **Step 4: Add the asynchronous detail-page tab**

In `src/views/InstanceDetail.vue`, add:

```ts
const ThreeNetworkTcpLatency = defineAsyncComponent(() => import('@/components/ThreeNetworkTcpLatency.vue'))
const chartView = ref<'load' | 'ping' | 'tcp-network'>('load')
```

Then add after the existing `ping` pane:

```vue
<NTabPane name="tcp-network" tab="三网 TCP 延迟">
  <ThreeNetworkTcpLatency :uuid="data.uuid" :online="data.online" />
</NTabPane>
```

- [ ] **Step 5: Run component contracts and the entire unit suite**

Run: `node --test --test-concurrency=1 tests/three-network-component-contract.test.mjs`

Expected: PASS.

Run: `pnpm test:unit`

Expected: all existing and new Node test suites PASS.

- [ ] **Step 6: Commit the detail UI**

```bash
git add src/components/ThreeNetworkTcpLatency.vue src/views/InstanceDetail.vue tests/three-network-component-contract.test.mjs
git commit -m "feat: show three-network TCP latency"
```

### Task 6: Document operational limits and verify the release artifact

**Files:**
- Modify: `README.md`
- Create: `tests/three-network-release-contract.test.mjs`

**Interfaces:**
- Consumes: final feature behavior and release configuration.
- Produces: administrator-facing operating guidance and a verified release build.

- [ ] **Step 1: Write the failing documentation contract**

```js
test('documents the administrator-only bounded TCP test', async () => {
  const { readFile } = await import('node:fs/promises')
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  assert.match(readme, /三网 TCP 延迟/)
  assert.match(readme, /管理员/)
  assert.match(readme, /93/)
  assert.match(readme, /24/)
  assert.match(readme, /不修改 Komari 后端或 Agent/)
  assert.match(readme, /zstaticcdn\.com/)
})
```

- [ ] **Step 2: Run the documentation contract and confirm failure**

Run: `node --test --test-concurrency=1 tests/three-network-release-contract.test.mjs`

Expected: FAIL because README does not document the feature.

- [ ] **Step 3: Add a concise README section**

Document that the tab measures the VPS Agent to 93 fixed `ip.zstaticcdn.com:80` endpoints, only a logged-in administrator can start it, a run is capped at 24 concurrent temporary TCP tasks and stores only the latest 93-value result, visitors see that saved result without probing, and the feature changes neither Komari backend nor Agent. State that failed targets display as `失败` and that interrupted runs retain the prior complete result.

- [ ] **Step 4: Run all validation and inspect the generated ZIP**

Run: `pnpm test:unit`

Expected: every test passes.

Run: `pnpm lint`

Expected: oxlint and ESLint finish with zero errors.

Run: `pnpm build`

Expected: `vue-tsc --build` and Vite succeed and create `komari-theme-naive-extended-build-<sha>.zip` under `release/` according to the existing build contract.

Inspect the archive and confirm it contains `dist/`, `komari-theme.json`, and `preview.png`; it must not contain test fixtures, snapshots, raw ping records, or live administrator data.

- [ ] **Step 5: Commit the documentation and final contracts**

```bash
git add README.md tests/three-network-release-contract.test.mjs
git commit -m "docs: explain three-network TCP latency"
```
