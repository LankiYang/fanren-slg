import { useState } from 'react'
import { TroopList, CultivatorList } from './ArmyPanel'
import { StagePanel } from './StagePanel'
import { ExpeditionPanel } from './ExpeditionPanel'

type PracticeTab = 'army' | 'stage' | 'expedition' | 'cultivator'

const TABS: [PracticeTab, string][] = [
  ['army', '演武'],
  ['stage', '秘境'],
  ['expedition', '远征'],
  ['cultivator', '修士'],
]

/** 历练：演武/秘境/远征/修士的合并入口，四个系统心智上都是"备战出征"，收进一个 tab 内部切换，避免底部导航被塞满 */
export function PracticePanel({ now }: { now: number }) {
  const [sub, setSub] = useState<PracticeTab>('army')

  return (
    <div className="practice-panel">
      <div className="practice-tabs" role="tablist" aria-label="历练分类">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={sub === key}
            className={'practice-tab' + (sub === key ? ' on' : '')}
            onClick={() => setSub(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'army' && <TroopList />}
      {sub === 'stage' && <StagePanel />}
      {sub === 'expedition' && <ExpeditionPanel now={now} />}
      {sub === 'cultivator' && <CultivatorList />}
    </div>
  )
}
