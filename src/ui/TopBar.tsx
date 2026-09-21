import { useEffect, useRef } from 'react'
import { RESOURCE_META, REALMS } from '../game/data'
import type { ResourceKey } from '../game/types'
import { useGame, computeRates, currentCap } from '../game/store'
import { characterName, cultivationRequirement } from '../game/seek'
import { sprite, fmt, useCountUp } from './util'

export function TopBar({ onBreakthrough }: { onBreakthrough: () => void }) {
  const s = useGame()
  const floats = useGame(x => x.floats)
  const popFloat = useGame(x => x.popFloat)
  const rates = computeRates(s)
  const cap = currentCap(s)
  const realm = REALMS[Math.min(s.realm, REALMS.length - 1)]
  const next = REALMS[s.realm + 1]
  const insightNeed = cultivationRequirement(s.realm)

  const gateOk = !!next && s.buildings.dongfu.level >= next.requiresDongfu
  const canBreak = !!next && gateOk
    && s.seek.cultivation >= insightNeed
    && (Object.keys(next.cost) as ResourceKey[]).every(k => s.resources[k] >= (next.cost[k] ?? 0))

  return (
    <>
      <div className="topbar">
        {(Object.keys(RESOURCE_META) as ResourceKey[]).map(k => (
          <ResourceCell
            key={k}
            rkey={k}
            value={s.resources[k]}
            rate={rates[k]}
            cap={cap}
            floats={floats.filter(f => f.key === k)}
            onFloatDone={popFloat}
          />
        ))}
      </div>

      <div className="realmbar">
        <div className="character-chip" title="修士身份只影响叙事与外观">
          <span className={'character-glyph ' + (s.character.gender === 'female' ? 'female' : 'male')}>{s.character.gender === 'female' ? '♀' : '♂'}</span>
          <span>{characterName(s.character.gender)}</span>
        </div>
        <div>
          <div className="realm-name">{realm.name}</div>
          <div className="realm-sub">
            产出 ×{realm.outputBonus.toFixed(2)} · 战力 ×{realm.powerBonus.toFixed(2)}
            {' · 修为 '}{fmt(s.seek.cultivation)}/{fmt(insightNeed)}
          </div>
        </div>
        <button
          className={'btn-breakthrough' + (canBreak ? ' pulse' : '')}
          disabled={!next}
          onClick={onBreakthrough}
        >
          {!next ? '已至顶' : canBreak ? '可突破' : '突破'}
        </button>
      </div>
    </>
  )
}

function ResourceCell({ rkey, value, rate, cap, floats, onFloatDone }: {
  rkey: ResourceKey
  value: number
  rate: number
  cap: number
  floats: { id: number; amount: number }[]
  onFloatDone: (id: number) => void
}) {
  const shown = useCountUp(value)
  const full = value >= cap - 1

  // 兜底清理：onAnimationEnd 要动画真的播完才触发，标签页切到后台时
  // CSS 动画会被浏览器挂起、这个事件可能永远不来，飘字队列会一直堆积
  // （这个环境本身就常驻 document.hidden，实测复现过：4 条飘字放了 1.3s 一条没清）。
  // 用定时器做兜底，到时间强制清掉，不依赖动画有没有真的播放。
  const scheduledRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    for (const f of floats) {
      if (scheduledRef.current.has(f.id)) continue
      scheduledRef.current.add(f.id)
      window.setTimeout(() => {
        scheduledRef.current.delete(f.id)
        onFloatDone(f.id)
      }, 1800)
    }
  }, [floats, onFloatDone])

  return (
    <div className={'res' + (full ? ' res-full' : rate > 0 ? ' res-producing' : '')}>
      <span className="res-live" aria-hidden="true" />
      <img src={sprite(RESOURCE_META[rkey].icon)} alt={RESOURCE_META[rkey].name} />
      <div style={{ minWidth: 0 }}>
        <div className="res-val">{fmt(shown)}</div>
        {/* 满仓时把「+x/s」换成警告：产出已经在浪费了，这是催上线的核心提示 */}
        {full
          ? <div className="res-rate warn">已满仓</div>
          : rate > 0 && <div className="res-rate">+{rate.toFixed(1)}/s</div>}
      </div>
      {floats.map((f, i) => (
        <span
          key={f.id}
          className="res-float"
          style={{ animationDelay: `${i * 90}ms` }}
          onAnimationEnd={() => onFloatDone(f.id)}
        >
          +{fmt(f.amount)}
        </span>
      ))}
    </div>
  )
}
