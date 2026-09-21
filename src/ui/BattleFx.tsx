import { useEffect, useState } from 'react'

/**
 * 战斗结算揭晓节奏：先让血条/数字滚动到位，命中的瞬间打一下闪光，
 * 再弹出胜负结果——而不是面板一打开就把最终数字和结论全部糊在脸上。
 *
 * StagePanel（秘境）和 SectPanel（合围妖兽）的战报共用这一套时序，
 * 避免同样的「先量后炸后揭晓」逻辑抄两遍、参数还容易改岔。
 */
export function useRevealSequence() {
  const [revealed, setRevealed] = useState(false)
  const [impact, setImpact] = useState(false)
  const [resultShown, setResultShown] = useState(false)

  useEffect(() => {
    // 双 rAF 才能保证浏览器先画完「0%/初始态」那一帧，
    // 下一帧再切到目标值，CSS transition 才会真的播——只用一次 rAF
    // 偶尔会和挂载时的首次绘制合并，动画直接跳过去，不会播。
    //
    // ⚠️ 但纯 rAF 有个更大的洞：标签页不可见时浏览器整个暂停 rAF，
    // revealed 永远翻不成 true——实测复现过，战报明明打赢了，
    // 我方战力却全程卡在 0（这正是 Tutorial 组件那个孔洞算不出来的同一个坑，
    // 这次在新代码里又踩了一遍）。加一个 50ms 的 setTimeout 兜底，
    // 不管 rAF 有没有触发，revealed 都保证在有限时间内翻转。
    let raf2 = 0
    let revealedByRaf = false
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => { revealedByRaf = true; setRevealed(true) })
    })
    const tRevealFallback = window.setTimeout(() => {
      if (!revealedByRaf) setRevealed(true)
    }, 50)
    const tImpactOn = window.setTimeout(() => setImpact(true), 560)
    const tImpactOff = window.setTimeout(() => setImpact(false), 780)
    const tResult = window.setTimeout(() => setResultShown(true), 620)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(tRevealFallback)
      clearTimeout(tImpactOn)
      clearTimeout(tImpactOff)
      clearTimeout(tResult)
    }
  }, [])

  return { revealed, impact, resultShown }
}

/** 命中闪光：一次性的全屏亮闪，配合胜负结果弹出增加冲击感 */
export function ImpactFlash({ active }: { active: boolean }) {
  if (!active) return null
  return <div className="impact-flash" />
}
