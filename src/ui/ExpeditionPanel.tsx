import { useEffect, useMemo, useState } from 'react'
import { EXPEDITION_SEASON_REWARDS, EXPEDITION_SHOP, EXPEDITION_WEEKLY_REWARDS, expeditionTheme } from '../game/expedition'
import { RESOURCE_META, TROOP_MAP } from '../game/data'
import type { ExpeditionChoice, ExpeditionNodeKind, ExpeditionReport, ResourceKey } from '../game/types'
import { battlePower, useGame } from '../game/store'
import { Formation } from './Formation'
import { ExpeditionBattleScene } from './ExpeditionBattleScene'
import { fmt, fmtTime, sprite } from './util'

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
  const [selectedId, setSelectedId] = useState('')
  const [choice, setChoice] = useState<ExpeditionChoice>('steady')
  const [report, setReport] = useState<ExpeditionReport | null>(null)
  const [sceneDone, setSceneDone] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => { refresh() }, [refresh])

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

  const doExplore = () => {
    if (!selected) return
    const result = explore(selected.id, choice)
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
      <div className="expedition-heading">
        <div className="expedition-title-row">
          <img className="expedition-theme-art" src={sprite(theme.sprite)} alt="" />
          <div>
            <div className="expedition-title">{theme.name}</div>
            <div className="expedition-tagline">{theme.tagline}</div>
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

      {selected ? (
        <section className="expedition-command">
          <div className="expedition-command-head">
            <div>
              <span className={'expedition-kind ' + selected.kind}>{KIND_META[selected.kind].icon} {KIND_META[selected.kind].label}</span>
              <b>{selected.title}</b>
              <small>{selected.desc}</small>
            </div>
            {selected.enemyPower > 0 && <span className="expedition-enemy-power">敌阵 {fmt(selected.enemyPower)}</span>}
          </div>

          {selected.enemyPower > 0 && (
            <div className="expedition-threat">
              <span>敌方 {TROOP_MAP[selected.enemyTroop].name}</span>
              <span>当前编队 {fmt(battlePower(s, selected.enemyTroop, now))}</span>
            </div>
          )}

          {(selected.kind === 'battle' || selected.kind === 'boss') && <Formation enemyTroop={selected.enemyTroop} />}

          <div className="expedition-choice">
            <button className={'expedition-choice-btn' + (choice === 'steady' ? ' active' : '')} onClick={() => setChoice('steady')}>
              <b>稳妥推进</b><small>奖励 ×1 · 兵损较低</small>
            </button>
            <button className={'expedition-choice-btn risk' + (choice === 'risk' ? ' active' : '')} onClick={() => setChoice('risk')}>
              <b>压榨路线</b><small>奖励 ×1.35 · 风险提高</small>
            </button>
          </div>

          <button className="btn-main expedition-enter" onClick={doExplore} disabled={s.expeditionEnergy <= 0}>
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

      {report && (
        <section className="expedition-report-wrap">
          {(report.kind === 'battle' || report.kind === 'boss') && (
            <ExpeditionBattleScene report={report} onComplete={() => setSceneDone(true)} />
          )}
          {((report.kind !== 'battle' && report.kind !== 'boss') || sceneDone) && (
            <ExpeditionResult report={report} onClose={() => setReport(null)} />
          )}
        </section>
      )}

      <div className="expedition-longterm">
        <div className="section-title">本周里程碑 · {s.expeditionWeekScore} 分</div>
        {EXPEDITION_WEEKLY_REWARDS.map(item => (
          <MilestoneRow
            key={item.id}
            name={item.name}
            need={item.need}
            current={s.expeditionWeekScore}
            claimed={s.expeditionWeeklyClaimed.includes(item.id)}
            onClaim={() => { const result = claimWeekly(item.id); setHint(result.ok ? `已领取「${item.name}」` : result.reason ?? '') }}
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
            onClaim={() => { const result = claimSeason(item.id); setHint(result.ok ? `已领取「${item.name}」` : result.reason ?? '') }}
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
                <button className="btn-sub" disabled={capped} onClick={() => { const result = buyShop(item.id); setHint(result.ok ? `已兑换「${item.name}」` : result.reason ?? '') }}>
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
