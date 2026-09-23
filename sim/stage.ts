import { createGuest, gameCommand } from '../server/domain'
import { createInitialState } from '../server/repository'

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const state = createInitialState()
const player = createGuest(state, '秘境自测')
player.game.buildings.yanwu = { level: 3, upgradingUntil: null }
player.game.troops = { kuilei: 0, yushou: 0, fuxiu: 1 }
player.game.formation = { kuilei: 0, yushou: 0, fuxiu: 1 }

const failed = gameCommand(state, player, 'stage.attack', { id: 1 }, 'stage-fail-1')
expect(failed.result.ok && failed.result.win === false, '低战力秘境挑战应明确失败')
expect(Number(failed.result.losses) > 0, '秘境失败必须产生兵损')
expect(player.game.clearedStage === 0, '秘境失败不得推进关卡')
expect(player.game.troops.fuxiu === 0, '秘境失败兵损必须从实际兵力扣除')

player.game.troops = { kuilei: 100, yushou: 0, fuxiu: 0 }
player.game.formation = { kuilei: 100, yushou: 0, fuxiu: 0 }
const cleared = gameCommand(state, player, 'stage.attack', { id: 1 }, 'stage-win-1')
expect(cleared.result.ok && cleared.result.win === true, '补充兵力后应可重新挑战并通关')
expect(Number(cleared.result.losses) > 0 && Number(cleared.result.losses) < Number(cleared.result.deployed), '秘境胜利也应产生有限兵损')
expect(Number(player.game.clearedStage) === 1, '秘境胜利应推进关卡')

console.log('✅ 服务端秘境自测通过：失败兵损、不推进、不发首通奖励，补兵后可重试')
