import { BUILDINGS, dongfuSprite } from '../game/data'
import type { BuildingKey } from '../game/types'
import { useGame } from '../game/store'
import { sprite, fmtTime } from './util'
import { SceneAmbientCanvas } from './SceneAmbientCanvas'

export function Scene({ now, onPick }: { now: number; onPick: (k: BuildingKey) => void }) {
  const s = useGame()
  const dongfuLv = s.buildings.dongfu.level
  const activeKeys = BUILDINGS.filter(def => s.buildings[def.key].level > 0).map(def => def.key)

  return (
    <div className="scene">
      <img className="scene-bg" src={sprite('bg/main-valley.svg')} alt="" />
      <div className="scene-shade" />

      {/* 按地面线从远到近排序：近处建筑后渲染，自然遮挡远处（画家算法） */}
      {[...BUILDINGS].sort((a, b) => a.pos.y - b.pos.y).map(def => {
        const b = s.buildings[def.key]
        const locked = b.level === 0 && dongfuLv < def.unlockAt
        const busy = b.upgradingUntil !== null && now < b.upgradingUntil
        const done = b.upgradingUntil !== null && now >= b.upgradingUntil

        return (
          <button
            key={def.key}
            className={[
              'bld',
              `bld-${def.key}`,
              locked ? 'bld-locked' : '',
              b.level > 0 && !locked ? 'bld-active' : '',
              busy ? 'bld-upgrading' : '',
            ].filter(Boolean).join(' ')}
            data-tut={def.key}
            style={{ left: `${def.pos.x}%`, top: `${def.pos.y}%`, width: `${def.scale}%`, zIndex: Math.round(def.pos.y * 10) }}
            onClick={() => onPick(def.key)}
            aria-label={`${def.name}${locked ? `，需洞府 ${def.unlockAt} 级` : b.level === 0 ? '，可兴建' : `，${b.level}级`}`}
          >
            {b.level > 0 && !locked && <BuildingEffects bkey={def.key} busy={busy} />}
            {/* 洞府外观随等级分三档，其余建筑用固定图 */}
            <img
              src={sprite(def.key === 'dongfu' ? dongfuSprite(b.level) : def.sprite)}
              alt={def.name}
            />
            <span className={'bld-tag' + (busy ? ' busy' : done ? ' ready' : '')}>
              {locked
                ? `${def.name} 🔒${def.unlockAt}`
                : busy
                  ? `${def.name} ⏳${fmtTime(b.upgradingUntil! - now)}`
                  : done
                    ? `${def.name} ✓`
                    : b.level === 0
                      ? `${def.name} ·建`
                      : `${def.name} ${b.level}`}
            </span>
          </button>
        )
      })}
      <SceneAmbientCanvas activeKeys={activeKeys} />
    </div>
  )
}

function BuildingEffects({ bkey, busy }: { bkey: BuildingKey; busy: boolean }) {
  return (
    <span className={'bld-fx' + (busy ? ' construction' : '')} aria-hidden="true">
      <i className="fx-halo" />
      <i className="fx-ring fx-ring-a" />
      <i className="fx-ring fx-ring-b" />
      <i className="fx-particle fx-particle-a" />
      <i className="fx-particle fx-particle-b" />
      <i className="fx-particle fx-particle-c" />
      <i className="fx-particle fx-particle-d" />
      <i className="fx-trace" />
      <i className="fx-trace fx-trace-b" />
      <i className="fx-spark" />
      <i className="fx-spark fx-spark-b" />
      <span className={'fx-mark fx-mark-' + bkey} />
    </span>
  )
}
