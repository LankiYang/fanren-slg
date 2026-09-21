import { RESOURCE_META } from '../game/data'
import { TUNE } from '../game/balance'
import type { OfflineReport, ResourceKey } from '../game/types'
import { Sheet } from './Sheet'
import { sprite, fmt } from './util'

/** 回流弹窗：告诉玩家离线期间赚了多少，以及因为上限损失了多少（催回流） */
export function OfflineSheet({ report, onClose }: { report: OfflineReport; onClose: () => void }) {
  const hours = Math.floor(report.seconds / 3600)
  const mins = Math.floor((report.seconds % 3600) / 60)
  const lostHours = report.truncatedSeconds / 3600

  return (
    <Sheet title="闭关所得" sub={hours > 0 ? `${hours} 小时 ${mins} 分` : `${mins} 分钟`} onClose={onClose}>
      <div className="sheet-desc">
        闭关期间洞府仍在运转，产出按 {(TUNE.offlineRate * 100).toFixed(0)}% 折算。
      </div>

      <div className="cost-row" style={{ justifyContent: 'center', gap: 16, margin: '14px 0' }}>
        {(Object.keys(RESOURCE_META) as ResourceKey[])
          .filter(k => report.gained[k] >= 1)
          .map(k => (
            <span className="cost" key={k}>
              <img src={sprite(RESOURCE_META[k].icon)} alt="" />
              +{fmt(report.gained[k])}
            </span>
          ))}
      </div>

      {lostHours > 0.1 && (
        <div className="blocker">
          超出 {TUNE.offlineCapHours} 小时上限，另有约 {lostHours.toFixed(1)} 小时的产出未能累积。
          升级洞府可提高仓库上限。
        </div>
      )}

      <button className="btn-main" onClick={onClose}>收取</button>
    </Sheet>
  )
}
