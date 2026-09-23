import { currentGuide } from '../game/guide'
import type { GuideRoute } from '../game/guide'
import { useGame } from '../game/store'
import { fmt } from './util'

interface JourneyGuideProps {
  now: number
  onOpen: () => void
  onGo: (route: GuideRoute) => void
}

/** 主城常驻的轻量追踪器；完整解释放进“道途指南”面板，避免挡住地图建筑。 */
export function JourneyGuide({ now, onOpen, onGo }: JourneyGuideProps) {
  const state = useGame()
  const guide = currentGuide(state, now, state.derived)
  const objective = guide.objective
  const ready = !!objective && (state.derived.questDetails[objective.id]?.done ?? objective.done(state))
  const width = guide.progress.total > 0 ? Math.min(100, guide.progress.done / guide.progress.total * 100) : 100

  return (
    <section className={'quest-track journey-guide' + (ready ? ' ready' : '')} aria-label="道途指南">
      <div className="journey-guide-head">
        <span className="quest-track-label">道途指南 · 第 {guide.day} 日</span>
        <button className="journey-guide-open" type="button" onClick={onOpen}>全程路线</button>
      </div>
      <div className="journey-guide-chapter">{guide.chapter.title}<span>{guide.chapter.dayRange}</span></div>
      {objective ? (
        <>
          <div className="quest-track-name">{ready ? '已达成 · ' : '下一步 · '}{objective.name}</div>
          <div className="quest-track-desc">{ready ? '领取奖励后解锁下一项' : objective.why}</div>
          <div className="journey-guide-actions">
            {ready
              ? <button className="journey-guide-action ready" type="button" onClick={onOpen}>领取奖励</button>
              : <button className="journey-guide-action" type="button" onClick={() => onGo({ ...objective.route, guideId: objective.id })}>去做</button>}
            <span className="journey-guide-count">{guide.progress.done}/{guide.progress.total}</span>
          </div>
        </>
      ) : (
        <>
          <div className="quest-track-name">本阶段已完成</div>
          <div className="quest-track-desc">{guide.chapter.next}</div>
          <div className="journey-guide-actions"><button className="journey-guide-action" type="button" onClick={onOpen}>查看后期路线</button></div>
        </>
      )}
      <div className="journey-guide-progress" aria-hidden="true"><i style={{ width: `${width}%` }} /></div>
    </section>
  )
}

export function GuideProgressText({ current, target }: { current: number; target: number }) {
  return <span className="guide-progress-text">{fmt(Math.min(current, target))}/{fmt(target)}</span>
}
