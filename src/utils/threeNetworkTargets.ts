const PROVINCES = Object.freeze([
  ['he', '河北'],
  ['sx', '山西'],
  ['ln', '辽宁'],
  ['jl', '吉林'],
  ['hl', '黑龙江'],
  ['js', '江苏'],
  ['zj', '浙江'],
  ['ah', '安徽'],
  ['fj', '福建'],
  ['jx', '江西'],
  ['sd', '山东'],
  ['ha', '河南'],
  ['hb', '湖北'],
  ['hn', '湖南'],
  ['gd', '广东'],
  ['hi', '海南'],
  ['sc', '四川'],
  ['gz', '贵州'],
  ['yn', '云南'],
  ['sn', '陕西'],
  ['gs', '甘肃'],
  ['qh', '青海'],
  ['nm', '内蒙古'],
  ['gx', '广西'],
  ['xz', '西藏'],
  ['nx', '宁夏'],
  ['xj', '新疆'],
  ['bj', '北京'],
  ['tj', '天津'],
  ['sh', '上海'],
  ['cq', '重庆'],
] as const)

const CARRIERS = Object.freeze([
  ['cu', '联通'],
  ['cm', '移动'],
  ['ct', '电信'],
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

export const THREE_NETWORK_TARGETS: readonly ThreeNetworkTarget[] = Object.freeze(PROVINCES.flatMap(([provinceCode, provinceName]) =>
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
