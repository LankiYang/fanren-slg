import { useEffect, useMemo, useRef, useState } from 'react'
import { TROOP_MAP } from '../game/data'
import type { ExpeditionReport, TroopKey } from '../game/types'
import { sprite } from './util'

type Side = 'player' | 'rival' | null

interface Beat {
  playerHp: number
  rivalHp: number
  actor: Side
  text: string
}

/** 远征战报只播放已结算快照，不在 UI 重新计算胜负。 */
export function ExpeditionBattleScene({ report, onComplete }: {
  report: ExpeditionReport
  onComplete: () => void
}) {
  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState(false)
  const completeRef = useRef(onComplete)
  const playerTroop = strongestTroop(report.formation)
  const beats = useMemo(() => buildBeats(report), [report])
  const beat = beats[Math.min(step, beats.length - 1)]

  useEffect(() => { completeRef.current = onComplete }, [onComplete])

  useEffect(() => {
    if (completed) return
    if (step >= beats.length - 1) {
      const id = window.setTimeout(() => {
        setCompleted(true)
        completeRef.current()
      }, 420)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => setStep(current => Math.min(current + 1, beats.length - 1)), step === 0 ? 620 : 880)
    return () => window.clearTimeout(id)
  }, [beats.length, completed, step])

  const skip = () => {
      setStep(beats.length - 1)
    if (!completed) {
      setCompleted(true)
      completeRef.current()
    }
  }

  return (
    <div className="expedition-battle-scene" aria-live="polite">
      <div className="expedition-battle-topline">
        <span>{report.kind === 'boss' ? '天机首领战' : '路线遭遇战'} · 第 {Math.min(step + 1, beats.length)} 幕</span>
        <button className="battle-skip" onClick={skip} disabled={completed}>跳过演出</button>
      </div>
      <div className="expedition-battle-field">
        {beat.actor && <div key={step} className={'expedition-strike ' + beat.actor} aria-hidden="true" />}
        <Combatant
          side="player"
          troop={playerTroop}
          name="远征军"
          count={report.deployed}
          hp={beat.playerHp}
          active={beat.actor === 'player'}
          hit={beat.actor === 'rival'}
        />
        <div className="expedition-battle-center">
          <div className="expedition-battle-rune">✦</div>
          <div className="expedition-battle-text">{beat.text}</div>
        </div>
        <Combatant
          side="rival"
          troop={report.enemyTroop}
          name={report.title}
          count={Math.max(1, Math.round(report.enemyPower / Math.max(1, TROOP_MAP[report.enemyTroop].power)))}
          hp={beat.rivalHp}
          active={beat.actor === 'rival'}
          hit={beat.actor === 'player'}
        />
      </div>
      <div className="expedition-battle-caption">
        {completed ? (report.win ? '路线推进完成' : '部队收拢完成') : '灵力轨迹正在重演'}
      </div>
    </div>
  )
}

function Combatant({ side, troop, name, count, hp, active, hit }: {
  side: Exclude<Side, null>
  troop: TroopKey
  name: string
  count: number
  hp: number
  active: boolean
  hit: boolean
}) {
  const def = TROOP_MAP[troop]
  return (
    <div className={'expedition-combatant ' + side + (active ? ' active' : '') + (hit ? ' hit' : '')}>
      <div className="expedition-combatant-name">{name}</div>
      <img className="expedition-combatant-unit" src={sprite(def.sprite)} alt={def.name} />
      <div className="expedition-combatant-count">{def.name} · {count}</div>
      <div className="expedition-hp"><i style={{ width: `${hp}%` }} /></div>
    </div>
  )
}

function strongestTroop(formation: Record<TroopKey, number>): TroopKey {
  return (Object.keys(formation) as TroopKey[]).sort((a, b) => formation[b] - formation[a])[0] ?? 'kuilei'
}

function buildBeats(report: ExpeditionReport): Beat[] {
  const finalPlayerHp = Math.max(8, Math.round((1 - report.losses / Math.max(1, report.deployed)) * 100))
  if (report.win) {
    return [
      { playerHp: 100, rivalHp: 100, actor: null, text: '两支路线军阵在星尘中相遇' },
      { playerHp: 100, rivalHp: 68, actor: 'player', text: '我方前锋借地势切入敌阵' },
      { playerHp: Math.max(finalPlayerHp, 70), rivalHp: 68, actor: 'rival', text: '秘境守军反扑，前阵承受兵损' },
      { playerHp: finalPlayerHp, rivalHp: 0, actor: 'player', text: '阵眼破碎，路线灵光向前延展' },
    ]
  }
  return [
    { playerHp: 100, rivalHp: 100, actor: null, text: '两支路线军阵在星尘中相遇' },
    { playerHp: 100, rivalHp: 78, actor: 'player', text: '我方试探推进，敌阵没有动摇' },
    { playerHp: Math.max(finalPlayerHp + 18, 42), rivalHp: 78, actor: 'rival', text: '守军集中反击，前路暂时封闭' },
    { playerHp: finalPlayerHp, rivalHp: 70, actor: 'rival', text: '远征军收拢队形，保全部分兵力' },
  ]
}
