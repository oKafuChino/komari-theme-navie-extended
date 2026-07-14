# Residual Value Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in Header calculator that opens a lightweight right-side drawer and converts every Komari VPS residual value into one administrator-selected currency.

**Architecture:** Pure calculation logic lives in `src/utils/residualValue.ts`; browser-only Frankfurter fetching and 12-hour caching live in `src/utils/exchangeRates.ts`. A focused Vue component owns the icon, drawer, abort lifecycle, and presentation, while the app store normalizes managed settings and Header only controls placement.

**Tech Stack:** Vue 3 Composition API, Pinia, Naive UI, dayjs, browser `fetch`/`localStorage`, Node test runner, Vite, TypeScript.

## Global Constraints

- Do not modify Komari backend files, APIs, databases, or services.
- Keep the feature disabled by default.
- When disabled, perform zero residual calculations and zero exchange-rate requests.
- When enabled but unopened, do not fetch rates or iterate nodes for residual values.
- Support only `¥`/CNY, `$`/USD, `€`/EUR, and `£`/GBP; `¥` always means CNY.
- Reuse `getDaysUntilExpired(node.expired_at)` so values match Komari card day counts.
- Floor remaining time to complete days and cap each result at one billing-cycle price.
- Do not add runtime dependencies, polling, charts, Canvas, or animation loops.
- Preserve ambient effects, Live2D, the 150% viewport fix, and release ZIP contracts.

---

### Task 1: Pure residual-value calculation

**Files:**
- Create: `src/utils/residualValue.ts`
- Create: `tests/residual-value.test.mjs`

**Interfaces:**
- Consumes: `Pick<NodeData, 'uuid' | 'name' | 'price' | 'billing_cycle' | 'currency' | 'expired_at'>` and `getDaysUntilExpired`.
- Produces: `CurrencyCode`, `ExchangeRates`, `ResidualValueRow`, `ResidualValueSummary`, `normalizeCurrency`, `parseFallbackRates`, `calculateResidualValueSummary`, `formatCurrencyValue`.

- [ ] **Step 1: Write failing tests for currency, fallback-rate, node, sorting, and total behavior**

```js
assert.equal(value.normalizeCurrency('¥'), 'CNY')
assert.equal(value.normalizeCurrency('$'), 'USD')
assert.equal(value.normalizeCurrency('€'), 'EUR')
assert.equal(value.normalizeCurrency('£'), 'GBP')
assert.equal(value.normalizeCurrency('JPY'), null)

assert.deepEqual(value.parseFallbackRates('{"CNY":1,"USD":7.2,"EUR":7.8,"GBP":9.2}'), {
  CNY: 1, USD: 7.2, EUR: 7.8, GBP: 9.2,
})
assert.deepEqual(value.parseFallbackRates('{"CNY":2}'), value.DEFAULT_RESIDUAL_RATES)

const FULL_DATE = '2027-01-01T00:00:00Z'
const PARTIAL_DATE = '2027-02-01T00:00:00Z'
const EXPIRED_DATE = '2020-01-01T00:00:00Z'
const nodes = [
  { uuid: '1', name: 'Full', price: 20, billing_cycle: 30, currency: '$', expired_at: FULL_DATE },
  { uuid: '2', name: 'Partial', price: 28, billing_cycle: 90, currency: 'CNY', expired_at: PARTIAL_DATE },
  { uuid: '3', name: 'Expired', price: 5, billing_cycle: 30, currency: '¥', expired_at: EXPIRED_DATE },
  { uuid: '4', name: 'Once', price: 50, billing_cycle: -1, currency: '$', expired_at: FULL_DATE },
  { uuid: '5', name: 'Bad date', price: 50, billing_cycle: 30, currency: '$', expired_at: 'not-a-date' },
  { uuid: '6', name: 'Unknown', price: 50, billing_cycle: 30, currency: 'JPY', expired_at: FULL_DATE },
]
const rates = { CNY: 1, USD: 7.2, EUR: 7.8, GBP: 9.2 }
const summary = value.calculateResidualValueSummary(nodes, 'CNY', rates, expiredAt => ({
  [FULL_DATE]: 15,
  [EXPIRED_DATE]: -2,
  [PARTIAL_DATE]: 45,
}[expiredAt] ?? 0))
assert.equal(summary.total, 86)
assert.equal(summary.includedCount, 3)
assert.equal(summary.excludedCount, 3)
assert.deepEqual(summary.rows.map(row => row.nodeName), ['Full', 'Partial', 'Expired', 'Once', 'Bad date', 'Unknown'])
assert.equal(summary.rows[0].targetValue, 72)
assert.equal(summary.rows[1].targetValue, 14)
assert.equal(summary.rows[2].targetValue, 0)
assert.equal(summary.rows[3].reason, 'once')
assert.equal(value.formatCurrencyValue(42.5, 'GBP'), '£42.50')
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run: `node --test --test-concurrency=1 tests/residual-value.test.mjs`

Expected: FAIL because `src/utils/residualValue.ts` does not exist.

- [ ] **Step 3: Implement the complete pure API**

```ts
import type { NodeData } from '@/stores/nodes'
import dayjs from 'dayjs'
import { getDaysUntilExpired } from '@/utils/tagHelper'

export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'GBP'
export type ResidualExclusionReason = 'once' | 'invalid_cycle' | 'invalid_date' | 'invalid_price' | 'unknown_currency'
export type ExchangeRates = Record<CurrencyCode, number>
export type ResidualNode = Pick<NodeData, 'uuid' | 'name' | 'price' | 'billing_cycle' | 'currency' | 'expired_at'>

export const DEFAULT_RESIDUAL_RATES: ExchangeRates = Object.freeze({ CNY: 1, USD: 7.2, EUR: 7.8, GBP: 9.2 })
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = Object.freeze({ CNY: '¥', USD: '$', EUR: '€', GBP: '£' })

export interface ResidualValueRow {
  uuid: string
  nodeName: string
  remainingDays: number | null
  sourcePrice: number
  billingCycle: number
  sourceCurrency: CurrencyCode | null
  sourceValue: number
  targetValue: number | null
  reason: ResidualExclusionReason | null
}

export interface ResidualValueSummary {
  total: number
  includedCount: number
  excludedCount: number
  rows: ResidualValueRow[]
}

export function normalizeCurrency(value: unknown): CurrencyCode | null
export function parseFallbackRates(value: unknown): ExchangeRates
export function calculateResidualValueSummary(
  nodes: readonly ResidualNode[],
  targetCurrency: CurrencyCode,
  rates: ExchangeRates,
  remainingDaysResolver?: (expiredAt: string) => number,
): ResidualValueSummary
export function formatCurrencyValue(value: number, currency: CurrencyCode): string
```

Implementation rules: normalize trimmed symbols/codes; validate all four positive finite rates with `CNY === 1`; validate dates with `dayjs(...).isValid()`; treat `price === 0 || price === -1` as included zero-value rows; exclude other invalid prices; exclude `billing_cycle === -1` as `once`; compute `Math.min(price, price * Math.max(days, 0) / billing_cycle)`; convert with `sourceValue * rates[source] / rates[target]`; sort included rows by target value descending and excluded rows last while preserving source order for ties.

- [ ] **Step 4: Run the focused test and confirm all cases pass**

Run: `node --test --test-concurrency=1 tests/residual-value.test.mjs`

Expected: all residual-value tests PASS.

- [ ] **Step 5: Commit the pure calculation unit**

```bash
git add src/utils/residualValue.ts tests/residual-value.test.mjs
git commit -m "feat: add residual value calculations"
```

### Task 2: Exchange-rate fetching, validation, caching, and aborts

**Files:**
- Create: `src/utils/exchangeRates.ts`
- Create: `tests/exchange-rates.test.mjs`

**Interfaces:**
- Consumes: `ExchangeRates` from Task 1.
- Produces: `ExchangeRateSource`, `ExchangeRateResult`, `loadExchangeRates`, `readCachedExchangeRates`, `parseFrankfurterRates`.

- [ ] **Step 1: Write failing tests with injected fetch, storage, clock, and AbortSignal**

```js
assert.deepEqual(rates.parseFrankfurterRates({
  base: 'CNY', date: '2026-07-14', rates: { USD: 0.14, EUR: 0.12, GBP: 0.105 },
}), { CNY: 1, USD: 1 / 0.14, EUR: 1 / 0.12, GBP: 1 / 0.105 })

const cached = await rates.loadExchangeRates({
  fallbackRates, storage: validCacheStorage, now: () => now, fetcher: mustNotRun,
})
assert.equal(cached.source, 'cache')

const online = await rates.loadExchangeRates({
  fallbackRates, storage, now: () => now, fetcher: successfulFetcher,
})
assert.equal(online.source, 'online')
assert.equal(JSON.parse(storage.value).expiresAt, now + 12 * 60 * 60 * 1000)

const fallback = await rates.loadExchangeRates({ fallbackRates, storage: throwingStorage, fetcher: failingFetcher })
assert.equal(fallback.source, 'fallback')

const owner = new AbortController()
const pending = rates.loadExchangeRates({ fallbackRates, fetcher: abortableFetcher, signal: owner.signal })
owner.abort()
assert.equal((await pending).source, 'fallback')
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run: `node --test --test-concurrency=1 tests/exchange-rates.test.mjs`

Expected: FAIL because `src/utils/exchangeRates.ts` does not exist.

- [ ] **Step 3: Implement the exchange-rate API**

```ts
import type { ExchangeRates } from '@/utils/residualValue'

export type ExchangeRateSource = 'online' | 'cache' | 'fallback'
export interface ExchangeRateResult {
  rates: ExchangeRates
  source: ExchangeRateSource
  updatedAt: number | null
}
interface CachedExchangeRates {
  rates: ExchangeRates
  updatedAt: number
  expiresAt: number
}
export interface LoadExchangeRatesOptions {
  fallbackRates: ExchangeRates
  fetcher?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  signal?: AbortSignal
  now?: () => number
  timeoutMs?: number
}

export const EXCHANGE_RATE_URL = 'https://api.frankfurter.app/latest?from=CNY&to=USD,EUR,GBP'
export const EXCHANGE_RATE_CACHE_KEY = 'komari-naive-extended:residual-value:rates:v1'
export const EXCHANGE_RATE_CACHE_MS = 12 * 60 * 60 * 1000

export function parseFrankfurterRates(value: unknown): ExchangeRates | null
export function readCachedExchangeRates(storage: LoadExchangeRatesOptions['storage'], now: number): ExchangeRateResult | null
export async function loadExchangeRates(options: LoadExchangeRatesOptions): Promise<ExchangeRateResult>
```

Implementation rules: validate `base === 'CNY'`; invert the three positive finite response rates; read cache before fetch; use an owned `AbortController` linked to the component signal and a 2500 ms timer; request with `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, and `cache: 'no-store'`; clear timer/listener in `finally`; catch network/storage/JSON errors; never retry; return fallback without throwing.

- [ ] **Step 4: Run the focused test and confirm all cache/network branches pass**

Run: `node --test --test-concurrency=1 tests/exchange-rates.test.mjs`

Expected: all exchange-rate tests PASS.

- [ ] **Step 5: Commit the exchange-rate unit**

```bash
git add src/utils/exchangeRates.ts tests/exchange-rates.test.mjs
git commit -m "feat: add cached exchange rates"
```

### Task 3: Managed settings and store normalization

**Files:**
- Modify: `komari-theme.json`
- Modify: `src/stores/app.ts`
- Create: `tests/residual-value-settings.test.mjs`

**Interfaces:**
- Consumes: `CurrencyCode`, `ExchangeRates`, `parseFallbackRates` from Task 1.
- Produces from app store: `residualValueEnabled: boolean`, `residualValueCurrency: CurrencyCode`, `residualValueFallbackRates: ExchangeRates`.

- [ ] **Step 1: Write failing manifest and store tests**

```js
assert.deepEqual(item('residualValueEnabled'), {
  key: 'residualValueEnabled', name: '启用剩余价值计算器', type: 'switch', default: false,
  help: '在公共探针页面向访客显示所有 VPS 的剩余价值',
})
assert.deepEqual(item('residualValueCurrency'), {
  key: 'residualValueCurrency', name: '剩余价值目标币种', type: 'select', default: 'CNY',
  options: 'CNY,USD,EUR,GBP', help: '将剩余价值统一换算为指定币种',
})
assert.equal(store.residualValueEnabled, false)
assert.equal(store.residualValueCurrency, 'CNY')
assert.deepEqual(store.residualValueFallbackRates, DEFAULT_RESIDUAL_RATES)
```

- [ ] **Step 2: Run and confirm settings are missing**

Run: `node --test --test-concurrency=1 tests/residual-value-settings.test.mjs`

Expected: FAIL because the manifest/store settings do not exist.

- [ ] **Step 3: Add settings after the Live2D section and normalize them in the store**

```ts
const residualValueEnabled = computed(() => resolveBooleanThemeSetting(
  publicSettings.value?.theme_settings,
  'residualValueEnabled',
  false,
))
const residualValueCurrency = computed<CurrencyCode>(() => {
  const value = publicSettings.value?.theme_settings?.residualValueCurrency
  return value === 'CNY' || value === 'USD' || value === 'EUR' || value === 'GBP' ? value : 'CNY'
})
const residualValueFallbackRates = computed(() => parseFallbackRates(
  publicSettings.value?.theme_settings?.residualValueFallbackRates,
))
```

Return all three computed values from `useAppStore` and add the exact manifest entries asserted by the test, with fallback default `{"CNY":1,"USD":7.2,"EUR":7.8,"GBP":9.2}`.

- [ ] **Step 4: Run the focused settings test**

Run: `node --test --test-concurrency=1 tests/residual-value-settings.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit managed settings**

```bash
git add komari-theme.json src/stores/app.ts tests/residual-value-settings.test.mjs
git commit -m "feat: configure residual value calculator"
```

### Task 4: Header icon and lightweight right-side drawer

**Files:**
- Create: `src/components/ResidualValueCalculator.vue`
- Modify: `src/components/Header.vue`
- Create: `tests/residual-value-component-contract.test.mjs`

**Interfaces:**
- Consumes: app-store settings, `useNodesStore().nodes`, `calculateResidualValueSummary`, `formatCurrencyValue`, `loadExchangeRates`.
- Produces: one calculator trigger before the theme button and one lazy-use drawer.

- [ ] **Step 1: Write failing component contract tests**

```js
assert.match(header, /import ResidualValueCalculator/)
assert.match(header, /<ResidualValueCalculator\s+v-if="appStore\.residualValueEnabled"\s*\/>[\s\S]*v-for="button in actionButtons"/)
assert.match(component, /i-lucide-calculator/)
assert.match(component, /NDrawer/)
assert.match(component, /placement="right"/)
assert.match(component, /width="min\(420px, 94vw\)"/)
assert.match(component, /watch\(showDrawer/)
assert.match(component, /controller\.abort\(\)/)
assert.match(component, /showDrawer\.value\s*\?\s*calculateResidualValueSummary/)
assert.doesNotMatch(component, /setInterval|Canvas|echarts/)
```

- [ ] **Step 2: Run and confirm the component is missing**

Run: `node --test --test-concurrency=1 tests/residual-value-component-contract.test.mjs`

Expected: FAIL because the component/import does not exist.

- [ ] **Step 3: Implement `ResidualValueCalculator.vue`**

The component must import `NButton`, `NDrawer`, `NDrawerContent`, `NPopover`, `NScrollbar`, `NTag`, and `NText`; render a text/circle icon button with tooltip “剩余价值”; and render the drawer only while `showDrawer` is true. Initialize `rates` from `appStore.residualValueFallbackRates`, then load cached/online rates on open with an `AbortController`. Abort and clear the owner on close/unmount. Define summary lazily:

```ts
const summary = computed(() => showDrawer.value
  ? calculateResidualValueSummary(
      nodesStore.nodes,
      appStore.residualValueCurrency,
      rates.value,
    )
  : { total: 0, includedCount: 0, excludedCount: 0, rows: [] })
```

Use a single unframed summary band and a divider-separated list. Show total, included/excluded counts, rate source/update time, node name, `remainingDays`, `sourcePrice / billingCycle`, formatted target value, or localized reason. Use `width="min(420px, 94vw)"`, `placement="right"`, `:trap-focus="true"`, and no nested cards, charts, animations, or polling.

- [ ] **Step 4: Place the component immediately before the existing action-button loop**

```vue
<NFlex class="flex gap-4">
  <ResidualValueCalculator v-if="appStore.residualValueEnabled" />
  <NPopover v-for="button in actionButtons" ...>
```

This exact placement keeps it left of the auto/light/dark theme button because theme remains the first item in `actionButtons`.

- [ ] **Step 5: Run component and full unit tests**

Run: `node --test --test-concurrency=1 tests/residual-value-component-contract.test.mjs`

Expected: PASS.

Run: `pnpm test:unit`

Expected: all tests PASS, including ambient and Live2D suites.

- [ ] **Step 6: Commit the UI integration**

```bash
git add src/components/ResidualValueCalculator.vue src/components/Header.vue tests/residual-value-component-contract.test.mjs
git commit -m "feat: add residual value drawer"
```

### Task 5: Privacy documentation and release verification

**Files:**
- Modify: `README.md`
- Create: `tests/residual-value-release-contract.test.mjs`

**Interfaces:**
- Consumes: the public API/cache behavior from Tasks 2 and 4.
- Produces: user-facing disclosure and verified release artifact.

- [ ] **Step 1: Write a failing README disclosure contract**

```js
assert.match(readme, /剩余价值计算器/)
assert.match(readme, /Frankfurter/)
assert.match(readme, /访客.*IP/)
assert.match(readme, /12 小时/)
assert.match(readme, /备用汇率/)
assert.match(readme, /不修改 Komari 后端/)
```

- [ ] **Step 2: Run and confirm README lacks the disclosure**

Run: `node --test --test-concurrency=1 tests/residual-value-release-contract.test.mjs`

Expected: FAIL on the missing calculator disclosure.

- [ ] **Step 3: Add a concise README section**

Document that the feature is disabled by default, uses Komari price/cycle/currency/expiry data in the browser, calls Frankfurter only after the drawer opens, caches valid rates for 12 hours, exposes the visitor IP to that service, falls back to administrator rates, and does not modify Komari backend state.

```markdown
## 剩余价值计算器

管理员可在主题设置中启用剩余价值计算器，并选择 CNY、USD、EUR 或 GBP 作为目标币种。计算只使用 Komari 已公开的价格、计费周期、币种和到期时间数据，并在访客浏览器中完成，不修改 Komari 后端。

访客首次打开抽屉时，浏览器会请求 Frankfurter 获取汇率；该服务会接触访客 IP。有效汇率在浏览器缓存 12 小时，网络失败时自动使用管理员配置的备用汇率。功能默认关闭，关闭或未打开抽屉时不会请求汇率。
```

- [ ] **Step 4: Run complete verification**

Run: `pnpm test:unit`

Expected: all tests PASS.

Run: `pnpm lint`

Expected: oxlint and ESLint report zero errors.

Run: `pnpm build`

Expected: `vue-tsc --build` and Vite succeed and create `komari-theme-naive-extended-build-<sha>.zip`.

Inspect the ZIP and confirm it contains `dist/`, `komari-theme.json`, and `preview.png`; contains only the existing Live2D runtime/model guide contract; and contains no administrator model files.

- [ ] **Step 5: Commit documentation and final contracts**

```bash
git add README.md tests/residual-value-release-contract.test.mjs
git commit -m "docs: document residual value rates"
```
