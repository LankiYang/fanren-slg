import { useEffect } from 'react'

/**
 * 境界突破仪式。README 里锁定的设计点：突破要有「渡劫」式的仪式感，
 * 不能是点一下按钮、境界名瞬间换掉这么平淡。
 * 全屏金光炸开 + 境界名放大浮现，1.8s 后自动收起，点一下也能提前跳过。
 */
export function BreakthroughCeremony({ realmName, onDone }: { realmName: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="ceremony-root" onClick={onDone}>
      <div className="ceremony-burst" />
      <div className="ceremony-rays" />
      <div className="ceremony-text">
        <div className="ceremony-sub">境界 突破</div>
        <div className="ceremony-name">{realmName}</div>
      </div>
    </div>
  )
}
