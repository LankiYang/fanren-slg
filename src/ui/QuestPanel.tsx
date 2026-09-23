import { useState } from 'react'
import { GUIDE_CHAPTERS, chapterProgress, currentGuide } from '../game/guide'
import type { GuideRoute } from '../game/guide'
import { QUESTS } from '../game/quests'
import { RESOURCE_META } from '../game/data'
import type { ResourceKey } from '../game/types'
import { useGame } from '../game/store'
import { sprite, fmt } from './util'

interface QuestPanelProps {
  onGo: (route: GuideRoute) => void
}

/** 保留旧组件名，避免外部引用变更；实际内容升级为完整道途指南。 */
export function QuestPanel({ onGo }: QuestPanelProps) {
  const state = useGame()
  const claim = useGame(x => x.claimQuest)
  const [hint, setHint] = useState('')
  const guide = currentGuide(state, Date.now(), state.derived)

  return (
    <div className="guide-panel">
      <div className="guide-overview">
        <b>不知道下一步做什么？</b>
        <span>先完成高亮阶段的当前任务。每条任务都写明“为什么做”和“怎么做”，点“去做”会直接打开对应入口。</span>
      </div>
      <div className="guide-current-banner">
        <span>当前阶段 · {guide.chapter.dayRange}</span>
        <b>{guide.chapter.title}</b>
        <small>{guide.chapter.subtitle}</small>
      </div>
      <div className="guide-why"><b>这一阶段为什么重要</b><span>{guide.chapter.why}</span></div>
      <div className="guide-routine">
        <div className="guide-section-title">每天上线顺序</div>
        {guide.chapter.routines.map((routine, index) => <div className="guide-routine-row" key={routine}><i>{index + 1}</i><span>{routine}</span></div>)}
      </div>

      {GUIDE_CHAPTERS.map(chapter => {
        const progress = chapterProgress(chapter, state, state.derived)
        const active = chapter.id === guide.chapter.id
        const quests = chapter.questIds.map(id => QUESTS.find(quest => quest.id === id)).filter(item => !!item)
        return (
          <details className={'guide-chapter' + (active ? ' active' : '')} key={chapter.id} open={active}>
            <summary>
              <span><b>{chapter.title}</b><small>{chapter.dayRange} · {chapter.subtitle}</small></span>
              <em>{progress.claimed}/{progress.total}</em>
            </summary>
            <div className="guide-chapter-copy">{chapter.why}</div>
            {quests.map(quest => {
              const detail = state.derived.questDetails[quest!.id]
              const claimed = detail?.claimed ?? state.claimedQuests.includes(quest!.id)
              const done = detail?.done ?? false
              const progressValue = detail?.current !== null && detail?.target !== null && detail
                ? { cur: detail.current, target: detail.target }
                : undefined
              const reward = detail?.reward ?? {}
              return (
                <div className={'guide-quest' + (claimed ? ' claimed' : '') + (done && !claimed ? ' ready' : '')} key={quest!.id}>
                  <div className="guide-quest-copy">
                    <div className="guide-quest-title"><b>{quest!.name}</b><span>{claimed ? '已领取' : done ? '可领取' : '进行中'}</span></div>
                    <div className="guide-quest-desc">{quest!.desc}{progressValue && <> · <GuideNumber current={progressValue.cur} target={progressValue.target} /></>}</div>
                    <div className="guide-quest-detail"><b>为什么</b>{quest!.why}</div>
                    <div className="guide-quest-detail"><b>怎么做</b>{quest!.how}</div>
                    {!claimed && <div className="guide-reward">奖励 {(Object.keys(reward) as ResourceKey[]).map(key => <span key={key}><img src={sprite(RESOURCE_META[key].icon)} alt="" />{fmt(reward[key] ?? 0)}</span>)}</div>}
                    {progressValue && !claimed && <div className="progress guide-quest-progress"><i style={{ width: `${Math.min(100, progressValue.cur / Math.max(1, progressValue.target) * 100)}%` }} /></div>}
                  </div>
                  {!claimed && <div className="guide-quest-actions">
                    {!done && <button className="btn-sub" type="button" onClick={() => onGo({ ...quest!.route, guideId: quest!.id })}>去做</button>}
                    <button className="btn-sub" type="button" disabled={!done} onClick={async () => {
                      const result = await claim(quest!.id)
                      setHint(result.ok ? `已领取「${quest!.name}」` : (result.reason ?? ''))
                    }}>{done ? '领取' : '未完成'}</button>
                  </div>}
                </div>
              )
            })}
            <div className="guide-next">完成本段后：{chapter.next}</div>
          </details>
        )
      })}
      {hint && <div className="hint guide-hint">{hint}</div>}
    </div>
  )
}

function GuideNumber({ current, target }: { current: number; target: number }) {
  return <span className="guide-number">{fmt(Math.min(current, target))}/{fmt(target)}</span>
}
