# 三网 TCP 延迟任务优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将三网 TCP 测试优化为最多 12 个并发任务、每个目标最多两轮，并在管理员页面渐进显示结果。

**Architecture:** 任务执行器按 12 个目标分批运行；每轮从第 2 秒开始每秒轮询记录，最多等待 7 秒并立即删除任务，只对缺失目标启动第二轮。执行器通过批次回调返回临时结果，组件将其合并到管理员本地预览；完整结果仍由现有快照保存流程一次性公开。

**Tech Stack:** Vue 3、TypeScript、Pinia、Komari 管理 REST/RPC、Node test runner。

## Global Constraints

- 不修改 Komari 后端或 Agent。
- 任何时刻本功能临时任务不超过 12 个。
- 每个目标最多创建两轮任务，每轮从 2000 ms 开始每 1000 ms 轮询，最长等待 7000 ms 后立即删除。
- 保持 93 个固定目标、目标顺序、快照 `version: 1` 和访客只读行为。
- 取消、异常、页面卸载及列表失败必须继续执行任务名对账清理。
- 只有完整测试完成后才覆盖公开快照。

---

## File Structure

- `src/utils/threeNetworkTcpTasks.ts`：批次、两轮重试、即时清理和进度/结果回调。
- `src/components/ThreeNetworkTcpLatency.vue`：管理员临时预览、完整快照保存和旧结果恢复。
- `tests/three-network-tcp-tasks.test.mjs`：任务轮次、连接峰值、删除和进度行为。
- `tests/three-network-component-contract.test.mjs`：渐进预览与访客被动展示契约。
- `README.md`：更新测试轮次和连接行为说明。

### Task 1: 重构任务执行器为两轮即时清理与受控轮询

**Files:**
- Modify: `src/utils/threeNetworkTcpTasks.ts`
- Test: `tests/three-network-tcp-tasks.test.mjs`

**Interfaces:**
- Consumes: existing `ThreeNetworkTaskRpc` and `ThreeNetworkTaskRunnerOptions`。
- Produces: `THREE_NETWORK_BATCH_SIZE = 12`, `THREE_NETWORK_ROUND_WAIT_MS = 2000`, `THREE_NETWORK_ROUND_POLL_MS = 1000`, `THREE_NETWORK_ROUND_MAX_WAIT_MS = 7000`, and an optional `onBatchResult(result)` callback。

- [ ] **Step 1: Write failing tests**

Add tests asserting that a normal target is deleted after its first round, a missing target is recreated once, no more than 12 task definitions are visible at a time, and the callback receives each batch's partial values.

```js
test('deletes each 12-task round and retries only missing targets once', async () => {
  const batches = []
  const deleted = []
  const values = await runThreeNetworkTcpTest({
    uuid: 'node-1',
    sleep: async () => {},
    onBatchResult: result => batches.push(result),
    rpc: makeRoundAwareRpc({ deleted, missingFirstRound: [0] }),
  })
  assert.equal(values[0], 13)
  assert.equal(deleted.length, 2)
  assert.ok(deleted.every(ids => ids.length <= 12))
  assert.equal(batches.length, 8)
})
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `node --test --test-concurrency=1 tests/three-network-tcp-tasks.test.mjs`

Expected: FAIL because the current runner reads at 2 seconds even though the task interval is 5 seconds, so a record that appears at the fifth-second poll is incorrectly reported as missing.

- [ ] **Step 3: Implement one-round batch helper**

Extract a helper with this contract:

```ts
async function runTaskRound(
  definitions: readonly { index: number, task: PingTaskDefinition }[],
  options: ThreeNetworkTaskRunnerOptions,
  startedAt: number,
): Promise<{ values: Array<{ index: number, value: number | null }>, missing: typeof definitions }>
```

The helper creates the definitions, resolves IDs by exact unique task name, waits `THREE_NETWORK_ROUND_WAIT_MS`, then polls every `THREE_NETWORK_ROUND_POLL_MS` until a record is found or `THREE_NETWORK_ROUND_MAX_WAIT_MS` is reached. It deletes all resolved task IDs in a `finally` block and returns missing definitions for the second round.

- [ ] **Step 4: Implement two-round orchestration**

Set `THREE_NETWORK_BATCH_SIZE = 12`, `THREE_NETWORK_ROUND_WAIT_MS = 2000`, `THREE_NETWORK_ROUND_POLL_MS = 1000`, `THREE_NETWORK_ROUND_MAX_WAIT_MS = 7000`, and `THREE_NETWORK_MAX_ROUNDS = 2`. For each batch, call `runTaskRound` once, call it again only with missing definitions, merge second-round values over first-round values, fill unresolved values with `null`, and invoke `onBatchResult` before advancing to the next batch. Keep the existing stale-task reconciliation around the whole run.

- [ ] **Step 5: Run focused tests and verify green**

Run: `node --test --test-concurrency=1 tests/three-network-tcp-tasks.test.mjs`

Expected: all existing cleanup/cancellation tests plus the new round tests pass; every delete request contains at most 12 IDs.

- [ ] **Step 6: Type-check and commit**

Run: `node_modules\.bin\vue-tsc.cmd --build`

```bash
git add src/utils/threeNetworkTcpTasks.ts tests/three-network-tcp-tasks.test.mjs
git commit -m "perf: reduce three-network TCP task lifetime"
```

### Task 2: Add progressive administrator preview

**Files:**
- Modify: `src/components/ThreeNetworkTcpLatency.vue`
- Test: `tests/three-network-component-contract.test.mjs`

**Interfaces:**
- Consumes: `onBatchResult` callback from Task 1 and `buildThreeNetworkProvinceMap`。
- Produces: temporary administrator-only result state; existing public snapshot save remains unchanged.

- [ ] **Step 1: Write the failing component contract**

```js
assert.match(component, /onBatchResult/)
assert.match(component, /temporaryValues|previewValues/)
assert.match(component, /已完成.*31/)
assert.match(component, /snapshot.*未改变|原有结果未改变/)
```

- [ ] **Step 2: Run the contract test and verify failure**

Run: `node --test --test-concurrency=1 tests/three-network-component-contract.test.mjs`

Expected: FAIL because the current component only updates after the full runner promise resolves.

- [ ] **Step 3: Implement local preview state**

Add `previewValues = ref<(number | null)[] | null>(null)` and `completedProvinces = ref(0)`. At test start copy the existing snapshot values when available; each `onBatchResult` merges returned values into the temporary array and updates progress. Pass `buildThreeNetworkProvinceMap({ testedAt: ..., values: previewValues })` to the map while running. Do not assign the preview into `appStore.publicSettings`.

- [ ] **Step 4: Preserve commit/cancel behavior**

After the runner returns, save the complete result through `saveThreeNetworkSnapshot` exactly as before. On abort, exception or save failure, clear preview state and keep the prior snapshot. Update progress text to completed provinces out of 31 while retaining target failure count.

- [ ] **Step 5: Run focused component tests and type-check**

Run:

```bash
node --test --test-concurrency=1 tests/three-network-component-contract.test.mjs
node_modules\.bin\vue-tsc.cmd --build
```

Expected: contract tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/ThreeNetworkTcpLatency.vue tests/three-network-component-contract.test.mjs
git commit -m "feat: preview three-network results by batch"
```

### Task 3: Documentation and full verification

**Files:**
- Modify: `README.md`
- Verify: `release/komari-theme-naive-extended-build-*.zip`

- [ ] **Step 1: Update documentation**

Add that tests run in batches of 12, each target is attempted at most twice, each round begins reading at 2 seconds and polls once per second for at most 7 seconds, and only the complete final result is published to visitors.

- [ ] **Step 2: Run all tests and lint**

Run:

```powershell
pnpm test:unit
pnpm lint
```

Expected: zero failures, warnings, or errors.

- [ ] **Step 3: Build and inspect artifacts**

Run: `pnpm build`

Verify the newest theme ZIP is in `release/`, contains `dist/`, and no root ZIP is created.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md
git commit -m "docs: describe faster three-network TCP tests"
```
