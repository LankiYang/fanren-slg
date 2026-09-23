import { TROOPS, TROOP_MAP } from '../game/data'
import type { TroopKey } from '../game/types'
import { useGame } from '../game/store'
import { sprite, fmt } from './util'

/**
 * 出战编队。
 *
 * 核心约束是「统兵上限」：能带的兵远少于拥有的兵。
 * 正因为名额有限，把被克制的兵种换成克制敌方的兵种才有收益 ——
 * 没有这个上限的话全军压上永远最优，编队就是个摆设。
 */
export function Formation({ enemyTroop }: { enemyTroop: TroopKey }) {
  const s = useGame()
  const setFormation = useGame(x => x.setFormation)
  const cap = s.derived.marchCap
  const used = s.derived.formationUsed
  const left = cap - used

  const apply = (k: TroopKey, v: number) => {
    // 不能超过拥有量，也不能超过剩余名额
    const others = used - Math.min(s.formation[k] ?? 0, s.troops[k])
    const max = Math.min(s.troops[k], cap - others)
    setFormation({ ...s.formation, [k]: Math.max(0, Math.min(v, max)) })
  }

  return (
    <div>
      <div className="section-title">
        出战编队 · 敌方 {TROOP_MAP[enemyTroop].name}
        <button
          className="btn-sub"
          style={{ float: 'right', padding: '2px 8px', fontSize: 10 }}
          onClick={() => setFormation(s.derived.recommendedFormationByEnemy[enemyTroop] ?? { kuilei: 0, yushou: 0, fuxiu: 0 })}
        >
          一键择优
        </button>
      </div>

      <div className="card" style={{ padding: '7px 9px' }}>
        <div className="card-body">
          <div className="card-meta">
            统兵 <span style={{ color: left === 0 ? 'var(--gold)' : 'var(--text)' }}>
              {fmt(used)}/{fmt(cap)}
            </span>
            {left > 0 && <span style={{ color: 'var(--text-dim)' }}> · 余 {fmt(left)} 名额</span>}
            <br />
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
              名额有限，优先带克制敌方的兵种
            </span>
          </div>
          <div className="progress">
            <i style={{ width: `${Math.min(100, (used / Math.max(1, cap)) * 100)}%` }} />
          </div>
        </div>
      </div>

      {TROOPS.map(t => {
        const send = s.formation[t.key] ?? 0
        const have = s.troops[t.key]
        const counters = TROOP_MAP[t.key].counters === enemyTroop
        const countered = TROOP_MAP[enemyTroop].counters === t.key
        const detail = s.derived.troopDetails[t.key]
        const eff = detail?.powerByEnemy[enemyTroop] ?? 0
        const sliderMax = Math.min(have, send + Math.max(0, left))

        return (
          <div className="card" key={t.key}>
            <img className="thumb" src={sprite(t.sprite)} alt={t.name} />
            <div className="card-body">
              <div className="card-name">
                {t.name}
                {counters && <span className="tag-counter good">克制</span>}
                {countered && <span className="tag-counter bad">被克</span>}
              </div>
              <div className="card-meta">
                出战 {fmt(send)} / 拥有 {fmt(have)} · 单位战力{' '}
                <span style={{ color: counters ? 'var(--ok)' : countered ? 'var(--danger)' : 'var(--text-dim)' }}>
                  {eff.toFixed(1)}
                </span>
              </div>
              <input
                className="slider"
                type="range"
                min={0}
                max={Math.max(1, sliderMax)}
                value={send}
                onChange={e => apply(t.key, Number(e.target.value))}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
