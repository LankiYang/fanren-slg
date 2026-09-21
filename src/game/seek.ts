import type {
  EquipmentItem, EquipmentRarity, EquipmentSlot, Gender, Resources, SeekDrop, SeekState,
} from './types'

export const SEEK_MAX_ENERGY = 24
export const SEEK_REGEN_MS = 90_000
export const SEEK_COMBO_WINDOW_MS = 7_000

const RARITY_MULTIPLIER: Record<EquipmentRarity, number> = {
  common: 1,
  rare: 1.45,
  epic: 2.2,
  legendary: 3.6,
}

export const RARITY_META: Record<EquipmentRarity, { name: string; color: string }> = {
  common: { name: '凡品', color: '#a8b2bd' },
  rare: { name: '良品', color: '#63c7d3' },
  epic: { name: '上品', color: '#ba8cff' },
  legendary: { name: '天成', color: '#f1bd62' },
}

export const EQUIPMENT_SLOT_META: Record<EquipmentSlot, { name: string; icon: string }> = {
  weapon: { name: '灵兵', icon: 'item/artifact-sword.webp' },
  armor: { name: '法衣', icon: 'item/artifact-shield.webp' },
  accessory: { name: '灵佩', icon: 'item/artifact-rope.webp' },
}

export const SEEK_MILESTONES = [
  { id: 'seek-10', need: 10, name: '初窥门径', desc: '完成 10 次寻道', reward: { lingshi: 600, lingqi: 240 }, dust: 8 },
  { id: 'seek-50', need: 50, name: '灵台渐明', desc: '完成 50 次寻道', reward: { lingshi: 1800, lingyao: 720 }, dust: 18 },
  { id: 'seek-150', need: 150, name: '道心初定', desc: '完成 150 次寻道', reward: { lingshi: 4200, lingqi: 1800, kuanglingcai: 1200 }, dust: 35 },
  { id: 'seek-300', need: 300, name: '洞察天机', desc: '完成 300 次寻道', reward: { lingshi: 9000, lingyao: 3600 }, dust: 60 },
  { id: 'seek-600', need: 600, name: '问道有成', desc: '完成 600 次寻道', reward: { lingshi: 18000, lingqi: 7200, kuanglingcai: 4800 }, dust: 100 },
] as const

export function characterName(gender: Gender | null): string {
  return gender === 'female' ? '清徽' : '玄墨'
}

export function characterSubtitle(gender: Gender | null): string {
  return gender === 'female' ? '女修 · 静观天机，逆势求生' : '男修 · 谨慎持重，步步为营'
}

export function dateKey(now: number): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function initialSeekState(now: number): SeekState {
  return {
    energy: SEEK_MAX_ENERGY,
    energyUpdatedAt: now,
    cultivation: 0,
    total: 0,
    dailyCount: 0,
    dailyKey: dateKey(now),
    combo: 0,
    bestCombo: 0,
    lastAt: 0,
    pity: 0,
    legendaryPity: 0,
    equipmentInventory: [],
    equipmentLoadout: { weapon: null, armor: null, accessory: null },
    equipmentDust: 0,
    lastDrop: null,
    recentDrops: [],
    claimedMilestones: [],
  }
}

/** 补发机缘并切换每日计数；不产生掉落，也不改变战斗结果。 */
export function refreshSeekState(state: SeekState, now: number): SeekState {
  let next = state
  const day = dateKey(now)
  if (state.dailyKey !== day) {
    next = { ...next, dailyKey: day, dailyCount: 0, combo: 0 }
  }
  if (next.energy >= SEEK_MAX_ENERGY) return next
  const recovered = Math.floor(Math.max(0, now - next.energyUpdatedAt) / SEEK_REGEN_MS)
  if (recovered <= 0) return next
  const energy = Math.min(SEEK_MAX_ENERGY, next.energy + recovered)
  const energyUpdatedAt = energy >= SEEK_MAX_ENERGY
    ? now
    : next.energyUpdatedAt + recovered * SEEK_REGEN_MS
  return { ...next, energy, energyUpdatedAt }
}

/** 每一境界需要的「点击修为」。资源和洞府仍然是突破成本，点击负责把修为条推满。 */
export function cultivationRequirement(realm: number): number {
  return Math.round(220 * Math.pow(1.42, Math.max(0, realm)))
}

export function equipmentPower(loadout: Partial<Record<EquipmentSlot, EquipmentItem | null>> | undefined): number {
  if (!loadout) return 0
  return (Object.values(loadout) as Array<EquipmentItem | null>).reduce((sum, item) => sum + (item?.power ?? 0), 0)
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]
}

function roundResource(value: number): number {
  return Math.max(1, Math.round(value))
}

function createEquipment(
  rarity: EquipmentRarity,
  realm: number,
  id: string,
  random: () => number,
): EquipmentItem {
  const slot = pick<EquipmentSlot>(['weapon', 'armor', 'accessory'], random)
  const names: Record<EquipmentSlot, string[]> = {
    weapon: ['青冥短剑', '玄铁灵刃', '落星针', '破妄剑胚'],
    armor: ['青木法衣', '玄鳞护心甲', '云纹道袍', '太岳玄甲'],
    accessory: ['凝神玉佩', '避尘灵环', '天机古佩', '五色灵璧'],
  }
  const affixes: Record<EquipmentSlot, string[]> = {
    weapon: ['攻击 · 破阵', '攻击 · 连击', '攻击 · 暴击'],
    armor: ['守御 · 坚韧', '守御 · 吸收', '守御 · 反击'],
    accessory: ['悟性 · 参悟', '机缘 · 寻宝', '心神 · 闪避'],
  }
  const base = 28 + realm * 13 + random() * 24
  const power = Math.max(10, Math.round(base * RARITY_MULTIPLIER[rarity]))
  return {
    id,
    slot,
    rarity,
    name: pick(names[slot], random),
    affix: pick(affixes[slot], random),
    power,
  }
}

/**
 * 单次点击掉落解析。随机源可注入，线上使用 Math.random，模拟器使用固定序列。
 * 保底阈值故意写在领域层，UI 与服务端将来可以共享同一份规则。
 */
export function resolveSeekDrop(
  state: SeekState,
  realm: number,
  id: string,
  random: () => number = Math.random,
): SeekDrop {
  const powered = state.energy > 0
  const legendaryGuaranteed = state.legendaryPity >= 39
  const epicGuaranteed = state.pity >= 9
  const rarityRoll = random()
  let rarity: EquipmentRarity = 'common'
  if (legendaryGuaranteed || (powered && rarityRoll < 0.012) || (!powered && rarityRoll < 0.004)) {
    rarity = 'legendary'
  } else if (epicGuaranteed || (powered && rarityRoll < 0.09) || (!powered && rarityRoll < 0.03)) {
    rarity = 'epic'
  } else if (rarityRoll < (powered ? 0.34 : 0.16)) {
    rarity = 'rare'
  }

  const critical = random() < (powered ? 0.10 : 0.06)
  const equipmentChance = rarity === 'legendary'
    ? 1
    : rarity === 'epic'
      ? 0.92
      : powered ? 0.68 : 0.24
  const equipment = random() < equipmentChance
    ? createEquipment(rarity, realm, id, random)
    : null
  const base = 52 + realm * 18
  const rewardMultiplier = critical ? 1.9 : powered ? 1.15 : 0.82
  const reward: Partial<Resources> = {
    lingshi: roundResource(base * (0.9 + random() * 1.2) * rewardMultiplier),
    lingqi: roundResource(base * (0.45 + random() * 0.7) * rewardMultiplier),
    lingyao: roundResource(base * (0.25 + random() * 0.5) * rewardMultiplier),
    kuanglingcai: roundResource(base * (0.28 + random() * 0.55) * rewardMultiplier),
  }
  const cultivation = Math.max(1, Math.round((28 + realm * 12) * (critical ? 2.15 : powered ? 1.12 : 0.82)))
  const kind = equipment ? 'equipment' : critical ? 'fortune' : 'cultivation'
  const title = equipment
    ? `寻得${RARITY_META[rarity].name}${equipment.name}`
    : critical
      ? '天机垂青'
      : powered ? '灵台有感' : '静心参悟'
  const desc = equipment
    ? `${EQUIPMENT_SLOT_META[equipment.slot].name} · ${equipment.affix} · 战力 ${equipment.power}`
    : critical ? '灵光一闪，修为与四方灵材一并涌入识海。' : '每一次参悟都有稳定修为，机缘只会让收获更丰。'

  return {
    id,
    kind,
    rarity,
    title,
    desc,
    cultivation,
    reward,
    equipment,
    equipmentEquipped: false,
    dustGained: 0,
    critical,
    pityTriggered: legendaryGuaranteed || epicGuaranteed,
  }
}
