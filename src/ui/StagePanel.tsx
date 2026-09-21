import { useEffect, useState } from 'react'
import { STAGES, TROOP_MAP, RESOURCE_META } from '../game/data'
import type { ResourceKey } from '../game/types'
import { useGame, battlePower } from '../game/store'
import { formationUsed, optimalFormation } from '../game/compute'
import { Formation } from './Formation'
import { useRevealSequence, ImpactFlash } from './BattleFx'
import { sprite, fmt, useCountUp } from './util'

interface Report {
  name: string
  sprite: string
  win: boolean
  myPower: number
  enemyPower: number
  deployed: number
  losses: number
}

/** 秘境推图（对应无尽冬日的远征章节）*/
export function StagePanel() {
  const s = useGame()
  const challenge = useGame(x => x.challengeStage)
  const setFormation = useGame(x => x.setFormation)
  const maybeStartIntro = useGame(x => x.maybeStartIntro)
  const [report, setReport] = useState<Report | null>(null)
  /** 点「挑战」先进编队界面，确认后才真正开打 */
  const [staging, setStaging] = useState<number | null>(null)

  useEffect(() => { maybeStartIntro('stage') }, [maybeStartIntro])

  const chapters = [...new Set(STAGES.map(x => x.chapter))]

  if (staging !== null) {
    const st = STAGES.find(x => x.id === staging)!
    const my = battlePower(s, st.enemyTroop)
    const win = my >= st.enemyPower
    return (
      <div>
        <div className="section-title">{st.id}. {st.name}</div>
        <div className="card">
          <img className="thumb" src={sprite(st.sprite)} alt="" />
          <div className="card-body">
            <div className="card-name">敌方 {TROOP_MAP[st.enemyTroop].name}</div>
            <div className="card-meta">
              战力 {fmt(st.enemyPower)} · 我方{' '}
              <span style={{ color: win ? 'var(--ok)' : 'var(--danger)' }}>{fmt(my)}</span>
            </div>
            <div className="progress">
              <i style={{
                width: `${Math.min(100, (my / st.enemyPower) * 100)}%`,
                background: win ? 'var(--ok)' : 'var(--danger)',
              }} />
            </div>
          </div>
        </div>

        <Formation enemyTroop={st.enemyTroop} />

        {!win && (
          <div className="blocker">
            当前编队战力不足。可调整出战比例（被克制的兵种留守反而更优），
            或回去练兵、升境界、研功法、锻法宝。
          </div>
        )}

        <button
          className="btn-main"
          disabled={formationUsed(s) <= 0}
          onClick={() => {
            const r = challenge(st.id)
            if (r.ok) {
              setReport({ name: st.name, sprite: st.sprite, win: r.win, myPower: r.myPower, enemyPower: r.enemyPower, deployed: r.deployed ?? 0, losses: r.losses ?? 0 })
              setStaging(null)
            }
          }}
        >
          出战
        </button>
        <button className="btn-sub" style={{ width: '100%', marginTop: 8 }} onClick={() => setStaging(null)}>
          返回
        </button>
      </div>
    )
  }

  if (report) {
    return <StageReport report={report} onClose={() => setReport(null)} />
  }

  return (
    <div>
      <div className="section-title">秘境探索 · 已通关 {s.clearedStage}/{STAGES.length}</div>

      {chapters.map(ch => {
        const inChapter = STAGES.filter(x => x.chapter === ch)
        // 整章都还没解锁时折叠成一行，40 关全铺开会把列表撑得没法看
        const chapterOpen = inChapter.some(x => x.id <= s.clearedStage + 1)
        if (!chapterOpen) {
          return (
            <div key={ch}>
              <div className="chapter-title">
                第 {ch} 章 · {inChapter[0].chapterName}
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}> 🔒 未解锁</span>
              </div>
            </div>
          )
        }
        return (
        <div key={ch}>
          <div className="chapter-title">第 {ch} 章 · {inChapter[0].chapterName}</div>
          {inChapter.map(st => {
            const cleared = s.clearedStage >= st.id
            const open = st.id <= s.clearedStage + 1
            const my = battlePower(s, st.enemyTroop)
            return (
              <div className={'card' + (open ? '' : ' locked-card')} key={st.id}>
                <img className="thumb" src={sprite(st.sprite)} alt="" />
                <div className="card-body">
                  <div className="card-name">
                    {st.id}. {st.name}
                    {cleared && <span style={{ color: 'var(--ok)', fontSize: 11 }}> ✓</span>}
                  </div>
                  <div className="card-meta">
                    {st.desc}
                    <br />
                    敌方 {TROOP_MAP[st.enemyTroop].name} · 战力 {fmt(st.enemyPower)}
                    {open && (
                      <>
                        {' · 我方 '}
                        <span style={{ color: my >= st.enemyPower ? 'var(--ok)' : 'var(--danger)' }}>
                          {fmt(my)}
                        </span>
                      </>
                    )}
                    <span style={{ color: 'var(--text-dim)' }}> · 建议洞府 {st.anchorDongfu} 级</span>
                    <br />
                    奖励：{(Object.keys(st.reward) as ResourceKey[])
                      .map(k => `${RESOURCE_META[k].name} ${fmt(st.reward[k] ?? 0)}`)
                      .join(' · ')}
                  </div>
                  <div className="progress">
                    <i style={{ width: `${Math.min(100, (my / st.enemyPower) * 100)}%` }} />
                  </div>
                </div>
                <div className="card-side">
                  <button
                    className="btn-sub"
                    disabled={!open}
                    onClick={() => {
                      // 首次进入（编队为空）自动填一套择优编队，
                      // 免得玩家面对三个归零的滑杆不知所措
                      if (formationUsed(s) === 0) {
                        setFormation(optimalFormation(s, st.enemyTroop))
                      }
                      setStaging(st.id)
                    }}
                  >
                    {cleared ? '再战' : '挑战'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        )
      })}
    </div>
  )
}

/**
 * 战报：数字先归零，揭晓时才滚动到最终值，命中瞬间打一下闪光，
 * 胜负结果延后弹出——而不是面板一打开就把结论糊在脸上。
 */
function StageReport({ report, onClose }: { report: Report; onClose: () => void }) {
  const { revealed, impact, resultShown } = useRevealSequence()
  const myShown = useCountUp(revealed ? report.myPower : 0, 550)
  const enemyShown = useCountUp(revealed ? report.enemyPower : 0, 550)

  return (
    <div className="battle">
      <ImpactFlash active={impact} />
      <div className="section-title">{report.name}</div>
      <img
        className={'battle-boss' + (report.win && resultShown ? ' defeated' : '')}
        src={sprite(report.sprite)}
        alt=""
      />
      <div className="battle-vs">
        <div className="battle-side">
          <div className="battle-num" style={{ color: 'var(--teal)' }}>
            {fmt(myShown)}
          </div>
          <div className="battle-lbl">我方战力</div>
        </div>
        <div className="battle-mid">VS</div>
        <div className="battle-side">
          <div className="battle-num" style={{ color: 'var(--danger)' }}>
            {fmt(enemyShown)}
          </div>
          <div className="battle-lbl">敌方战力</div>
        </div>
      </div>
      <div className={'battle-res ' + (report.win ? 'win' : 'lose') + (resultShown ? ' shown' : '')}>
        {report.win ? '✦ 秘境已破 ✦' : '✧ 力有不逮 ✧'}
      </div>
      <div className="sheet-desc battle-reward-in" style={{ textAlign: 'center' }}>
        {report.win
          ? `所获资源已入储物袋，本次出战损失 ${report.losses} 名部队。`
          : `本次出战损失 ${report.losses} 名部队，未推进关卡且不发放首通奖励。请调整编队或补充兵力后再战。`}
      </div>
      <button className="btn-main" onClick={onClose}>返回</button>
    </div>
  )
}
