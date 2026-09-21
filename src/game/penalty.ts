// ═══ 统一战斗代价 ═══
//
// 秘境、远征和战区都遵循同一条 SLG 基线：
// 胜利支付有限兵损，失败支付更高兵损；失败不应凭空产生进度或奖励。
// 具体玩法只调整基础损耗和策略倍率，避免三个系统各自长出一套数值。

export interface BattleLossInput {
  deployed: number
  myPower: number
  enemyPower: number
  win: boolean
  lossFactor?: number
  winBase?: number
  winMin?: number
  winMax?: number
  failBase?: number
  failMin?: number
  failMax?: number
}

export function calculateBattleLosses({
  deployed,
  myPower,
  enemyPower,
  win,
  lossFactor = 1,
  winBase = 0.08,
  winMin = 0.03,
  winMax = 0.24,
  failBase = 0.22,
  failMin = 0.14,
  failMax = 0.5,
}: BattleLossInput): number {
  if (deployed <= 0) return 0
  const ratio = enemyPower / Math.max(1, myPower)
  const rate = win
    ? Math.min(winMax, Math.max(winMin, winBase * ratio * lossFactor))
    : Math.min(failMax, Math.max(failMin, failBase * Math.min(1.8, ratio) * lossFactor))
  return Math.min(deployed, Math.max(1, Math.round(deployed * rate)))
}
