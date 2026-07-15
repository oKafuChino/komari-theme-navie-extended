<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { ThreeNetworkProvinceMapItem } from '@/utils/threeNetworkMap'
import { MapChart } from 'echarts/charts'
import { GeoComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { NAlert } from 'naive-ui'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  provinceItems: readonly ThreeNetworkProvinceMapItem[]
}>()

echarts.use([GeoComponent, TooltipComponent, VisualMapComponent, MapChart, CanvasRenderer])

const container = ref<HTMLElement | null>(null)
const loadError = ref('')
let chart: echarts.ECharts | null = null
let resizeTimer: number | null = null

const bandColors = Object.freeze({
  good: '#22a06b',
  teal: '#14b8a6',
  warn: '#eab308',
  slow: '#f97316',
  bad: '#ef4444',
})

function displayLatency(value: number | null): string {
  return value === null ? '失败' : `${value} ms`
}

function tooltipFormatter(params: unknown): string {
  const name = typeof params === 'object' && params !== null && 'name' in params && typeof params.name === 'string'
    ? params.name
    : undefined
  const item = props.provinceItems.find(candidate => candidate.mapName === name)
  if (!item)
    return ''

  const details = item.carriers
    .map(carrier => `<div class="three-network-map-tooltip__row"><span>${carrier.name}</span><strong>${displayLatency(carrier.value)}</strong></div>`)
    .join('')
  const average = item.average === null ? (item.isTested ? '无数据' : '未测试') : `${item.average} ms`
  return `<div class="three-network-map-tooltip"><strong>${item.displayName}</strong><div class="three-network-map-tooltip__average">平均延迟：${average}</div>${details}</div>`
}

function option(): EChartsOption {
  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: 'rgba(20, 25, 34, 0.94)',
      borderWidth: 0,
      textStyle: { color: '#fff' },
      formatter: tooltipFormatter,
    },
    visualMap: {
      type: 'piecewise',
      left: 14,
      bottom: 12,
      itemGap: 4,
      itemWidth: 14,
      itemHeight: 10,
      textStyle: { color: 'inherit', fontSize: 11 },
      pieces: [
        { lte: 50, label: '≤ 50 ms', color: bandColors.good },
        { gt: 50, lte: 100, label: '51–100 ms', color: bandColors.teal },
        { gt: 100, lte: 180, label: '101–180 ms', color: bandColors.warn },
        { gt: 180, lte: 300, label: '181–300 ms', color: bandColors.slow },
        { gt: 300, label: '> 300 ms', color: bandColors.bad },
      ],
      outOfRange: { color: '#9ca3af' },
    },
    series: [{
      type: 'map',
      map: 'china-with-hk-macau-taiwan',
      roam: false,
      nameProperty: 'name',
      emphasis: {
        label: { show: false },
        itemStyle: { areaColor: '#60a5fa' },
      },
      itemStyle: { borderColor: 'rgba(255, 255, 255, 0.65)', borderWidth: 0.8 },
      data: props.provinceItems.map(item => ({
        name: item.mapName,
        value: item.average ?? undefined,
        itemStyle: item.average === null ? { areaColor: '#9ca3af' } : undefined,
      })),
    }],
  }
}

function updateChart(): void {
  chart?.setOption(option(), { notMerge: true, lazyUpdate: true })
}

function resize(): void {
  if (resizeTimer !== null)
    window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => chart?.resize(), 100)
}

async function initialize(): Promise<void> {
  try {
    const response = await fetch('/maps/china-with-hk-macau-taiwan.geo.json')
    if (!response.ok)
      throw new Error(`地图资源请求失败（${response.status}）`)
    echarts.registerMap('china-with-hk-macau-taiwan', await response.json())
    await nextTick()
    if (!container.value)
      return
    chart = echarts.init(container.value)
    updateChart()
    window.addEventListener('resize', resize, { passive: true })
    chart.on('click', (params) => {
      if (params.componentType === 'series' && typeof params.dataIndex === 'number') {
        chart?.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: params.dataIndex })
      }
      else {
        chart?.dispatchAction({ type: 'hideTip' })
      }
    })
  }
  catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '地图加载失败'
  }
}

onMounted(() => {
  void initialize()
})

watch(() => props.provinceItems, updateChart, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (resizeTimer !== null)
    window.clearTimeout(resizeTimer)
  if (chart)
    chart.dispose()
  chart = null
})
</script>

<template>
  <NAlert v-if="loadError" type="error" title="地图加载失败" class="three-network-map__error">
    {{ loadError }}
  </NAlert>
  <div v-else ref="container" class="three-network-map" role="img" aria-label="中国各省三网 TCP 延迟地图" />
</template>

<style scoped lang="scss">
.three-network-map {
  width: 100%;
  height: min(68vw, 560px);
  min-height: 320px;
}

.three-network-map__error {
  margin-top: 12px;
}

:global(.three-network-map-tooltip) {
  min-width: 144px;
}

:global(.three-network-map-tooltip__average) {
  margin: 6px 0;
  color: rgba(255, 255, 255, 0.76);
  font-size: 12px;
}

:global(.three-network-map-tooltip__row) {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  line-height: 1.8;
}

@media (max-width: 640px) {
  .three-network-map {
    height: 112vw;
    min-height: 360px;
  }
}
</style>
