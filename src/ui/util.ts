// sprites 下的素材由 art/svg/*.mjs 生成（npm run art），改图请改生成脚本而不是手改 SVG
import { useEffect, useRef, useState } from 'react'

/**
 * 数值变化时插值滚动到目标值，而不是瞬间跳变。
 * 这个游戏几乎所有反馈都靠“看数字涨”，之前是每次 tick 直接 setState 瞬间跳变——
 * 顶栏资源、战斗血条、任务进度全都是硬切，SLG 这个品类恰恰最依赖这层滚动手感。
 *
 * ⚠️ 不能只靠 requestAnimationFrame 推进。标签页不可见时浏览器会完全暂停 rAF——
 * 这正是 Tutorial 组件踩过的坑（孔洞算不出来），这里第二次踩：起初只写了纯 rAF，
 * 实测数字永远卡在初始值不动（战报里明明打赢了，我方战力却全程显示 0）。
 * 用 setInterval 兜底，rAF 负责可见时的丝滑滚动，不可见时 interval 接管推进。
 */
export function useCountUp(target: number, durationMs = 500): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef(0)
  const timerRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const diff = target - from
    if (diff === 0) return

    const start = performance.now()
    let done = false
    const step = () => {
      if (done) return
      const t = Math.min(1, (performance.now() - start) / durationMs)
      const eased = 1 - (1 - t) * (1 - t) // ease-out，越接近终值滚动越慢
      setDisplay(from + diff * eased)
      if (t >= 1) {
        done = true
        fromRef.current = target
        cancelAnimationFrame(rafRef.current)
        clearInterval(timerRef.current)
      }
    }
    const loop = () => { step(); if (!done) rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    timerRef.current = window.setInterval(step, 50)

    return () => {
      done = true
      cancelAnimationFrame(rafRef.current)
      clearInterval(timerRef.current)
    }
    // 故意只依赖 target：durationMs 中途变化不该重新触发滚动
  }, [target])

  return display
}

const modules = import.meta.glob('../assets/sprites/**/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const spriteIndex = new Map(Object.entries(modules).map(([p, url]) => [p.replace(/^.*\/sprites\//, ''), url]))

/** 把 data.ts 里写的相对路径（如 'building/dongfu.svg'）解析成打包后的实际 URL */
export function sprite(rel: string): string {
  return spriteIndex.get(rel) ?? ''
}

/**
 * 大数字缩写：1234 → 1.2k，12345 → 1.2万
 * 顶栏资源位宽度有限（4 列平分），所以位数压到最多 5 个字符，避免被截断成 "49...."
 */
export function fmt(n: number): string {
  const v = Math.floor(n)
  if (v >= 1e8) return (v / 1e8).toFixed(v >= 1e9 ? 0 : 1) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(v >= 1e6 ? 0 : 1) + '万'
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
  return String(v)
}

/** 毫秒 → mm:ss */
export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`
}
