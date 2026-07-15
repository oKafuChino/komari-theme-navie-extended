import type { ThreeNetworkSnapshot } from '@/utils/threeNetworkSnapshot'
import { THREE_NETWORK_TARGETS } from '@/utils/threeNetworkTargets'

export type ThreeNetworkLatencyBand = 'good' | 'teal' | 'warn' | 'slow' | 'bad' | 'empty'

export interface ThreeNetworkProvinceCarrier {
  readonly name: '移动' | '联通' | '电信'
  readonly value: number | null
}

export interface ThreeNetworkProvinceMapItem {
  readonly code: string
  readonly mapName: string
  readonly displayName: string
  readonly average: number | null
  readonly carriers: readonly ThreeNetworkProvinceCarrier[]
  readonly band: ThreeNetworkLatencyBand
  readonly isTested: boolean
}

const MAP_NAMES: Readonly<Record<string, string>> = Object.freeze({
  he: '河北',
  sx: '山西',
  ln: '辽宁',
  jl: '吉林',
  hl: '黑龙江',
  js: '江苏',
  zj: '浙江',
  ah: '安徽',
  fj: '福建',
  jx: '江西',
  sd: '山东',
  ha: '河南',
  hb: '湖北',
  hn: '湖南',
  gd: '广东',
  hi: '海南',
  sc: '四川',
  gz: '贵州',
  yn: '云南',
  sn: '陕西',
  gs: '甘肃',
  qh: '青海',
  nm: '内蒙古',
  gx: '广西',
  xz: '西藏',
  nx: '宁夏',
  xj: '新疆',
  bj: '北京',
  tj: '天津',
  sh: '上海',
  cq: '重庆',
})

const UNTESTED_REGIONS = Object.freeze([
  { code: 'hk', mapName: '香港' },
  { code: 'mo', mapName: '澳门' },
  { code: 'tw', mapName: '台湾' },
] as const)

const CARRIER_ORDER = Object.freeze([
  ['cm', '移动'],
  ['cu', '联通'],
  ['ct', '电信'],
] as const)

export function latencyBand(value: number | null): ThreeNetworkLatencyBand {
  if (value === null)
    return 'empty'
  if (value <= 50)
    return 'good'
  if (value <= 100)
    return 'teal'
  if (value <= 180)
    return 'warn'
  if (value <= 300)
    return 'slow'
  return 'bad'
}

function emptyCarriers(): readonly ThreeNetworkProvinceCarrier[] {
  return CARRIER_ORDER.map(([, name]) => ({ name, value: null }))
}

export function buildThreeNetworkProvinceMap(snapshot?: ThreeNetworkSnapshot): readonly ThreeNetworkProvinceMapItem[] {
  const byProvince = new Map<string, typeof THREE_NETWORK_TARGETS[number][]>()
  for (const target of THREE_NETWORK_TARGETS) {
    const targets = byProvince.get(target.provinceCode) ?? []
    targets.push(target)
    byProvince.set(target.provinceCode, targets)
  }

  const testedRegions = [...byProvince.entries()].map(([code, targets]) => {
    const targetByCarrier = new Map(targets.map(target => [target.carrierCode, target]))
    const carriers = CARRIER_ORDER.map(([carrierCode, name]) => {
      const target = targetByCarrier.get(carrierCode)
      const index = target ? THREE_NETWORK_TARGETS.indexOf(target) : -1
      return { name, value: index >= 0 ? snapshot?.values[index] ?? null : null } as ThreeNetworkProvinceCarrier
    })
    const validValues = carriers.flatMap(carrier => carrier.value === null ? [] : [carrier.value])
    const average = validValues.length > 0
      ? Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length)
      : null
    const mapName = MAP_NAMES[code]
    if (!mapName)
      throw new Error(`Missing map name for province ${code}`)
    return Object.freeze({
      code,
      mapName,
      displayName: mapName,
      average,
      carriers: Object.freeze(carriers),
      band: latencyBand(average),
      isTested: true,
    })
  })

  const untestedRegions = UNTESTED_REGIONS.map(region => Object.freeze({
    ...region,
    displayName: region.mapName,
    average: null,
    carriers: Object.freeze(emptyCarriers()),
    band: 'empty' as const,
    isTested: false,
  }))

  return Object.freeze([...testedRegions, ...untestedRegions])
}
