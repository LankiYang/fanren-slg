import type { ExpeditionReport } from '../game/types'
import { PracticeBattleScene } from './PracticeBattleScene'

/** 远征只负责把领域战报映射成通用战斗演出，不在 UI 重新计算胜负。 */
export function ExpeditionBattleScene({ report, onComplete }: {
  report: ExpeditionReport
  onComplete: () => void
}) {
  return (
    <PracticeBattleScene
      report={{
        kindLabel: report.kind === 'boss' ? '天机首领战' : '路线遭遇战',
        title: report.title,
        enemyName: report.title,
        enemyTroop: report.enemyTroop,
        myPower: report.myPower,
        enemyPower: report.enemyPower,
        formation: report.formation,
        deployed: report.deployed,
        losses: report.losses,
        win: report.win,
      }}
      onComplete={onComplete}
    />
  )
}
