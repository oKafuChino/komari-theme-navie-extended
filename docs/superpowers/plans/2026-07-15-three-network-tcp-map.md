# 三网 TCP 延迟中国地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 VPS 详情页的三网 TCP 延迟结果以本地、交互式中国地图展示，并保留现有管理员测试与快照机制。

**Architecture:** 新增纯数据映射工具，将现有 93 项 `ThreeNetworkSnapshot.values` 转成 ECharts 地图数据、运营商详情及颜色档位。地图组件在既有异步标签页中按需加载 ECharts 和本地 GeoJSON；仅对快照做本地计算，管理员测试流程与主题设置序列化保持不变。

**Tech Stack:** Vue 3 Composition API、TypeScript、ECharts、Naive UI、Node test runner、Vite 静态资源。

## Global Constraints

- 不修改 Komari 后端或 Agent。
- 访客不得发起管理员 API、RPC 或轮询；仅读取公开主题快照。
- 保持 `ThreeNetworkSnapshots.version === 1` 和已有 93 项快照顺序兼容。
- 地图数据必须为主题包内本地 GeoJSON，包含 31 个测试省级区域与港澳台。
- 运营商详情固定显示：移动、联通、电信。
- 平均延迟只使用有效值；全失败及港澳台为灰色无数据。
- 颜色阈值：`<=50` 绿、`<=100` 青绿、`<=180` 黄、`<=300` 橙、`>300` 红。

---

## File Structure

- `public/maps/china-with-hk-macau-taiwan.geo.json`：随主题发布的本地中国地图数据。
- `src/utils/threeNetworkMap.ts`：快照到省份、运营商明细、平均值和色阶的纯映射。
- `src/components/ThreeNetworkTcpMap.vue`：图表生命周期、桌面悬浮与移动触摸交互。
- `src/components/ThreeNetworkTcpLatency.vue`：保留测试控制与统计，将表格替换为地图组件。
- `tests/three-network-map.test.mjs`：映射和边界规则单元测试。
- `tests/three-network-map-component-contract.test.mjs`：地图懒加载、本地资源和访客被动展示契约。

### Task 1: 地图数据映射工具

**Files:**
- Create: `src/utils/threeNetworkMap.ts`
- Test: `tests/three-network-map.test.mjs`

**Interfaces:**
- Consumes: `THREE_NETWORK_TARGETS` 和 `ThreeNetworkSnapshot`。
- Produces: `buildThreeNetworkProvinceMap(snapshot?: ThreeNetworkSnapshot): ThreeNetworkProvinceMapItem[]`。
- Produces: `latencyBand(value: number | null): 'good' | 'teal' | 'warn' | 'slow' | 'bad' | 'empty'`。

- [ ] **Step 1: Write the failing test**

```js
test('maps each province in mobile-unicom-telecom order and averages valid values', async () => {
  const { buildThreeNetworkProvinceMap } = await loadMapUtils()
  const values = Array(93).fill(null)
  values[0] = 60 // 河北联通
  values[1] = 30 // 河北移动
  values[2] = 90 // 河北电信
  const [hebei] = buildThreeNetworkProvinceMap({ testedAt: '2026-07-15T00:00:00.000Z', values })
  assert.deepEqual(hebei.carriers, [
    { name: '移动', value: 30 },
    { name: '联通', value: 60 },
    { name: '电信', value: 90 },
  ])
  assert.equal(hebei.average, 60)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-concurrency=1 tests/three-network-map.test.mjs`

Expected: FAIL because `threeNetworkMap.ts` does not exist.

- [ ] **Step 3: Implement the minimal mapping API**

```ts
export type ThreeNetworkLatencyBand = 'good' | 'teal' | 'warn' | 'slow' | 'bad' | 'empty'

export interface ThreeNetworkProvinceMapItem {
  readonly code: string
  readonly mapName: string
  readonly displayName: string
  readonly average: number | null
  readonly carriers: readonly { name: '移动' | '联通' | '电信', value: number | null }[]
  readonly band: ThreeNetworkLatencyBand
  readonly isTested: boolean
}

export function buildThreeNetworkProvinceMap(snapshot?: ThreeNetworkSnapshot): ThreeNetworkProvinceMapItem[]
```

Build province groups from `THREE_NETWORK_TARGETS`, locate each carrier by code, and emit the carriers in `cm`, `cu`, `ct` order. Round average latency with `Math.round`. Append fixed Hong Kong, Macau and Taiwan records with `average: null`, `band: 'empty'` and `isTested: false`.

- [ ] **Step 4: Add failure and threshold cases**

```js
test('uses only valid values, handles empty provinces, special regions and inclusive band boundaries', async () => {
  const { buildThreeNetworkProvinceMap, latencyBand } = await loadMapUtils()
  const values = Array(93).fill(null)
  values[0] = 100
  const [hebei] = buildThreeNetworkProvinceMap({ testedAt: '2026-07-15T00:00:00.000Z', values })
  assert.equal(hebei.average, 100)
  assert.equal(hebei.band, 'teal')
  assert.equal(buildThreeNetworkProvinceMap().find(item => item.code === 'hk')?.isTested, false)
  assert.deepEqual([50, 51, 100, 101, 180, 181, 300, 301].map(latencyBand), ['good', 'teal', 'teal', 'warn', 'warn', 'slow', 'slow', 'bad'])
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test --test-concurrency=1 tests/three-network-map.test.mjs`

Expected: PASS with all mapping and threshold assertions green.

- [ ] **Step 6: Commit**

```bash
git add src/utils/threeNetworkMap.ts tests/three-network-map.test.mjs
git commit -m "feat: map three-network TCP latency by province"
```

### Task 2: 本地 GeoJSON 与 ECharts 地图组件

**Files:**
- Create: `public/maps/china-with-hk-macau-taiwan.geo.json`
- Create: `src/components/ThreeNetworkTcpMap.vue`
- Test: `tests/three-network-map-component-contract.test.mjs`

**Interfaces:**
- Consumes: `provinceItems: readonly ThreeNetworkProvinceMapItem[]`。
- Produces: 自己维护的单一 ECharts 实例；卸载时销毁。

- [ ] **Step 1: Write the failing component/resource contract**

```js
test('loads a local China GeoJSON only from the map component and renders a passive map', async () => {
  const component = await readFile(new URL('../src/components/ThreeNetworkTcpMap.vue', import.meta.url), 'utf8')
  const geojson = await readFile(new URL('../public/maps/china-with-hk-macau-taiwan.geo.json', import.meta.url), 'utf8')
  assert.match(component, /fetch\('\/maps\/china-with-hk-macau-taiwan\.geo\.json'\)/)
  assert.match(component, /registerMap\('china-with-hk-macau-taiwan'/)
  assert.match(component, /onBeforeUnmount/)
  assert.match(component, /chart\.dispose\(\)/)
  assert.doesNotMatch(component, /getSharedApi|createThreeNetworkTaskRpc|runThreeNetworkTcpTest/)
  assert.match(geojson, /香港|澳门|台湾/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-concurrency=1 tests/three-network-map-component-contract.test.mjs`

Expected: FAIL because the component and GeoJSON do not exist.

- [ ] **Step 3: Add licensed local GeoJSON**

Add a vendored, license-compatible China GeoJSON containing province features named to match the controlled `mapName` values, including `香港`, `澳门`, `台湾`. Preserve the source license in an adjacent `public/maps/README.md` if attribution is required by the dataset.

- [ ] **Step 4: Implement the map component**

```vue
<script setup lang="ts">
const props = defineProps<{ provinceItems: readonly ThreeNetworkProvinceMapItem[] }>()
const container = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

onMounted(async () => {
  const geojson = await fetch('/maps/china-with-hk-macau-taiwan.geo.json').then(response => response.json())
  echarts.registerMap('china-with-hk-macau-taiwan', geojson)
  chart = echarts.init(container.value!)
  chart.setOption(createMapOption(props.provinceItems))
})

onBeforeUnmount(() => chart?.dispose())
</script>
```

Use an ECharts `map` series with `visualMap` pieces matching the approved thresholds. The tooltip formatter must list `移动`, `联通`, `电信` in that exact order and render `失败` for `null`. Bind click events so a click/tap on a province shows the same tooltip; a click with no region hides it. Add a throttled resize handler and remove it on unmount. Expose a compact `NAlert` when loading fails.

- [ ] **Step 5: Run contract test to verify it passes**

Run: `node --test --test-concurrency=1 tests/three-network-map-component-contract.test.mjs`

Expected: PASS; local resource, lifecycle, passive behavior and GeoJSON coverage are asserted.

- [ ] **Step 6: Type-check**

Run: `node_modules\.bin\vue-tsc.cmd --build`

Expected: exit code 0.

- [ ] **Step 7: Commit**

```bash
git add public/maps src/components/ThreeNetworkTcpMap.vue tests/three-network-map-component-contract.test.mjs
git commit -m "feat: render three-network TCP latency map"
```

### Task 3: 替换详情页表格并保留测试操作

**Files:**
- Modify: `src/components/ThreeNetworkTcpLatency.vue`
- Modify: `tests/three-network-component-contract.test.mjs`
- Test: `tests/three-network-map-component-contract.test.mjs`

**Interfaces:**
- Consumes: `buildThreeNetworkProvinceMap(snapshot.value)` 和 `ThreeNetworkTcpMap`。
- Preserves: `startTest()`, `cancelTest()`, `saveThreeNetworkSnapshot()` 与原有空状态和管理员按钮。

- [ ] **Step 1: Extend the existing failing component contract**

```js
assert.match(source, /import ThreeNetworkTcpMap from '@\/components\/ThreeNetworkTcpMap\.vue'/)
assert.match(source, /buildThreeNetworkProvinceMap\(snapshot\.value\)/)
assert.match(source, /<ThreeNetworkTcpMap :province-items="provinceItems" \/>/)
assert.doesNotMatch(source, /latency-table|latency-row/)
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `node --test --test-concurrency=1 tests/three-network-component-contract.test.mjs`

Expected: FAIL because the existing component still renders the table.

- [ ] **Step 3: Replace only presentation-specific table code**

```ts
const provinceItems = computed(() => buildThreeNetworkProvinceMap(snapshot.value))
```

Replace the table template and its table-only styles with:

```vue
<ThreeNetworkTcpMap v-else :province-items="provinceItems" />
```

Do not alter the `isRunning`, `onProgress`, `saveThreeNetworkSnapshot`, public-settings refresh, abort behavior, or administrator-only control logic.

- [ ] **Step 4: Run focused tests and type check**

Run:

```bash
node --test --test-concurrency=1 tests/three-network-map.test.mjs tests/three-network-map-component-contract.test.mjs tests/three-network-component-contract.test.mjs
node_modules\.bin\vue-tsc.cmd --build
```

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThreeNetworkTcpLatency.vue tests/three-network-component-contract.test.mjs
git commit -m "feat: display TCP latency as China map"
```

### Task 4: 回归、构建与发布检查

**Files:**
- Modify if needed: `README.md`
- Verify: `release/komari-theme-naive-extended-build-*.zip`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a production ZIP containing the map asset and map component bundle.

- [ ] **Step 1: Document the map presentation briefly**

Add one README sentence stating that the 93 target results are rendered as an offline China map, colors use valid three-network averages, and hover/tap shows details in 移动、联通、电信 order.

- [ ] **Step 2: Run the complete test suite**

Run: `pnpm test:unit`

Expected: all tests pass, including existing snapshot/task tests and new map tests.

- [ ] **Step 3: Run lint and build**

Run:

```bash
pnpm lint
pnpm build
```

Expected: both commands exit 0; build writes the current theme ZIP and Live2D template ZIP to `release/`.

- [ ] **Step 4: Inspect the release artifact**

Run:

```powershell
$zip = Get-ChildItem release\komari-theme-naive-extended-build-*.zip | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip.FullName)
$archive.Entries | Where-Object FullName -like 'dist/*china-with-hk-macau-taiwan*'
$archive.Dispose()
```

Expected: a packaged map asset or its Vite-emitted equivalent exists under `dist/`; ZIP still includes `komari-theme.json`, `preview.png` and `dist/`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: describe three-network latency map"
```
