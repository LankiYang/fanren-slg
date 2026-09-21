import { useEffect, useState } from 'react'
import {
  GONGFA, GONGFA_BRANCHES, GONGFA_MAP, gongfaCost, gongfaTimeMs,
  PILLS, PILL_MAP, pillCost,
  ARTIFACTS, artifactCost, artifactBonus,
  type GongfaBranch, type PillKey,
} from '../game/systems'
import { RESOURCE_META, TROOP_MAP } from '../game/data'
import type { ResourceKey } from '../game/types'
import { useGame } from '../game/store'
import { Cost } from './Sheet'
import { sprite, fmt, fmtTime } from './util'

// ══════════════════════════════════════
// 藏经阁 · 功法研究
// ══════════════════════════════════════
export function GongfaPanel({ now }: { now: number }) {
  const s = useGame()
  const research = useGame(x => x.researchGongfa)
  const maybeStartIntro = useGame(x => x.maybeStartIntro)
  const [hint, setHint] = useState('')
  const [branch, setBranch] = useState<GongfaBranch>('gather')

  const cangjing = s.buildings.cangjing.level
  const busy = s.gongfaResearching

  useEffect(() => { maybeStartIntro('cangjing') }, [maybeStartIntro])

  return (
    <div>
      <div className="section-title">功法参研 · 永久增益</div>

      {busy && (
        <div className="card" style={{ borderColor: 'var(--teal)' }}>
          <img className="thumb" src={sprite('item/scroll.webp')} alt="" />
          <div className="card-body">
            <div className="card-name" style={{ color: 'var(--teal)' }}>
              参研中：{GONGFA_MAP[busy.key]?.name}
            </div>
            <div className="card-meta">剩余 {fmtTime(busy.until - now)}</div>
            <div className="progress"><i style={{ width: '50%' }} /></div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
        {(Object.keys(GONGFA_BRANCHES) as GongfaBranch[]).map(b => (
          <button
            key={b}
            className="btn-sub"
            style={branch === b
              ? { borderColor: GONGFA_BRANCHES[b].color, color: GONGFA_BRANCHES[b].color }
              : undefined}
            onClick={() => setBranch(b)}
          >
            {GONGFA_BRANCHES[b].name}
          </button>
        ))}
      </div>

      {GONGFA.filter(g => g.branch === branch).map(g => {
        const lv = s.gongfa[g.key] ?? 0
        const maxed = lv >= g.maxLevel
        const locked = cangjing < g.requires
        const cost = gongfaCost(lv + 1)
        return (
          <div className={'card' + (locked ? ' locked-card' : '')} key={g.key}>
            <img className="thumb" src={sprite('item/scroll.webp')} alt="" />
            <div className="card-body">
              <div className="card-name">
                {g.name} <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{lv}/{g.maxLevel}</span>
              </div>
              <div className="card-meta">
                {g.desc} <span style={{ color: GONGFA_BRANCHES[branch].color }}>
                  +{(lv * g.perLevel * 100).toFixed(0)}%
                </span>
                {!maxed && <> → +{((lv + 1) * g.perLevel * 100).toFixed(0)}%</>}
                {locked && <><br /><span style={{ color: 'var(--danger)' }}>需藏经阁 {g.requires} 级</span></>}
              </div>
              {!maxed && !locked && (
                <>
                  <Cost cost={cost} have={s.resources} />
                  <div className="card-meta">耗时 {fmtTime(gongfaTimeMs(lv + 1))}</div>
                </>
              )}
            </div>
            <div className="card-side">
              <button
                className="btn-sub"
                disabled={maxed || locked || !!busy}
                onClick={() => {
                  const r = research(g.key)
                  setHint(r.ok ? `开始参研《${g.name}》` : (r.reason ?? ''))
                }}
              >
                {maxed ? '圆满' : '参研'}
              </button>
            </div>
          </div>
        )
      })}
      <div className="hint">{hint}</div>
    </div>
  )
}

// ══════════════════════════════════════
// 炼丹房 · 丹药
// ══════════════════════════════════════
export function PillPanel({ now }: { now: number }) {
  const s = useGame()
  const craft = useGame(x => x.craftPill)
  const collect = useGame(x => x.collectPill)
  const use = useGame(x => x.usePill)
  const maybeStartIntro = useGame(x => x.maybeStartIntro)
  const [hint, setHint] = useState('')

  const liandan = s.buildings.liandan.level
  const crafting = s.pillCrafting
  const cost = pillCost(Math.max(1, liandan))

  useEffect(() => { maybeStartIntro('liandan') }, [maybeStartIntro])

  return (
    <div>
      <div className="section-title">炼丹 · 限时增益</div>

      {crafting && (
        now >= crafting.until ? (
          <div className="card" style={{ borderColor: 'var(--ok)' }}>
            <img className="thumb" src={sprite(PILL_MAP[crafting.key as PillKey].sprite)} alt="" />
            <div className="card-body">
              <div className="card-name" style={{ color: 'var(--ok)' }}>
                {PILL_MAP[crafting.key as PillKey].name} 已出炉
              </div>
            </div>
            <div className="card-side">
              <button className="btn-sub" style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }}
                onClick={() => { collect(); setHint('已收取丹药') }}>
                收取
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ borderColor: 'var(--teal)' }}>
            <img className="thumb" src={sprite(PILL_MAP[crafting.key as PillKey].sprite)} alt="" />
            <div className="card-body">
              <div className="card-name" style={{ color: 'var(--teal)' }}>
                炼制中：{PILL_MAP[crafting.key as PillKey].name}
              </div>
              <div className="card-meta">剩余 {fmtTime(crafting.until - now)}</div>
            </div>
          </div>
        )
      )}

      {PILLS.map(p => {
        const owned = s.pills[p.key] ?? 0
        const activeUntil = s.pillActive[p.key] ?? 0
        const active = now < activeUntil
        return (
          <div className="card" key={p.key}>
            <img className="thumb" src={sprite(p.sprite)} alt={p.name} />
            <div className="card-body">
              <div className="card-name">
                {p.name}
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}> ×{owned}</span>
                {active && (
                  <span style={{ color: 'var(--ok)', fontSize: 11 }}>
                    {' '}· 生效中 {fmtTime(activeUntil - now)}
                  </span>
                )}
              </div>
              <div className="card-meta">
                {p.desc} ×{p.effect.toFixed(1)}，持续 {p.hours} 小时
                <br />
                炼制耗时 {p.craftMinutes} 分钟
              </div>
            </div>
            <div className="card-side" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                className="btn-sub"
                disabled={liandan <= 0 || !!crafting}
                onClick={() => {
                  const r = craft(p.key)
                  setHint(r.ok ? `开始炼制${p.name}` : (r.reason ?? ''))
                }}
              >
                炼制
              </button>
              <button
                className="btn-sub"
                disabled={owned <= 0}
                style={owned > 0 ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : undefined}
                onClick={() => {
                  const r = use(p.key)
                  setHint(r.ok ? `已服下${p.name}` : (r.reason ?? ''))
                }}
              >
                服用
              </button>
            </div>
          </div>
        )
      })}

      <div className="section-title">单次炼制消耗</div>
      <Cost cost={cost} have={s.resources} />
      <div className="hint">{hint}</div>
    </div>
  )
}

// ══════════════════════════════════════
// 炼器阁 · 法宝
// ══════════════════════════════════════
export function ArtifactPanel() {
  const s = useGame()
  const forge = useGame(x => x.forgeArtifact)
  const maybeStartIntro = useGame(x => x.maybeStartIntro)
  const [hint, setHint] = useState('')

  useEffect(() => { maybeStartIntro('lianqi') }, [maybeStartIntro])

  const lianqi = s.buildings.lianqi.level

  return (
    <div>
      <div className="section-title">法宝锻造 · 兵种战力加成</div>

      {ARTIFACTS.map(a => {
        const lv = s.artifacts[a.key] ?? 0
        const maxed = lv >= a.maxLevel
        const locked = lianqi < a.requires
        const cost = artifactCost(lv + 1)
        return (
          <div className={'card' + (locked ? ' locked-card' : '')} key={a.key}>
            <img className="thumb" src={sprite(a.sprite)} alt={a.name} />
            <div className="card-body">
              <div className="card-name">
                {a.name}
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                  {' '}{lv > 0 ? `${lv}/${a.maxLevel} 阶` : '未锻造'}
                </span>
              </div>
              <div className="card-meta">
                {a.desc} <span style={{ color: 'var(--gold)' }}>+{(lv * a.perLevel * 100).toFixed(0)}%</span>
                {!maxed && <> → +{((lv + 1) * a.perLevel * 100).toFixed(0)}%</>}
                {locked && <><br /><span style={{ color: 'var(--danger)' }}>需炼器阁 {a.requires} 级</span></>}
              </div>
              {!maxed && !locked && <Cost cost={cost} have={s.resources} />}
            </div>
            <div className="card-side">
              <button
                className="btn-sub"
                disabled={maxed || locked}
                onClick={() => {
                  const r = forge(a.key)
                  setHint(r.ok ? `${a.name} 已提升至 ${lv + 1} 阶` : (r.reason ?? ''))
                }}
              >
                {maxed ? '圆满' : lv > 0 ? '升阶' : '锻造'}
              </button>
            </div>
          </div>
        )
      })}

      <div className="section-title">当前加成</div>
      <div className="card">
        <div className="card-body">
          <div className="card-meta" style={{ lineHeight: 1.9 }}>
            {(['kuilei', 'yushou', 'fuxiu'] as const).map(t => (
              <div key={t}>
                {TROOP_MAP[t].name} +{(artifactBonus(s, t) * 100).toFixed(0)}%
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hint">{hint}</div>
    </div>
  )
}

/** 顶部资源速览，功能面板里复用 */
export function ResourceStrip() {
  const s = useGame()
  return (
    <div className="cost-row">
      {(Object.keys(RESOURCE_META) as ResourceKey[]).map(k => (
        <span className="cost" key={k}>
          <img src={sprite(RESOURCE_META[k].icon)} alt="" />
          {fmt(s.resources[k])}
        </span>
      ))}
    </div>
  )
}
