import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TUTORIAL, FEATURE_INTRO, GUIDE_TOURS, GUIDE_NAME } from '../game/tutorial'
import { useGame } from '../game/store'
import { sprite } from './util'

interface Hole { x: number; y: number; w: number; h: number }

/** 对话区放哪：贴底（默认）／贴在高亮目标正上方／逼不得已贴在屏幕最顶 */
type DialogLayout = { mode: 'bottom' } | { mode: 'above'; top: number } | { mode: 'top' }

// GAP 留得比看起来需要的更宽：从「贴底」切到「贴目标上方」的过渡帧里，
// 立绘会先按小尺寸估算一次（还没测到完整渲染高度），等测到真实高度时
// 位置已经定下了，实测有 ~4px 的滞后误差。GAP 加大到 16 吃掉这个滞后，
// 不然对话框和高亮框会有一瞬间的轻微重叠。
const GAP = 16
const MIN_TOP = 4
const FALLBACK_DIALOG_H = 220

/**
 * 阻断式新手引导。
 *
 * 实现要点：遮罩不是「一整块半透明盖住全屏、再用 SVG 抠个洞」——
 * 那样洞里的元素依然被遮罩挡住点不到（pointer-events 无法只在某块区域放行）。
 * 这里用 4 块 div 把孔洞「围」起来（上/下/左/右），孔洞位置没有任何 DOM，
 * 点击自然穿透到目标元素上。高亮描边另用一个 pointer-events:none 的框来画。
 */
export function Tutorial() {
  const done = useGame(x => x.tutorialDone)
  const characterGender = useGame(x => x.character.gender)
  const step = useGame(x => x.tutorialStep)
  const nextStep = useGame(x => x.nextTutorialStep)
  const skip = useGame(x => x.skipTutorial)
  const activeIntroId = useGame(x => x.activeIntro)
  const introStep = useGame(x => x.introStep)
  const nextIntro = useGame(x => x.nextIntroStep)
  const skipIntro = useGame(x => x.skipIntro)
  const activeGuideId = useGame(x => x.activeGuide)
  const guideStep = useGame(x => x.guideStep)
  const nextGuide = useGame(x => x.nextGuideStep)
  const skipGuide = useGame(x => x.skipGuide)
  const [hole, setHole] = useState<Hole | null>(null)
  const [layout, setLayout] = useState<DialogLayout>({ mode: 'bottom' })
  const rafRef = useRef<number>(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  // 开局引导优先级最高；任务教程正在播放时，功能首次引导让路，避免两个蒙层叠在一起
  // 角色身份确定前只显示角色选择，不能让引导蒙层抢走确认按钮的点击。
  const onboarding = !done && characterGender !== null
  const guideSteps = activeGuideId ? GUIDE_TOURS[activeGuideId] : undefined
  const introSteps = activeIntroId ? FEATURE_INTRO[activeIntroId as keyof typeof FEATURE_INTRO] : undefined
  const taskGuide = !onboarding && !!guideSteps
  const passiveIntro = !onboarding && !taskGuide && !!introSteps
  const cur = onboarding ? TUTORIAL[step] : taskGuide ? guideSteps?.[guideStep] : introSteps?.[introStep]
  const curLen = onboarding ? TUTORIAL.length : taskGuide ? (guideSteps?.length ?? 0) : (introSteps?.length ?? 0)
  const curStep = onboarding ? step : taskGuide ? guideStep : introStep
  const advance = onboarding ? nextStep : taskGuide ? nextGuide : nextIntro
  const doSkip = onboarding ? skip : taskGuide ? skipGuide : skipIntro
  const active = !!cur

  // 目标位置会随面板开合、滚动而变，所以要持续跟随，不是算一次就完。
  //
  // 关键1：不能只靠 requestAnimationFrame。标签页不可见时浏览器会完全暂停 rAF，
  // 此时孔洞永远算不出来 → 玩家看到全屏黑罩且无处可点 → 引导直接卡死。
  // 所以三管齐下：进入步骤先同步量一次（保证首帧就对），
  // rAF 负责可见时的丝滑跟随，setInterval 兜底保证不可见/被节流时仍能更新。
  //
  // 关键2：对话框位置不是「贴底 / 跳到屏幕最顶」二选一。
  // 早期版本一遇到目标会被对话框挡住就直接把人物甩到 y=0——结果出现过
  // 「升级」按钮在屏幕最下面、人物和台词却挂在最上面、中间隔一大截空场景的怪状况，
  // 人物和她在说的目标看着毫不相关。现在改成优先贴到目标正上方（仅比目标高一点），
  // 只有连贴上方都放不下时才退到贴最顶这个兜底方案。
  useLayoutEffect(() => {
    if (!active) return

    const measure = () => {
      let nextHole: Hole | null = null
      if (cur.target) {
        const el = document.querySelector(cur.target)
        if (el) {
          const r = el.getBoundingClientRect()
          const pad = cur.pad ?? 4
          nextHole = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }
        }
        // 目标还没渲染出来（比如面板正在打开）就先不挖洞，nextHole 保持 null
      }
      setHole(prev => {
        if (!nextHole) return prev === null ? prev : null
        if (prev && prev.x === nextHole.x && prev.y === nextHole.y && prev.w === nextHole.w && prev.h === nextHole.h) {
          return prev
        }
        return nextHole
      })

      // 对话框自身高度不依赖它自己的定位方式（top/bottom 只是外部偏移，不影响内容撑开的高度），
      // 所以可以直接读上一帧渲染出的真实尺寸，不存在「先有鸡还是先有蛋」的问题。
      const dialogH = dialogRef.current?.getBoundingClientRect().height || FALLBACK_DIALOG_H

      let nextLayout: DialogLayout
      if (!nextHole) {
        nextLayout = { mode: 'bottom' }
      } else {
        const overlapsBottom = nextHole.y + nextHole.h + GAP > window.innerHeight - dialogH
        if (!overlapsBottom) {
          nextLayout = { mode: 'bottom' }
        } else {
          const aboveTop = nextHole.y - GAP - dialogH
          nextLayout = aboveTop >= MIN_TOP ? { mode: 'above', top: aboveTop } : { mode: 'top' }
        }
      }
      setLayout(prev => {
        if (prev.mode !== nextLayout.mode) return nextLayout
        if (prev.mode === 'above' && nextLayout.mode === 'above' && Math.abs(prev.top - nextLayout.top) >= 1) {
          return nextLayout
        }
        return prev
      })
    }

    measure()

    const loop = () => { measure(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    const timer = window.setInterval(measure, 250)

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(timer)
    }
  }, [active, curStep, cur])

  // advance='click' 时，监听目标元素被点中就推进
  useEffect(() => {
    if (!active || cur.advance !== 'click' || !cur.target) return
    const onClick = (e: MouseEvent) => {
      const el = document.querySelector(cur.target!)
      if (el && e.target instanceof Node && el.contains(e.target)) {
        // 让目标自己的 onClick 先跑完，再推进步骤
        setTimeout(() => advance(), 0)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [active, curStep, cur, advance])

  if (characterGender === null || !active) return null

  const isClickStep = cur.advance === 'click' && !!cur.target
  // 纯对话步骤：整屏可点推进；点击步骤：只有孔洞可点，遮罩吞掉点击
  const maskClick = isClickStep ? undefined : () => advance()

  const pinnedTop = layout.mode === 'top'
  const dialogStyle = layout.mode === 'above' ? { top: layout.top, bottom: 'auto' as const } : undefined

  return (
    <div className={'tut-root' + (passiveIntro ? ' passive' : '')}>
      {/* 跳过按钮只在对话框真被钉在屏幕最顶（罕见的兜底情况）时才需要让位到底部，
          贴目标上方（'above'）时对话框本来就不占最顶那块空间，不用挪 */}
      <button
        className={'tut-skip' + (pinnedTop ? ' bottom' : '')}
        onClick={e => { e.stopPropagation(); doSkip() }}
      >
        跳过引导
      </button>
      {!passiveIntro && (hole ? (
        <>
          {/* 四块遮罩围出孔洞，孔洞区域没有 DOM，点击自然穿透 */}
          <div className="tut-mask" style={{ left: 0, top: 0, width: '100%', height: Math.max(0, hole.y) }} onClick={maskClick} />
          <div className="tut-mask" style={{ left: 0, top: hole.y + hole.h, width: '100%', bottom: 0 }} onClick={maskClick} />
          <div className="tut-mask" style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} onClick={maskClick} />
          <div className="tut-mask" style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} onClick={maskClick} />
          {/* 高亮描边，不吃点击 */}
          <div
            className={'tut-ring' + (cur.shape === 'circle' ? ' circle' : '')}
            style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
          />
        </>
      ) : (
        <div className="tut-mask tut-mask-full" onClick={maskClick} />
      ))}

      <div
        ref={dialogRef}
        className={'tut-dialog' + (pinnedTop ? ' top' : '')}
        style={dialogStyle}
        onClick={isClickStep ? undefined : () => advance()}
      >
        <img
          className="tut-portrait"
          src={sprite(cur.pose === 'point' ? 'guide/lady-point.webp' : 'guide/lady-normal.webp')}
          alt={GUIDE_NAME}
        />
        <div className="tut-bubble">
          <div className="tut-name">{GUIDE_NAME}</div>
          <div className="tut-text">{cur.text}</div>
          <div className="tut-foot">
            <span className="tut-progress">{curStep + 1}/{curLen}</span>
            {isClickStep
              ? <span className="tut-hint-click">▸ 点击高亮处继续</span>
              : <span className="tut-next">继续 ▸</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
