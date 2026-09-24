import { useEffect, useState } from 'react'
import { TroopList, CultivatorList } from './ArmyPanel'
import { StagePanel } from './StagePanel'
import { ExpeditionPanel } from './ExpeditionPanel'
import { PracticeOverview, type PracticeSection } from './PracticeGuide'

export type PracticeTab = PracticeSection

/** 历练：演武/秘境/远征/修士的合并入口，四个系统心智上都是"备战出征"；用途说明本身就是内部导航，避免同一组入口重复出现。 */
export function PracticePanel({ now, initialTab = 'army' }: { now: number; initialTab?: PracticeTab }) {
  const [sub, setSub] = useState<PracticeTab>(initialTab)

  useEffect(() => { setSub(initialTab) }, [initialTab])

  return (
    <div className="practice-panel">
      <PracticeOverview active={sub} onSelect={setSub} />
      {sub === 'army' && <TroopList />}
      {sub === 'stage' && <StagePanel />}
      {sub === 'expedition' && <ExpeditionPanel now={now} />}
      {sub === 'cultivator' && <CultivatorList />}
    </div>
  )
}
