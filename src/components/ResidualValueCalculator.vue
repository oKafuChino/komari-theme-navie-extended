<script setup lang="ts">
import type { ExchangeRateResult, ExchangeRateSource } from '@/utils/exchangeRates'
import type { CurrencyCode, ResidualExclusionReason, ResidualValueSummary } from '@/utils/residualValue'
import { NButton, NDrawer, NDrawerContent, NPopover, NScrollbar, NTag, NText } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { loadExchangeRates } from '@/utils/exchangeRates'
import {
  calculateResidualValueSummary,
  CURRENCY_SYMBOLS,
  formatCurrencyValue,
} from '@/utils/residualValue'

const appStore = useAppStore()
const nodesStore = useNodesStore()
const showDrawer = ref(false)
const rateResult = ref<ExchangeRateResult>({
  rates: appStore.residualValueFallbackRates,
  source: 'fallback',
  updatedAt: null,
})

const EMPTY_SUMMARY: ResidualValueSummary = Object.freeze({
  total: 0,
  includedCount: 0,
  excludedCount: 0,
  rows: [],
})

const summary = computed(() => showDrawer.value
  ? calculateResidualValueSummary(
      nodesStore.nodes,
      appStore.residualValueCurrency,
      rateResult.value.rates,
    )
  : EMPTY_SUMMARY)

const rateSourceText = computed(() => {
  const labels: Record<ExchangeRateSource, string> = {
    online: '在线汇率',
    cache: '缓存汇率',
    fallback: '备用汇率',
  }
  return labels[rateResult.value.source]
})

const updatedAtText = computed(() => {
  if (rateResult.value.updatedAt === null)
    return null
  return new Date(rateResult.value.updatedAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

let controller: AbortController | null = null
let loadVersion = 0

function storageOrNull(): Storage | null {
  try {
    return window.localStorage
  }
  catch {
    return null
  }
}

function cancelRateLoad() {
  loadVersion++
  if (controller) {
    controller.abort()
    controller = null
  }
}

async function refreshRates() {
  cancelRateLoad()
  rateResult.value = {
    rates: appStore.residualValueFallbackRates,
    source: 'fallback',
    updatedAt: null,
  }
  const version = loadVersion
  controller = new AbortController()
  const owner = controller
  const result = await loadExchangeRates({
    fallbackRates: appStore.residualValueFallbackRates,
    storage: storageOrNull(),
    signal: owner.signal,
  })
  if (owner.signal.aborted || version !== loadVersion || !showDrawer.value)
    return
  rateResult.value = result
  controller = null
}

watch(showDrawer, (open) => {
  if (open)
    void refreshRates()
  else
    cancelRateLoad()
})

onUnmounted(cancelRateLoad)

function reasonText(reason: ResidualExclusionReason | null): string {
  switch (reason) {
    case 'once':
      return '一次性计费无法折算'
    case 'invalid_cycle':
      return '计费周期无效'
    case 'invalid_date':
      return '到期时间无效'
    case 'invalid_price':
      return '价格无效'
    case 'unknown_currency':
      return '币种不受支持'
    default:
      return ''
  }
}

function sourcePriceText(price: number, currency: CurrencyCode | null): string {
  if (!Number.isFinite(price))
    return '-'
  const symbol = currency ? CURRENCY_SYMBOLS[currency] : ''
  return `${symbol}${price.toFixed(2)}`
}
</script>

<template>
  <NPopover placement="bottom" trigger="hover">
    <template #trigger>
      <NButton
        class="p-2 h-8 w-8"
        text
        circle
        aria-label="查看剩余价值"
        @click="showDrawer = true"
      >
        <span class="i-lucide-calculator text-base" aria-hidden="true" />
      </NButton>
    </template>
    剩余价值
  </NPopover>

  <NDrawer
    v-model:show="showDrawer"
    placement="right"
    width="min(420px, 94vw)"
    :trap-focus="true"
  >
    <NDrawerContent title="剩余价值" closable body-content-style="padding: 0;">
      <div class="residual-summary">
        <NText depth="3" class="residual-summary__label">
          {{ appStore.residualValueCurrency }} 总剩余价值
        </NText>
        <div class="residual-summary__amount">
          {{ formatCurrencyValue(summary.total, appStore.residualValueCurrency) }}
        </div>
        <div class="residual-summary__meta">
          <span>已计算 {{ summary.includedCount }} 台</span>
          <span v-if="summary.excludedCount > 0">未计入 {{ summary.excludedCount }} 台</span>
        </div>
      </div>

      <div class="rate-status">
        <NTag size="small" :bordered="false">
          {{ rateSourceText }}
        </NTag>
        <NText v-if="updatedAtText" depth="3" class="rate-status__time">
          更新于 {{ updatedAtText }}
        </NText>
        <NText depth="3" class="rate-status__note">
          按完整剩余天数估算
        </NText>
      </div>

      <NScrollbar class="residual-list">
        <div v-if="summary.rows.length === 0" class="residual-empty">
          暂无 VPS 数据
        </div>
        <template v-else>
          <div
            v-for="row in summary.rows"
            :key="row.uuid"
            class="residual-row"
          >
            <div class="residual-row__top">
              <span class="residual-row__name">{{ row.nodeName }}</span>
              <strong v-if="row.targetValue !== null" class="residual-row__value">
                {{ formatCurrencyValue(row.targetValue, appStore.residualValueCurrency) }}
              </strong>
              <NTag v-else size="small" type="warning" :bordered="false">
                未计入
              </NTag>
            </div>
            <div class="residual-row__details">
              <template v-if="row.reason === null">
                <span>剩余 {{ row.remainingDays }} 天</span>
                <span>{{ sourcePriceText(row.sourcePrice, row.sourceCurrency) }} / {{ row.billingCycle }} 天</span>
              </template>
              <span v-else>{{ reasonText(row.reason) }}</span>
            </div>
          </div>
        </template>
      </NScrollbar>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
.residual-summary {
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--n-border-color);
  background: color-mix(in srgb, var(--primary-color) 5%, var(--n-color));
}

.residual-summary__label {
  display: block;
  font-size: 12px;
}

.residual-summary__amount {
  margin-top: 3px;
  color: var(--primary-color);
  font-family: var(--number-font-family);
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
}

.residual-summary__meta {
  display: flex;
  margin-top: 8px;
  color: var(--n-text-color-3);
  font-size: 12px;
  gap: 14px;
}

.rate-status {
  display: flex;
  min-height: 44px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--n-border-color);
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.rate-status__time,
.rate-status__note {
  font-size: 11px;
}

.rate-status__note {
  margin-left: auto;
}

.residual-list {
  max-height: calc(100vh - 190px);
}

.residual-row {
  padding: 13px 20px;
  border-bottom: 1px solid var(--n-border-color);
}

.residual-row__top,
.residual-row__details {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.residual-row__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.residual-row__value {
  color: var(--primary-color);
  font-family: var(--number-font-family);
  font-size: 14px;
  white-space: nowrap;
}

.residual-row__details {
  margin-top: 5px;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.residual-empty {
  padding: 52px 20px;
  color: var(--n-text-color-3);
  text-align: center;
}

@media (max-width: 480px) {
  .residual-summary__amount {
    font-size: 26px;
  }

  .rate-status__note {
    width: 100%;
    margin-left: 0;
  }
}
</style>
