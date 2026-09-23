import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { EquipmentItem, EquipmentSlot, ResourceKey, SeekDrop } from '../game/types'
import { RESOURCE_META } from '../game/data'
import { useGame } from '../game/store'
import {
  EQUIPMENT_SLOT_META, RARITY_META, SEEK_MILESTONES, characterName, characterSubtitle,
} from '../game/seek'
import { fmt, sprite } from './util'

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'accessory']

export function SeekPanel() {
  const s = useGame()
  const seekNow = useGame(state => state.seekNow)
  const temperEquipment = useGame(state => state.temperEquipment)
  const claimSeekMilestone = useGame(state => state.claimSeekMilestone)
  const maybeStartIntro = useGame(state => state.maybeStartIntro)
  const tutorialDone = useGame(state => state.tutorialDone)
  const [report, setReport] = useState<SeekDrop | null>(null)
  const [hint, setHint] = useState('')
  // 主城优先给建筑交互让位；详细养成信息按需展开。
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!report) return
    const timer = window.setTimeout(() => setReport(null), 4_600)
    return () => window.clearTimeout(timer)
  }, [report])

  // SeekPanel 从开局就常驻挂载（不像其他面板要等玩家点进去），
  // 所以要等开局引导 tutorialDone 变 true 后才补一次触发，否则这个 effect
  // 只会在挂载的那一瞬间跑一次，永远赶不上开局引导结束的时刻。
  useEffect(() => { maybeStartIntro('seek') }, [tutorialDone, maybeStartIntro])

  const need = s.derived.realm.cultivationNeed
  const cultivationProgress = Math.min(1, s.seek.cultivation / Math.max(1, need))
  const nextMilestone = SEEK_MILESTONES.find(item => !s.seek.claimedMilestones.includes(item.id))
  const energyReady = s.seek.energy > 0

  async function doSeek() {
    const result = await seekNow()
    if (!result.ok || !result.report) {
      setHint(result.reason ?? '暂时无法寻道')
      return
    }
    setHint('')
    setReport(result.report)
  }

  async function temper(slot: EquipmentSlot) {
    const result = await temperEquipment(slot)
    setHint(result.ok ? '灵装淬炼完成，战力已更新。' : result.reason ?? '淬炼失败')
  }

  async function claimMilestone() {
    if (!nextMilestone) return
    const result = await claimSeekMilestone(nextMilestone.id)
    setHint(result.ok ? `已领取「${nextMilestone.name}」奖励。` : result.reason ?? '奖励尚未可领')
  }

  return (
    <section className={'seek-panel ' + (expanded ? 'expanded' : 'collapsed')} aria-label="寻道参悟">
      {!expanded && (
        <div className="seek-quick-actions">
          <button
            className={'seek-quick-button ' + (energyReady ? 'charged' : 'calm')}
            type="button"
            onClick={doSeek}
            data-testid="seek-button"
            aria-label={energyReady ? '点击寻道获得随机修为和装备' : '点击静心参悟获得稳定修为'}
          >
            <span className="seek-quick-rune" aria-hidden="true">✦</span>
            <span><b>{energyReady ? '寻道' : '静心'}</b><small>机缘 {s.seek.energy}/24</small></span>
          </button>
          <button className="seek-expand" type="button" onClick={() => setExpanded(true)} aria-label="展开寻道详情" title="展开寻道详情">⌃</button>
        </div>
      )}

      {expanded && <>
      <div className="seek-panel-head">
        <div>
          <span className="seek-kicker">{characterName(s.character.gender)}的道途</span>
          <b>寻道 · 参悟</b>
          <small>{characterSubtitle(s.character.gender).replace(/^男修 · |^女修 · /, '')}</small>
        </div>
        <div className="seek-energy" title="机缘耗尽后仍可免费静心参悟">
          <span>机缘</span>
          <strong>{s.seek.energy}<i>/{24}</i></strong>
          <small>{energyReady ? '高品质率提升' : '静心参悟中'}</small>
        </div>
        <button className="seek-collapse" type="button" onClick={() => setExpanded(false)} aria-label="收起寻道详情" title="收起寻道详情">⌄</button>
      </div>

      <button
        className={'seek-orb ' + (energyReady ? 'charged' : 'calm') + (report ? ' revealing' : '')}
        type="button"
        onClick={doSeek}
        data-testid="seek-button"
        aria-label={energyReady ? '点击寻道获得随机修为和装备' : '点击静心参悟获得稳定修为'}
      >
        <span className="seek-orb-aura" aria-hidden="true" />
        <span className="seek-orb-rune" aria-hidden="true">✦</span>
        <b>{energyReady ? '寻道' : '静心'}</b>
        <small>点击获修为 · 灵材 · 灵装</small>
      </button>

      <div className="seek-progress-block">
        <div className="seek-progress-label">
          <span>本境修为</span>
          <b>{fmt(s.seek.cultivation)} / {fmt(need)}</b>
        </div>
        <div className="seek-progress"><i style={{ width: `${cultivationProgress * 100}%` }} /></div>
        <div className="seek-stats">
          <span>今日 {s.seek.dailyCount} 次</span>
          <span>连悟 {s.seek.combo} · 最佳 {s.seek.bestCombo}</span>
          <span>总计 {s.seek.total}</span>
        </div>
      </div>

      <div className="seek-loadout">
        <div className="seek-subhead">
          <span>灵装三槽</span>
          <b>炼器尘 {fmt(s.seek.equipmentDust)}</b>
        </div>
        <div className="seek-equipment-grid">
          {EQUIPMENT_SLOTS.map(slot => (
            <EquipmentTile
              key={slot}
              item={s.seek.equipmentLoadout[slot]}
              slot={slot}
            canTemper={s.seek.equipmentDust >= (s.derived.seekTemperCosts[slot] ?? 0) && (s.derived.seekTemperCosts[slot] ?? 0) > 0}
              onTemper={() => temper(slot)}
            />
          ))}
        </div>
      </div>

      {nextMilestone && (
        <button className="seek-milestone" type="button" onClick={claimMilestone}>
          <span className="seek-milestone-copy">
            <small>寻道里程 · {nextMilestone.name}</small>
            <b>{Math.min(s.seek.total, nextMilestone.need)} / {nextMilestone.need}</b>
          </span>
          <span className="seek-milestone-progress"><i style={{ width: `${Math.min(100, s.seek.total / nextMilestone.need * 100)}%` }} /></span>
          <span className={'seek-milestone-action' + (s.seek.total >= nextMilestone.need ? ' ready' : '')}>
            {s.seek.total >= nextMilestone.need ? '领取' : '追踪'}
          </span>
        </button>
      )}

      {hint && <div className="seek-hint" role="status">{hint}</div>}
      </>}

      {report && <DropReveal report={report} />}
    </section>
  )
}

function EquipmentTile({ item, slot, canTemper, onTemper }: {
  item: EquipmentItem | null
  slot: EquipmentSlot
  canTemper: boolean
  onTemper: () => void
}) {
  const meta = item ? RARITY_META[item.rarity] : null
  return (
    <div className={'seek-equipment-tile ' + (item ? 'filled' : 'empty')}>
      <img src={sprite(item ? EQUIPMENT_SLOT_META[item.slot].icon : EQUIPMENT_SLOT_META[slot].icon)} alt="" />
      <span>{item ? item.name : EQUIPMENT_SLOT_META[slot].name}</span>
      {item ? (
        <>
          <small style={{ color: meta?.color }}>{meta?.name} · {item.power}</small>
          <button type="button" className="seek-temper" onClick={onTemper} disabled={!canTemper} title="消耗炼器尘淬炼当前灵装">淬炼</button>
        </>
      ) : <small>等待机缘</small>}
    </div>
  )
}

function DropReveal({ report }: { report: SeekDrop }) {
  const meta = RARITY_META[report.rarity]
  const style = { '--drop-color': meta.color } as CSSProperties
  return (
    <div className={'seek-drop-reveal ' + report.rarity} style={style} role="status" aria-live="polite">
      <div className="seek-drop-sparks" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--spark-i': i } as CSSProperties} />)}
      </div>
      <span className="seek-drop-label">{report.pityTriggered ? '保底天机 · ' : ''}{report.critical ? '暴击机缘' : '寻道所得'}</span>
      <strong>{report.title}</strong>
      <small>{report.desc}</small>
      <div className="seek-drop-rewards">
        <span className="seek-cultivation-gain">修为 +{fmt(report.cultivation)}</span>
        {(Object.keys(report.reward) as ResourceKey[]).map(key => (
          <span key={key}>
            <img src={sprite(RESOURCE_META[key].icon)} alt="" />+{fmt(report.reward[key] ?? 0)}
          </span>
        ))}
        {report.dustGained > 0 && <span className="seek-dust-gain">炼器尘 +{report.dustGained}</span>}
      </div>
      {report.equipmentEquipped && <em>已自动装备 · 战力提升</em>}
      {!report.equipmentEquipped && report.equipment && <em>重复灵装 · 已转炼器尘</em>}
    </div>
  )
}
