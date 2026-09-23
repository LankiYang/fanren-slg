import { attack, authenticate, createGuest, createSnapshot } from '../server/domain'
import { createInitialState } from '../server/repository'

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const state = createInitialState()
const player = createGuest(state, '战区自测')
player.troops = { kuilei: 100, yushou: 0, fuxiu: 0 }
player.battleProfile = { ...player.battleProfile, yanwuLevel: 3 }
authenticate(state, player.token)

const before = createSnapshot(state, player)
const report = attack(state, player, {
  requestId: 'warfront-attack-1',
  nodeKey: 'mist-gate',
  tactic: 'raid',
  formation: { kuilei: 100, yushou: 0, fuxiu: 0 },
})
expect(report.win, '克制御兽军的傀儡编队应夺取迷雾关')
expect(report.losses > 0 && report.losses < 100, '胜利也必须产生有限兵损')
expect(state.nodes['mist-gate'].ownerPlayerId === player.id, '胜利后据点应转为我方占领')
expect(Object.values(report.gained).some(value => (value ?? 0) > 0), '首次夺取必须发放资源奖励')

const duplicate = attack(state, player, {
  requestId: 'warfront-attack-1',
  nodeKey: 'mist-gate',
  tactic: 'raid',
  formation: { kuilei: 100, yushou: 0, fuxiu: 0 },
})
expect(duplicate.id === report.id, '重复 requestId 必须返回同一份战报')

const after = createSnapshot(state, player)
expect(after.player.score === before.player.score + report.scoreGained, '战功应按战报结算且不重复')

console.log('✅ 服务端战区自测通过：出征、克制、兵损、占领、奖励、幂等均符合预期')
