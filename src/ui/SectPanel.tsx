import { useEffect, useState } from 'react'
import { RESOURCE_META } from '../game/data'
import { BOSS } from '../game/balance'
import type { BossReport, ResourceKey } from '../game/types'
import { useGame } from '../game/store'
import { useRevealSequence, ImpactFlash } from './BattleFx'
import { sprite, fmt, fmtTime, useCountUp } from './util'
import { useOnline } from '../online/onlineStore'
import { OnlineSectManagement } from './OnlineSectManagement'

/** 宗门 · 合围妖兽（对应无尽冬日的熊出没） */
export function SectPanel({ now }: { now: number }) {
  const s = useGame()
  const challengeBoss = useGame(x => x.challengeBoss)
  const bossReadyAt = useGame(x => x.bossReadyAt)
  const unlockQueue = useGame(x => x.unlockQueue)
  const maybeStartIntro = useGame(x => x.maybeStartIntro)
  const online = useOnline()
  const [report, setReport] = useState<BossReport | null>(null)
  const [hint, setHint] = useState('')

  const built = s.buildings.zongmen.level > 0

  useEffect(() => { if (built) maybeStartIntro('sect') }, [built, maybeStartIntro])
  useEffect(() => { void online.connect() }, [online.connect])
  const readyAt = s.derived.boss.readyAt || bossReadyAt()
  const onCooldown = now < readyAt
  const hp = s.derived.boss.hp
  const mine = s.derived.boss.myPower

  if (report) {
    return <BossReportView report={report} onClose={() => setReport(null)} />
  }

  return (
    <div>
      <div className="section-title">合围妖兽</div>
      <div className="card">
        <img className="thumb" src={sprite('monster/jiedan-beast.webp')} alt="" />
        <div className="card-body">
          <div className="card-name">结丹期凶兽</div>
          <div className="card-meta">
            血量 {fmt(hp)}　我方战力 {fmt(mine)}
            <br />
            单人难以撼动，同门会共同出手。每 {BOSS.cooldownHours} 小时现身一次。
          </div>
          <div className="progress">
            <i style={{ width: `${Math.min(100, (mine / hp) * 100)}%` }} />
          </div>
        </div>
      </div>

      {!built && <div className="blocker">需先兴建宗门大殿</div>}
      {onCooldown && (
        <div className="blocker">妖兽尚未再次现身 · {fmtTime(readyAt - now)}</div>
      )}

      <button
        className="btn-main"
        data-tut="boss-challenge"
        disabled={!built || onCooldown}
        onClick={async () => {
          const r = await challengeBoss()
          if (r.ok && r.report) setReport(r.report)
          else setHint(r.reason ?? '')
        }}
      >
        发起合围
      </button>
      <div className="hint">{hint}</div>

      <div className="section-title">宗门事务</div>
      <div className="card">
        <div className="card-body">
          <div className="card-name">开辟第二条建造队列</div>
          <div className="card-meta">
            {s.queueSlots >= 2
              ? '已开辟，可同时营造两处。'
              : '请同门相助，可同时营造两处建筑。正式版此处接付费/道具。'}
          </div>
        </div>
        <div className="card-side">
          <button
            className="btn-sub"
            disabled={s.queueSlots >= 2}
            onClick={async () => {
              const r = await unlockQueue()
              setHint(r.ok ? '已开辟第二条建造队列' : (r.reason ?? ''))
            }}
          >
            {s.queueSlots >= 2 ? '已开辟' : '开辟'}
          </button>
        </div>
      </div>

      {online.snapshot ? (
        <OnlineSectManagement snapshot={online.snapshot} />
      ) : (
        <section className="online-sect-management" aria-label="宗门管理">
          <div className="section-title">宗门身份</div>
          <div className="blocker">{online.status === 'connecting' ? '正在同步宗门信息…' : online.error || '宗门信息暂时不可用'}</div>
          {online.status === 'offline' && <button className="btn-sub" type="button" onClick={() => void online.connect()}>重新同步</button>}
        </section>
      )}
    </div>
  )
}

/**
 * 合围战报：两条血条先归零，揭晓时才涨到实际伤害占比，命中瞬间闪一下，
 * 胜负结果延后弹出。逻辑和 StagePanel 的战报共用 useRevealSequence，
 * 只是这里多一条「同门相助」的条，且目标是妖兽血量而不是敌方战力。
 */
function BossReportView({ report, onClose }: { report: BossReport; onClose: () => void }) {
  const { revealed, impact, resultShown } = useRevealSequence()
  const myShown = useCountUp(revealed ? report.myDamage : 0, 550)
  const npcShown = useCountUp(revealed ? report.npcDamage : 0, 550)
  const win = report.totalDamage >= report.bossHp
  const pct = (d: number) => Math.min(100, (d / report.bossHp) * 100)

  return (
    <div className="battle">
      <ImpactFlash active={impact} />
      <div className="section-title">合围 · {report.tierName}</div>
      <img
        src={sprite('monster/jiedan-beast.webp')}
        alt=""
        style={{ width: '58%', margin: '4px auto 10px', display: 'block' }}
        className={win && resultShown ? 'battle-boss defeated' : undefined}
      />
      <div className="sheet-desc" style={{ textAlign: 'center' }}>
        妖兽血量 {fmt(report.bossHp)}
      </div>

      <div style={{ margin: '12px 0' }}>
        <div className="card-meta">我方伤害 {fmt(myShown)}</div>
        <div className="progress"><i style={{ width: `${revealed ? pct(report.myDamage) : 0}%` }} /></div>
        <div className="card-meta" style={{ marginTop: 8 }}>同门相助 {fmt(npcShown)}</div>
        <div className="progress">
          <i style={{ width: `${revealed ? pct(report.npcDamage) : 0}%`, background: 'var(--gold-dim)' }} />
        </div>
      </div>

      <div className={'battle-res ' + (win ? 'win' : 'lose') + (resultShown ? ' shown' : '')}>
        {win ? '✦ 妖兽伏诛 ✦' : `✧ ${report.tierName} ✧`}
      </div>

      <div className="cost-row battle-reward-in" style={{ justifyContent: 'center', gap: 14, margin: '10px 0' }}>
        {(Object.keys(RESOURCE_META) as ResourceKey[])
          .filter(k => report.gained[k] >= 1)
          .map(k => (
            <span className="cost" key={k}>
              <img src={sprite(RESOURCE_META[k].icon)} alt="" />
              +{fmt(report.gained[k])}
            </span>
          ))}
      </div>

      <button className="btn-main" onClick={onClose}>返回</button>
    </div>
  )
}
