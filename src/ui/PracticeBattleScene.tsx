import { useEffect, useMemo, useRef, useState } from 'react'
import { TROOP_MAP } from '../game/data'
import type { TroopKey } from '../game/types'
import { sprite, fmt } from './util'

type BattleSide = 'player' | 'rival' | null

export interface PracticeBattleReport {
  kindLabel: string
  title: string
  enemyName: string
  enemyTroop: TroopKey
  myPower: number
  enemyPower: number
  formation: Record<TroopKey, number>
  deployed: number
  losses: number
  win: boolean
}

interface BattleBeat {
  playerHp: number
  rivalHp: number
  actor: BattleSide
  text: string
  impact: string
}

/**
 * 只播放领域已经结算的战报快照。画面负责表现回合、兵种关系和兵损，
 * 不在客户端重新计算胜负，未来换成服务端战报时仍可直接复用。
 */
export function PracticeBattleScene({ report, onComplete }: {
  report: PracticeBattleReport
  onComplete: () => void
}) {
  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState(false)
  const completeRef = useRef(onComplete)
  const beats = useMemo(() => buildBeats(report), [report])
  const beat = beats[Math.min(step, beats.length - 1)]
  const playerTroop = strongestTroop(report.formation)
  const counterText = getCounterText(playerTroop, report.enemyTroop)

  useEffect(() => { completeRef.current = onComplete }, [onComplete])

  useEffect(() => {
    if (completed) return
    if (step >= beats.length - 1) {
      const id = window.setTimeout(() => {
        setCompleted(true)
        completeRef.current()
      }, 460)
      return () => window.clearTimeout(id)
    }
    const delay = step === 0 ? 760 : 980
    const id = window.setTimeout(() => setStep(current => Math.min(current + 1, beats.length - 1)), delay)
    return () => window.clearTimeout(id)
  }, [beats.length, completed, step])

  const skip = () => {
    if (completed) return
    setStep(beats.length - 1)
    setCompleted(true)
    completeRef.current()
  }

  return (
    <div className="practice-battle-scene" aria-live="polite">
      <div className="practice-battle-topline">
        <div><b>{report.kindLabel}</b><span> · {report.title}</span></div>
        <div className="practice-battle-tools">
          <span>{completed ? '结算' : `回合 ${Math.min(step + 1, beats.length)}/${beats.length}`}</span>
          <button className="battle-skip" onClick={skip} disabled={completed}>跳过演出</button>
        </div>
      </div>

      <div className="practice-battle-summary">
        <span>我方战力 <b>{fmt(report.myPower)}</b></span>
        <span className={report.myPower >= report.enemyPower ? 'advantage' : 'danger'}>{counterText}</span>
        <span>敌阵战力 <b>{fmt(report.enemyPower)}</b></span>
      </div>

      <div className="practice-battle-field">
        <div className="practice-battle-stars" aria-hidden="true" />
        {beat.actor && <div key={`strike-${step}`} className={'practice-battle-strike ' + beat.actor} aria-hidden="true" />}
        <BattleCombatant
          key={`player-${step}`}
          side="player"
          troop={playerTroop}
          name="本门军阵"
          count={report.deployed}
          hp={beat.playerHp}
          active={beat.actor === 'player'}
          hit={beat.actor === 'rival'}
        />
        <div className="practice-battle-center">
          <div className="practice-battle-rune">✦</div>
          <strong key={`impact-${step}`} className={'practice-battle-impact ' + (beat.actor ?? '')}>{beat.impact}</strong>
          <div className="practice-battle-text">{beat.text}</div>
        </div>
        <BattleCombatant
          key={`rival-${step}`}
          side="rival"
          troop={report.enemyTroop}
          name={report.enemyName}
          count={Math.max(1, Math.round(report.enemyPower / Math.max(1, TROOP_MAP[report.enemyTroop].power)))}
          hp={beat.rivalHp}
          active={beat.actor === 'rival'}
          hit={beat.actor === 'player'}
        />
      </div>

      <div className={'practice-battle-caption ' + (completed ? 'done' : '')}>
        {completed ? (report.win ? '敌阵已破 · 战报结算完成' : '部队已撤 · 战报结算完成') : '每一幕只展示已结算的战斗结果'}
      </div>
    </div>
  )
}

function BattleCombatant({ side, troop, name, count, hp, active, hit }: {
  side: Exclude<BattleSide, null>
  troop: TroopKey
  name: string
  count: number
  hp: number
  active: boolean
  hit: boolean
}) {
  const def = TROOP_MAP[troop]
  return (
    <div className={'practice-battle-combatant ' + side + (active ? ' active' : '') + (hit ? ' hit' : '') + (hp <= 0 ? ' defeated' : '')}>
      <div className="practice-battle-name">{name}</div>
      <div className="practice-battle-unit-wrap">
        <img className="practice-battle-unit" src={sprite(def.sprite)} alt={def.name} />
        {active && <i className="practice-battle-ring" aria-hidden="true" />}
      </div>
      <div className="practice-battle-count">{def.name} · {fmt(count)} 名</div>
      <div className="practice-battle-hp-label"><span>阵线</span><b>{hp}%</b></div>
      <div className="practice-battle-hp"><i style={{ width: `${hp}%` }} /></div>
    </div>
  )
}

function strongestTroop(formation: Record<TroopKey, number>): TroopKey {
  return (Object.keys(formation) as TroopKey[])
    .sort((first, second) => (formation[second] ?? 0) - (formation[first] ?? 0))[0] ?? 'kuilei'
}

function getCounterText(playerTroop: TroopKey, enemyTroop: TroopKey): string {
  if (TROOP_MAP[playerTroop].counters === enemyTroop) return `克制 · ${TROOP_MAP[playerTroop].name}压制敌阵`
  if (TROOP_MAP[enemyTroop].counters === playerTroop) return `被克 · ${TROOP_MAP[enemyTroop].name}压制我方`
  return '无克制 · 看战力与兵损'
}

function buildBeats(report: PracticeBattleReport): BattleBeat[] {
  const finalPlayerHp = Math.max(8, Math.round((1 - report.losses / Math.max(1, report.deployed)) * 100))
  const playerTroop = strongestTroop(report.formation)
  const counter = TROOP_MAP[playerTroop].counters === report.enemyTroop
  const counterName = TROOP_MAP[playerTroop].name

  if (report.win) {
    return [
      { playerHp: 100, rivalHp: 100, actor: null, impact: '列阵', text: '两方军阵锁定灵脉，战斗正式开始' },
      { playerHp: 100, rivalHp: 66, actor: 'player', impact: counter ? '克制突击' : '正面冲阵', text: counter ? `${counterName}抓住克制窗口，前锋撕开敌阵` : '我方主力结阵推进，敌方阵脚开始松动' },
      { playerHp: Math.max(finalPlayerHp, 70), rivalHp: 66, actor: 'rival', impact: '敌阵反击', text: `守军回身反扑，前阵承受 ${report.losses} 名兵损` },
      { playerHp: finalPlayerHp, rivalHp: 0, actor: 'player', impact: '阵眼击破', text: '敌阵灵核碎裂，秘境/远征路线向前开启' },
    ]
  }

  return [
    { playerHp: 100, rivalHp: 100, actor: null, impact: '列阵', text: '两方军阵锁定灵脉，战斗正式开始' },
    { playerHp: 100, rivalHp: 78, actor: 'player', impact: counter ? '勉强突击' : '试探推进', text: counter ? '我方虽有克制，但战力不足以撕开守阵' : '我方试探进攻，守军稳住阵线' },
    { playerHp: Math.max(finalPlayerHp + 18, 42), rivalHp: 78, actor: 'rival', impact: '反击压制', text: `守军集中反击，前阵损失 ${report.losses} 名部队` },
    { playerHp: finalPlayerHp, rivalHp: 62, actor: 'rival', impact: '收拢撤离', text: '继续硬撞只会扩大损失，部队收拢等待下一次调整' },
  ]
}
