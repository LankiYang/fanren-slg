import { useEffect, useMemo, useState } from 'react'
import { EXPEDITION_SEASON_REWARDS, EXPEDITION_SHOP, EXPEDITION_WEEKLY_REWARDS, expeditionTheme } from '../game/expedition'
import { RESOURCE_META, TROOP_MAP } from '../game/data'
import type { ExpeditionChoice, ExpeditionNodeKind, ExpeditionReport, ResourceKey } from '../game/types'
import { useGame } from '../game/store'
import { Formation } from './Formation'
import { ExpeditionBattleScene } from './ExpeditionBattleScene'
import { Sheet } from './Sheet'
import { fmt, fmtTime, sprite } from './util'
import { PracticePurpose } from './PracticeGuide'

const KIND_META: Record<ExpeditionNodeKind, { label: string; icon: string }> = {
  battle: { label: '破阵', icon: '⚔' },
  gather: { label: '采灵', icon: '✦' },
  caravan: { label: '护送', icon: '⌁' },
  event: { label: '天机', icon: '◇' },
  boss: { label: '首领', icon: '◆' },
}

export function ExpeditionPanel({ now }: { now: number }) {
  const s = useGame()
  const refresh = useGame(x => x.refreshExpedition)
  const energyReadyAt = useGame(x => x.expeditionEnergyReadyAt)
  const explore = useGame(x => x.exploreExpeditionNode)
  const claimWeekly = useGame(x => x.claimExpeditionWeekly)
  const claimSeason = useGame(x => x.claimExpeditionSeason)
  const buyShop = useGame(x => x.buyExpeditionShop)
  const maybeStartIntro = useGame(x => x.maybeStartIntro)
  const [selectedId, setSelectedId] = useState('')
  const [choice, setChoice] = useState<ExpeditionChoice>('steady')
  const [report, setReport] = useState<ExpeditionReport | null>(null)
  const [sceneDone, setSceneDone] = useState(false)
  const [hint, setHint] = useState('')
  const [showStats, setShowStats] = useState(false)

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { maybeStartIntro('expedition') }, [maybeStartIntro])

  const available = useMemo(
    () => s.expeditionNodes.filter(node => node.depth === s.expeditionProgress && !node.resolved),
    [s.expeditionNodes, s.expeditionProgress],
  )
  const selected = s.expeditionNodes.find(node => node.id === selectedId) ?? available[0] ?? null
  const theme = expeditionTheme(s.expeditionMapDayKey)
  const nextSeason = EXPEDITION_SEASON_REWARDS.find(item => !s.expeditionSeasonRewards.includes(item.id))
  const readyAt = energyReadyAt()

  useEffect(() => {
    if (!selected || selected.depth !== s.expeditionProgress || selected.resolved) {
      setSelectedId(available[0]?.id ?? '')
      setChoice('steady')
    }
  }, [available, selected, s.expeditionProgress])

  const selectNode = (id: string) => {
    setSelectedId(id)
    setChoice('steady')
    setHint('')
  }

  const doExplore = async () => {
    if (!selected) return
    const result = await explore(selected.id, choice)
    if (!result.ok || !result.report) {
      setHint(result.reason ?? '暂时无法探索')
      return
    }
    setHint('')
    setReport(result.report)
    setSceneDone(false)
  }

  return (
    <div className="expedition-panel">
      <PracticePurpose section="expedition">
        <div className="practice-purpose-tip">每天先看路线再出发：稳妥路线保证推进，压榨路线追求积分与远征币；远征币在“战绩”里兑换资源和永久遗物。</div>
      </PracticePurpose>
      <div className="expedition-heading">
        <div className="expedition-title-row">
          <img className="expedition-theme-art" src={sprite(theme.sprite)} alt="" />
          <div>
            <div className="expedition-title">{theme.name}</div>
            <div className="expedition-tagline">{theme.tagline}</div>
            <div className="expedition-mode-note">每日 3 枚远征令 · 路线共 5 层 · 终点首领收益最高</div>
          </div>
        </div>
        <div className="expedition-energy">
          <span>远征令</span>
          <b>{s.expeditionEnergy}/3</b>
          {readyAt > 0 && <small>{fmtTime(Math.max(0, readyAt - now))} 后恢复</small>}
        </div>
      </div>

      <div className="expedition-scorebar">
        <span>今日推进 <b>{Math.min(5, s.expeditionProgress)}/5</b></span>
        <span>赛季积分 <b>{fmt(s.expeditionScore)}</b></span>
        <span>远征币 <b className="expedition-currency">{fmt(s.expeditionCurrency)}</b></span>
        <button className="btn-sub expedition-stats-btn" type="button" onClick={() => setShowStats(true)}>战绩 ▸</button>
      </div>

      <div className="expedition-route" aria-label="天机远征路线图">
        {Array.from({ length: 5 }, (_, depth) => {
          const row = s.expeditionNodes.filter(node => node.depth === depth)
          const open = depth === s.expeditionProgress
          return (
            <div className={'expedition-depth' + (open ? ' open' : '') + (depth < s.expeditionProgress ? ' passed' : '')} key={depth}>
              <div className="expedition-depth-label">{depth === 4 ? '终点首领' : `第 ${depth + 1} 层`}</div>
              <div className="expedition-depth-nodes">
                {row.map(node => {
                  const meta = KIND_META[node.kind]
                  const isSelected = selected?.id === node.id
                  const nodeOpen = node.depth === s.expeditionProgress && !node.resolved
                  return (
                    <button
                      className={'expedition-node ' + node.kind + (isSelected ? ' selected' : '') + (node.resolved ? ' resolved' : '') + (nodeOpen ? ' available' : '')}
                      data-tut={nodeOpen && node.branch === 0 ? 'expedition-node' : undefined}
                      key={node.id}
                      disabled={!nodeOpen}
                      onClick={() => selectNode(node.id)}
                    >
                      <span className="expedition-node-icon">{node.resolved ? '✓' : meta.icon}</span>
                      <b>{meta.label}</b>
                      <small>{node.resolved ? '已完成' : node.branch === 0 ? '左路' : '右路'}</small>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {report ? (
        <section className="expedition-report-wrap expedition-report-focus">
          {(report.kind === 'battle' || report.kind === 'boss') && (
            <ExpeditionBattleScene report={report} onComplete={() => setSceneDone(true)} />
          )}
          {((report.kind !== 'battle' && report.kind !== 'boss') || sceneDone) && (
            <ExpeditionResult report={report} onClose={() => setReport(null)} />
          )}
        </section>
      ) : selected ? (
        <section className="expedition-command">
          <div className="expedition-command-head">
            <div>
              <span className={'expedition-kind ' + selected.kind}>{KIND_META[selected.kind].icon} {KIND_META[selected.kind].label}</span>
              <b>{selected.title}</b>
              <small>{selected.desc}</small>
            </div>
            {selected.enemyPower > 0 && <span className="expedition-enemy-power">敌阵 {fmt(selected.enemyPower)}</span>}
          </div>

          <div className="expedition-node-explain">
            <b>这个节点做什么</b>
            <span>{nodePurpose(selected.kind)}</span>
          </div>

          {selected.enemyPower > 0 && (
            <div className="expedition-threat">
              <span>敌方 {TROOP_MAP[selected.enemyTroop].name}</span>
            <span>当前编队 {fmt(s.derived.battlePowerByEnemy[selected.enemyTroop] ?? 0)}</span>
            </div>
          )}

          {(selected.kind === 'battle' || selected.kind === 'boss') && <Formation enemyTroop={selected.enemyTroop} />}

          <div className="expedition-choice">
            <button className={'expedition-choice-btn' + (choice === 'steady' ? ' active' : '')} onClick={() => setChoice('steady')}>
              <b>稳妥推进</b><small>成功推进 · 奖励 ×1 · 兵损较低</small>
            </button>
            <button className={'expedition-choice-btn risk' + (choice === 'risk' ? ' active' : '')} onClick={() => setChoice('risk')}>
              <b>压榨路线</b><small>成功奖励 ×1.35 · 失败不推进</small>
            </button>
          </div>

          <button className="btn-main expedition-enter" data-tut="expedition-enter" onClick={doExplore} disabled={s.expeditionEnergy <= 0}>
            消耗 1 枚远征令 · {KIND_META[selected.kind].label}
          </button>
          <div className="hint">{hint}</div>
        </section>
      ) : (
        <div className="expedition-complete">
          <div className="expedition-complete-rune">✦</div>
          <b>{s.expeditionProgress >= 5 ? '今日首领已平定' : '路线等待开启'}</b>
          <span>{s.expeditionProgress >= 5 ? '明日换图，或前往商店使用远征币。' : '选择当前层的一条路线继续深入。'}</span>
        </div>
      )}

      {showStats && (
        <Sheet title="远征战绩" sub="里程碑 · 商店 · 遗物" onClose={() => setShowStats(false)}>
          <div className="expedition-longterm">
            <div className="section-title">本周里程碑 · {s.expeditionWeekScore} 分</div>
            {EXPEDITION_WEEKLY_REWARDS.map(item => (
              <MilestoneRow
                key={item.id}
                name={item.name}
                need={item.need}
                current={s.expeditionWeekScore}
                claimed={s.expeditionWeeklyClaimed.includes(item.id)}
                onClaim={async () => { const result = await claimWeekly(item.id); setHint(result.ok ? `已领取「${item.name}」` : result.reason ?? '') }}
              />
            ))}

            <div className="section-title">28 天游历 · {s.expeditionScore} 分</div>
            {nextSeason && <div className="expedition-next-reward">下一档：{nextSeason.name} · 还需 {Math.max(0, nextSeason.need - s.expeditionScore)} 分</div>}
            {EXPEDITION_SEASON_REWARDS.map(item => (
              <MilestoneRow
                key={item.id}
                name={item.name + (item.relic ? ' · 遗物' : '')}
                need={item.need}
                current={s.expeditionScore}
                claimed={s.expeditionSeasonRewards.includes(item.id)}
                onClaim={async () => { const result = await claimSeason(item.id); setHint(result.ok ? `已领取「${item.name}」` : result.reason ?? '') }}
              />
            ))}

            <div className="section-title">远征商店 · {s.expeditionCurrency} 远征币</div>
            <div className="expedition-shop">
              {EXPEDITION_SHOP.map(item => {
                const bought = s.expeditionShopPurchases[item.id] ?? 0
                const capped = bought >= item.maxPurchases
                return (
                  <div className="expedition-shop-row" key={item.id}>
                    <div>
                      <b>{item.name}</b>
                      <small>{item.desc}</small>
                      <em>{item.cost} 远征币 · {bought}/{item.maxPurchases}</em>
                    </div>
                    <button className="btn-sub" disabled={capped} onClick={async () => { const result = await buyShop(item.id); setHint(result.ok ? `已兑换「${item.name}」` : result.reason ?? '') }}>
                      {capped ? '已满' : '兑换'}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="expedition-relics">
              <span>遗物</span>
              <b>星图 {s.expeditionRelics.starMap}/3</b>
              <b>战旗 {s.expeditionRelics.ironBanner}/3</b>
              <b>香炉 {s.expeditionRelics.spiritCenser}/3</b>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function MilestoneRow({ name, need, current, claimed, onClaim }: {
  name: string
  need: number
  current: number
  claimed: boolean
  onClaim: () => void
}) {
  return (
    <div className="expedition-milestone">
      <div className="expedition-milestone-copy">
        <b>{name}</b>
        <small>{Math.min(need, current)} / {need}</small>
        <div className="progress"><i style={{ width: `${Math.min(100, current / need * 100)}%` }} /></div>
      </div>
      <button className="btn-sub" disabled={claimed || current < need} onClick={onClaim}>{claimed ? '已领' : '领取'}</button>
    </div>
  )
}

function ExpeditionResult({ report, onClose }: { report: ExpeditionReport; onClose?: () => void }) {
  return (
    <div className="expedition-result">
      <div className={'expedition-result-mark ' + (report.win ? 'win' : 'lose')}>{report.win ? '✦' : '↩'}</div>
      <b>{report.outcome}</b>
      <small>{report.choice === 'risk' ? '压榨路线' : '稳妥推进'} · 积分 +{report.scoreGained} · 远征币 +{report.currencyGained}</small>
      <small className={report.progressed ? 'expedition-progress-note' : 'expedition-failure-penalty'}>{report.progressed ? '路线已推进 1 层，下一层节点已开启。' : '路线未推进，当前节点保留，可补兵后再次挑战。'}</small>
      <small className={report.win ? 'expedition-penalty' : 'expedition-failure-penalty'}>{report.win ? '本次代价：' : '失败惩罚：'}{report.penalty}</small>
      {report.losses > 0 && <small className="expedition-loss">兵损 {report.losses}</small>}
      <div className="cost-row expedition-gains">
        {(Object.keys(report.gained) as ResourceKey[]).filter(key => (report.gained[key] ?? 0) > 0).map(key => (
          <span className="cost" key={key}><img src={sprite(RESOURCE_META[key].icon)} alt="" />+{fmt(report.gained[key] ?? 0)}</span>
        ))}
      </div>
      {onClose && <button className="btn-sub" onClick={onClose}>返回路线</button>}
    </div>
  )
}

function nodePurpose(kind: ExpeditionNodeKind): string {
  return ({
    battle: '战斗节点，验证当前编队；胜利给积分和资源，失败会损兵并停在本层。',
    gather: '采集节点，低风险拿资源；压榨路线可能多拿，但失败会消耗远征令。',
    caravan: '护送节点，中风险拿资源与积分；适合想稳定完成路线的玩家。',
    event: '天机节点，选择稳妥或压榨来换取不同收益；压榨失败不会推进。',
    boss: '路线终点首领，收益最高；先补兵、看克制，再决定是否压榨。',
  })[kind]
}
