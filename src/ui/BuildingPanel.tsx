import { useState } from 'react'
import { BUILDING_MAP, buildingCost, buildingOutput, buildingTime } from '../game/data'
import type { BuildingKey } from '../game/types'
import {
  useGame, realmOutputBonus, busyQueues, dongfuPrereqStatus, currentCap,
  buildCostFactor, buildSpeedFactor,
} from '../game/store'
import { scaleCost } from '../game/compute'
import { troopCap, TUNE } from '../game/balance'
import { Sheet, Cost } from './Sheet'
import { GongfaPanel, PillPanel, ArtifactPanel } from './FunctionPanels'
import { fmtTime, fmt } from './util'

/** 有专属功能面板的建筑：点进来先看功能，升级收在第二个页签 */
const FUNCTION_BUILDINGS: Partial<Record<BuildingKey, string>> = {
  cangjing: '参研',
  liandan: '炼丹',
  lianqi: '锻造',
}

export function BuildingPanel({ bkey, now, onClose }: { bkey: BuildingKey; now: number; onClose: () => void }) {
  const s = useGame()
  const startUpgrade = useGame(x => x.startUpgrade)
  const finishUpgrade = useGame(x => x.finishUpgrade)
  const [hint, setHint] = useState('')
  const hasFunction = !!FUNCTION_BUILDINGS[bkey] && s.buildings[bkey].level > 0
  const [view, setView] = useState<'fn' | 'up'>('fn')

  const def = BUILDING_MAP[bkey]
  const b = s.buildings[bkey]
  const target = b.level + 1
  // 显示的必须是实际要付/要等的数（含功法减免与丹药加速），
  // 否则面板上写的和真正扣的对不上
  const cost = scaleCost(buildingCost(bkey, target), buildCostFactor(s))
  const duration = buildingTime(bkey, target) * buildSpeedFactor(s, now)
  const discounted = buildCostFactor(s) < 1 || buildSpeedFactor(s, now) < 1
  const busy = b.upgradingUntil !== null && now < b.upgradingUntil
  const done = b.upgradingUntil !== null && now >= b.upgradingUntil
  const locked = b.level === 0 && s.buildings.dongfu.level < def.unlockAt
  const atMax = bkey === 'dongfu' && b.level >= TUNE.dongfuMax
  const cappedByDongfu = bkey !== 'dongfu' && b.level >= s.buildings.dongfu.level
  const prereq = bkey === 'dongfu' ? dongfuPrereqStatus(s) : null
  const queueFull = busyQueues(s, now) >= s.queueSlots

  const bonus = realmOutputBonus(s.realm)

  return (
    <Sheet
      title={def.name}
      sub={b.level === 0 ? '未建造' : `${b.level} 级`}
      onClose={onClose}
    >
      {hasFunction && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            className="btn-sub"
            style={view === 'fn' ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : undefined}
            onClick={() => setView('fn')}
          >
            {FUNCTION_BUILDINGS[bkey]}
          </button>
          <button
            className="btn-sub"
            style={view === 'up' ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : undefined}
            onClick={() => setView('up')}
          >
            升级
          </button>
        </div>
      )}

      {hasFunction && view === 'fn' ? (
        <>
          {bkey === 'cangjing' && <GongfaPanel now={now} />}
          {bkey === 'liandan' && <PillPanel now={now} />}
          {bkey === 'lianqi' && <ArtifactPanel />}
        </>
      ) : (
      <>
      <div className="sheet-desc">{def.desc}</div>

      {/* 该建筑升级带来的具体收益，让玩家知道为什么要点这一下 */}
      {def.produces && (
        <div className="card">
          <div className="card-body">
            <div className="card-name">产出</div>
            <div className="card-meta">
              当前 {(buildingOutput(b.level) * bonus).toFixed(2)}/s
              {' → '}
              <span style={{ color: 'var(--teal)' }}>
                {(buildingOutput(target) * bonus).toFixed(2)}/s
              </span>
            </div>
          </div>
        </div>
      )}
      {bkey === 'dongfu' && (
        <div className="card">
          <div className="card-body">
            <div className="card-name">仓库上限</div>
            <div className="card-meta">
              当前 {fmt(currentCap(s))}
              {!atMax && <> → <span style={{ color: 'var(--teal)' }}>{fmt(currentCap({ ...s, buildings: { ...s.buildings, dongfu: { ...b, level: target } } }))}</span></>}
              <br />
              同时解除其余建筑的等级封顶
            </div>
          </div>
        </div>
      )}
      {bkey === 'yanwu' && (
        <div className="card">
          <div className="card-body">
            <div className="card-name">兵力上限</div>
            <div className="card-meta">
              当前 {fmt(troopCap(b.level))}
              {' → '}
              <span style={{ color: 'var(--teal)' }}>{fmt(troopCap(target))}</span>
            </div>
          </div>
        </div>
      )}

      {done ? (
        <button className="btn-main" onClick={() => { finishUpgrade(bkey); onClose() }}>
          完成升级
        </button>
      ) : busy ? (
        <button className="btn-main" disabled>
          升级中 · 剩余 {fmtTime(b.upgradingUntil! - now)}
        </button>
      ) : atMax ? (
        <button className="btn-main" disabled>已达当前版本上限</button>
      ) : (
        <>
          <div className="section-title">
            升级至 {target} 级 · 耗时 {fmtTime(duration)}
            {discounted && <span style={{ color: 'var(--teal)' }}> （已含功法/丹药加成）</span>}
          </div>
          <Cost cost={cost} have={s.resources} />

          {/* 阻塞原因逐条显式告知，而不是让按钮默默变灰 */}
          {prereq && !prereq.ok && (
            <div className="blocker">
              需 {prereq.need} 座产出建筑达到 {prereq.level} 级 · 当前 {prereq.have} 座
            </div>
          )}
          {cappedByDongfu && (
            <div className="blocker">已达洞府等级上限（{s.buildings.dongfu.level}），请先升级洞府</div>
          )}
          {queueFull && (
            <div className="blocker">建造队列已满（{s.queueSlots} 条）</div>
          )}

          <button
            className="btn-main"
            data-tut="upgrade-btn"
            disabled={locked || cappedByDongfu || (prereq ? !prereq.ok : false) || queueFull}
            onClick={() => {
              const r = startUpgrade(bkey)
              if (!r.ok) setHint(r.reason ?? '无法升级')
              else onClose()
            }}
          >
            {locked ? `需洞府 ${def.unlockAt} 级` : b.level === 0 ? '兴建' : '升级'}
          </button>
          <div className="hint">{hint}</div>
        </>
      )}
      </>
      )}
    </Sheet>
  )
}
