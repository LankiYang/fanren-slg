import { useEffect, useMemo, useRef, useState } from 'react'
import { TROOP_MAP } from '../game/data'
import type { TroopKey, WarfrontReport } from '../game/types'
import { sprite } from './util'

type Side = 'player' | 'rival' | null

interface Beat {
  playerHp: number
  rivalHp: number
  actor: Side
  text: string
}

/**
 * 用已结算的战报播放三段式攻防。这里绝不重新计算胜负，保证演出和领域结算一致。
 * 真实联机版只要返回同形状的 WarfrontReport，就能复用该组件。
 */
export function WarfrontBattleScene({ report, onComplete }: {
  report: WarfrontReport
  onComplete: () => void
}) {
  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState(false)
  const completeRef = useRef(onComplete)
  const playerTroop = strongestTroop(report.formation)
  const beats = useMemo(() => buildBeats(report), [report])
  const beat = beats[step]

  useEffect(() => { completeRef.current = onComplete }, [onComplete])

  useEffect(() => {
    if (completed) return
    if (step >= beats.length - 1) {
      const id = window.setTimeout(() => {
        setCompleted(true)
        completeRef.current()
      }, 360)
      return () => clearTimeout(id)
    }
    const delay = step === 0 ? 650 : 850
    const id = window.setTimeout(() => setStep(current => Math.min(current + 1, beats.length - 1)), delay)
    return () => clearTimeout(id)
  }, [beats.length, completed, step])

  const skip = () => {
    setStep(beats.length - 1)
    if (!completed) {
      setCompleted(true)
      completeRef.current()
    }
  }

  return (
    <div className="warfront-battle-scene" aria-live="polite">
      <div className="warfront-battle-topline">
        <span>第 {Math.min(step + 1, beats.length)} 回合</span>
        <button className="battle-skip" onClick={skip} disabled={completed}>跳过演出</button>
      </div>
      <div className="warfront-battle-field">
        {beat.actor && <div key={step} className={'warfront-strike ' + beat.actor} aria-hidden="true" />}
        <Combatant
          side="player"
          troop={playerTroop}
          name="我方行军"
          count={report.deployed}
          hp={beat.playerHp}
          active={beat.actor === 'player'}
          hit={beat.actor === 'rival'}
        />
        <div className="warfront-battle-center">
          <div className="warfront-battle-vs">VS</div>
          <div className="warfront-battle-text">{beat.text}</div>
        </div>
        <Combatant
          side="rival"
          troop={report.enemyTroop}
          name={report.enemyName}
          count={Math.max(1, Math.round(report.enemyPower / TROOP_MAP[report.enemyTroop].power))}
          hp={beat.rivalHp}
          active={beat.actor === 'rival'}
          hit={beat.actor === 'player'}
        />
      </div>
      <div className="warfront-battle-caption">
        {completed ? '战斗结算完成' : '战报正在推演'}
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
    <div className={'warfront-combatant ' + side + (active ? ' active' : '') + (hit ? ' hit' : '')}>
      <div className="warfront-combatant-name">{name}</div>
      <img className="warfront-combatant-unit" src={sprite(def.sprite)} alt={def.name} />
      <div className="warfront-combatant-count">{def.name} · {count}</div>
      <div className="warfront-hp"><i style={{ width: `${hp}%` }} /></div>
    </div>
  )
}

function strongestTroop(formation: Record<TroopKey, number>): TroopKey {
  return (Object.keys(formation) as TroopKey[])
    .sort((a, b) => formation[b] - formation[a])[0]
}

function buildBeats(report: WarfrontReport): Beat[] {
  const finalPlayerHp = Math.max(8, Math.round((1 - report.losses / report.deployed) * 100))
  if (report.win) {
    return [
      { playerHp: 100, rivalHp: 100, actor: null, text: '两军列阵，灵压相撞' },
      { playerHp: 100, rivalHp: 66, actor: 'player', text: '我方主力率先冲阵' },
      { playerHp: Math.max(finalPlayerHp, 72), rivalHp: 66, actor: 'rival', text: '守军反击，部队出现兵损' },
      { playerHp: finalPlayerHp, rivalHp: 0, actor: 'player', text: '阵线击穿，守军溃退' },
    ]
  }
  return [
    { playerHp: 100, rivalHp: 100, actor: null, text: '两军列阵，灵压相撞' },
    { playerHp: 100, rivalHp: 74, actor: 'player', text: '我方试探进攻，守军稳住阵线' },
    { playerHp: Math.max(finalPlayerHp + 18, 42), rivalHp: 74, actor: 'rival', text: '守军集中反击，前阵受创' },
    { playerHp: finalPlayerHp, rivalHp: 62, actor: 'rival', text: '我方撤离据点，保全部分兵力' },
  ]
}
