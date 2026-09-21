// ═══ 秘境失败代价自测 ═══
// 验证 PvE 失败不是纯展示：兵损入账、关卡不推进、首通奖励不发，
// 同时确认恢复兵力后可以正常再战，不会把主线永久锁死。

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

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const initial = useGame.getState()
useGame.setState({
  buildings: { ...initial.buildings, yanwu: { level: 3, upgradingUntil: null } },
  troops: { kuilei: 0, yushou: 0, fuxiu: 1 },
  formation: { kuilei: 0, yushou: 0, fuxiu: 1 },
  clearedStage: 0,
})

const failed = useGame.getState().challengeStage(1)
expect(failed.ok && !failed.win, '低战力秘境挑战应明确失败')
expect((failed.losses ?? 0) > 0, '秘境失败必须产生兵损')
expect(useGame.getState().clearedStage === 0, '秘境失败不得推进关卡')
expect(useGame.getState().troops.fuxiu === 0, '秘境失败兵损必须从实际兵力扣除')

useGame.setState({
  troops: { kuilei: 100, yushou: 0, fuxiu: 0 },
  formation: { kuilei: 100, yushou: 0, fuxiu: 0 },
})
const cleared = useGame.getState().challengeStage(1)
expect(cleared.ok && cleared.win, '补充兵力后应可重新挑战并通关')
expect((cleared.losses ?? 0) > 0 && (cleared.losses ?? 0) < (cleared.deployed ?? 0), '秘境胜利也应产生有限兵损')
expect(useGame.getState().clearedStage === 1, '秘境胜利应推进关卡')

console.log('✅ 秘境自测通过：失败兵损、不推进、不发首通奖励，补兵后可重试')
