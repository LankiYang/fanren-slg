import type { ReactNode } from 'react'
import { RESOURCE_META } from '../game/data'
import type { ResourceKey, Resources } from '../game/types'
import { sprite, fmt } from './util'

export function Sheet({
  title, sub, onClose, children,
}: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-title">{title}</span>
          {sub && <span className="sheet-lv">{sub}</span>}
          <button className="sheet-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 消耗清单：资源不足的条目标红 */
export function Cost({ cost, have }: { cost: Partial<Resources>; have: Resources }) {
  const entries = (Object.keys(cost) as ResourceKey[]).filter(k => (cost[k] ?? 0) > 0)
  if (entries.length === 0) return null
  return (
    <div className="cost-row">
      {entries.map(k => {
        const need = cost[k] ?? 0
        const lack = have[k] < need
        return (
          <span className={'cost' + (lack ? ' lack' : '')} key={k}>
            <img src={sprite(RESOURCE_META[k].icon)} alt={RESOURCE_META[k].name} />
            {fmt(need)}
          </span>
        )
      })}
    </div>
  )
}
