// ═══ 战区垂直切片自测 ═══
//
// 不依赖浏览器 UI，验证本地命令结算的核心契约：出征 → 兵损 → 占领 → 收益 → 冷却。
// 正式联机化时，此文件应改为同一份 API 契约测试。

export {}

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
})

const { useGame } = await import('../src/game/store')
const { computeRates } = await import('../src/game/compute')

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const before = useGame.getState()
useGame.setState({
  buildings: { ...before.buildings, yanwu: { level: 3, upgradingUntil: null } },
  troops: { kuilei: 100, yushou: 0, fuxiu: 0 },
  formation: { kuilei: 100, yushou: 0, fuxiu: 0 },
  warfrontCooldownUntil: 0,
})

const rateBefore = computeRates(useGame.getState())
const result = useGame.getState().attackWarfront('mist-gate')
expect(result.ok && result.report, '迷雾关应可成功出征并返回战报')
expect(result.report.win, '克制御兽军的傀儡编队应夺取迷雾关')
expect(result.report.losses > 0 && result.report.losses < 100, '胜利也必须产生有限兵损')

const after = useGame.getState()
expect(after.warfrontNodes['mist-gate'].owner === 'player', '胜利后据点应转为我方占领')
expect(after.troops.kuilei === 100 - result.report.losses, '兵损必须从实际部队中扣除')
expect(after.formation.kuilei === after.troops.kuilei, '兵损后编队不得超过现存部队')
expect(after.warfrontScore === result.report.scoreGained, '战功应按战报结算')
expect(after.warfrontCooldownUntil > Date.now(), '出征后必须进入整备冷却')
expect(computeRates(after).lingshi > rateBefore.lingshi, '占领关隘后灵石每秒产出应提升')
expect(Object.values(result.report.gained).some(value => (value ?? 0) > 0), '首次夺取必须发放资源奖励')

const retry = useGame.getState().attackWarfront('moonwell')
expect(!retry.ok && retry.reason?.includes('整备'), '冷却期间不得重复出征')

useGame.setState({ resources: { lingshi: 0, lingqi: 0, lingyao: 0, kuanglingcai: 0 } })
useGame.getState().claimOnlineWarfrontReward('report-dedup', { lingshi: 100 })
useGame.getState().claimOnlineWarfrontReward('report-dedup', { lingshi: 100 })
expect(useGame.getState().resources.lingshi === 100, '同一服务端战报奖励只能入账一次')

console.log('✅ 战区自测通过：出征、克制、兵损、占领、收益、冷却均符合预期')
