import { useEffect, useState } from 'react'
import { TROOPS, TROOP_MAP, CULTIVATORS, cultivatorCost, cultivatorBonus, CULTIVATOR_MAX_LEVEL } from '../game/data'
import type { Resources } from '../game/types'
import {
  useGame, troopPower, totalPower, currentTroopCap, totalTroops,
} from '../game/store'
import { Cost } from './Sheet'
import { sprite, fmt } from './util'
import { PracticePurpose } from './PracticeGuide'

/** 演武场：练兵 */
export function TroopList() {
  const s = useGame()
  const trainTroop = useGame(x => x.trainTroop)
  const maxTrainable = useGame(x => x.maxTrainable)
  const maybeStartIntro = useGame(x => x.maybeStartIntro)
  const [hint, setHint] = useState('')
  const [batch, setBatch] = useState<number | 'max'>(10)

  const yanwuLv = s.buildings.yanwu.level
  const cap = currentTroopCap(s)
  const have = totalTroops(s)

  useEffect(() => { if (yanwuLv > 0) maybeStartIntro('yanwu') }, [yanwuLv, maybeStartIntro])

  return (
    <div>
      <PracticePurpose section="army" />
      <div className="section-title">
        总战力 {fmt(totalPower(s))}
        {yanwuLv === 0
          ? <span style={{ color: 'var(--danger)' }}> · 需先兴建演武场</span>
          : <> · 兵力 {fmt(have)}/{fmt(cap)}</>}
      </div>
      {yanwuLv > 0 && (
        <div className="progress" style={{ marginBottom: 10 }}>
          <i style={{ width: `${Math.min(100, (have / Math.max(1, cap)) * 100)}%` }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {([1, 10, 50, 'max'] as const).map(n => (
          <button
            key={String(n)}
            className="btn-sub"
            style={batch === n ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : undefined}
            onClick={() => setBatch(n)}
          >
            {n === 'max' ? '最大' : `×${n}`}
          </button>
        ))}
      </div>

      {TROOPS.map(t => {
        const maxN = maxTrainable(t.key)
        const n = batch === 'max' ? maxN : batch
        const cost = Object.fromEntries(
          Object.entries(t.cost).map(([k, v]) => [k, (v ?? 0) * n]),
        ) as Partial<Resources>
        return (
          <div className="card" key={t.key}>
            <img className="thumb" src={sprite(t.sprite)} alt={t.name} />
            <div className="card-body">
              <div className="card-name">
                {t.name}
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                  {' '}× {fmt(s.troops[t.key])}
                </span>
              </div>
              <div className="card-meta">
                {t.desc}
                <br />
                单位战力 {troopPower(s, t.key).toFixed(1)}
              </div>
              {n > 0 && <Cost cost={cost} have={s.resources} />}
            </div>
            <div className="card-side">
              <button
                className="btn-sub"
                data-tut={t.key === 'kuilei' ? 'train-troop' : undefined}
                disabled={yanwuLv === 0 || n <= 0}
                onClick={() => {
                  const r = trainTroop(t.key, n)
                  setHint(r.ok ? `已训练 ${t.name} ×${n}` : (r.reason ?? ''))
                }}
              >
                {batch === 'max' ? `练 ${maxN}` : '训练'}
              </button>
            </div>
          </div>
        )
      })}
      <div className="hint">{hint}</div>

      <div className="section-title">兵种克制</div>
      <div className="card">
        <div className="card-body">
          <div className="card-meta" style={{ lineHeight: 1.9 }}>
            {TROOPS.map(t => (
              <div key={t.key}>
                {t.name} → 克 {TROOP_MAP[t.counters].name}（战力 ×1.5，被克 ÷1.5）
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 修士养成 */
export function CultivatorList() {
  const s = useGame()
  const levelUp = useGame(x => x.levelUpCultivator)
  const maybeStartIntro = useGame(x => x.maybeStartIntro)
  const [hint, setHint] = useState('')

  useEffect(() => { maybeStartIntro('cultivator') }, [maybeStartIntro])

  return (
    <div>
      <PracticePurpose section="cultivator">
        <div className="practice-purpose-tip">培养建议：先选一套主力兵种，不要把资源平均分散；对应修士的等级会同时影响秘境、远征和战区。</div>
      </PracticePurpose>
      <div className="section-title">修士 · 提升对应兵种战力</div>
      {CULTIVATORS.map(c => {
        const st = s.cultivators[c.key]
        const owned = st?.owned
        const maxed = owned && st.level >= CULTIVATOR_MAX_LEVEL
        const cost = cultivatorCost((st?.level ?? 0) + 1)
        return (
          <div className={'card' + (owned ? '' : ' locked-card')} key={c.key}>
            <img className="thumb" src={sprite(c.sprite)} alt={c.name} />
            <div className="card-body">
              <div className="card-name">
                {c.name}
                <span className={'tag-rarity r' + c.rarity}>
                  {c.rarity === 3 ? '金丹' : c.rarity === 2 ? '筑基' : '炼气'}
                </span>
              </div>
              <div className="card-meta">
                {c.desc}
                <br />
                {owned ? (
                  <>
                    {st.level}/{CULTIVATOR_MAX_LEVEL} 级 · 专精 {TROOP_MAP[c.spec].name} · 生效于秘境/远征/战区
                    {' +'}{(cultivatorBonus(c, st.level) * 100).toFixed(0)}%
                  </>
                ) : `尚未招募 · 通关对应秘境首领关可得 · 解锁后提升 ${TROOP_MAP[c.spec].name} 战力`}
              </div>
              {owned && !maxed && <Cost cost={cost} have={s.resources} />}
            </div>
            <div className="card-side">
              {owned && (
                <button
                  className="btn-sub"
                  data-tut={c.key === 'hanli' ? 'cultivator-level' : undefined}
                  disabled={maxed}
                  onClick={() => {
                    const r = levelUp(c.key)
                    setHint(r.ok ? `${c.name} 提升至 ${st.level + 1} 级` : (r.reason ?? ''))
                  }}
                >
                  {maxed ? '已满级' : '提升'}
                </button>
              )}
            </div>
          </div>
        )
      })}
      <div className="hint">{hint}</div>
    </div>
  )
}
