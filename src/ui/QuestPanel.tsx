import { useState } from 'react'
import { QUESTS, questReward } from '../game/quests'
import { RESOURCE_META } from '../game/data'
import type { ResourceKey } from '../game/types'
import { useGame } from '../game/store'
import { sprite, fmt } from './util'

/** 成长任务：兼作新手引导与留存钩子 */
export function QuestPanel() {
  const s = useGame()
  const claim = useGame(x => x.claimQuest)
  const [hint, setHint] = useState('')

  const claimedCount = s.claimedQuests.length

  return (
    <div>
      <div className="section-title">成长任务 · 已完成 {claimedCount}/{QUESTS.length}</div>

      {QUESTS.map(q => {
        const claimed = s.claimedQuests.includes(q.id)
        const done = q.done(s)
        const prog = q.progress?.(s)
        const reward = questReward(s, q)

        return (
          <div className={'card' + (claimed ? ' locked-card' : '')} key={q.id}>
            <div className="card-body">
              <div className="card-name">
                {q.name}
                {claimed && <span style={{ color: 'var(--ok)', fontSize: 11 }}> ✓ 已领取</span>}
              </div>
              <div className="card-meta">
                {q.desc}
                {prog && !claimed && (
                  <> · <span style={{ color: done ? 'var(--ok)' : 'var(--text-dim)' }}>
                    {fmt(Math.min(prog.cur, prog.target))}/{fmt(prog.target)}
                  </span></>
                )}
              </div>
              {!claimed && (
                <div className="cost-row" style={{ marginTop: 6, marginBottom: 0 }}>
                  {(Object.keys(reward) as ResourceKey[]).map(k => (
                    <span className="cost" key={k}>
                      <img src={sprite(RESOURCE_META[k].icon)} alt="" />
                      {fmt(reward[k] ?? 0)}
                    </span>
                  ))}
                </div>
              )}
              {prog && !claimed && (
                <div className="progress">
                  <i style={{ width: `${Math.min(100, (prog.cur / prog.target) * 100)}%` }} />
                </div>
              )}
            </div>
            <div className="card-side">
              {!claimed && (
                <button
                  className="btn-sub"
                  disabled={!done}
                  style={done ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : undefined}
                  onClick={() => {
                    const r = claim(q.id)
                    setHint(r.ok ? `已领取「${q.name}」` : (r.reason ?? ''))
                  }}
                >
                  {done ? '领取' : '进行中'}
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
