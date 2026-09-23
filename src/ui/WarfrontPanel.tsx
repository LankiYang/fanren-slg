import { useCallback, useEffect, useState } from 'react'
import { RESOURCE_META, TROOPS, TROOP_MAP } from '../game/data'
import type { ResourceKey, TroopKey, WarfrontTactic } from '../game/types'
import { useGame } from '../game/store'
import { WARFRONT_NODE_MAP, WARFRONT_NODES, WARFRONT_TACTICS } from '../game/warfront'
import type { OnlineNodeState, WarfrontPreview } from '../online/contracts'
import { useOnline } from '../online/onlineStore'
import { WarfrontBattleScene } from './WarfrontBattleScene'
import { FriendPanel } from './FriendPanel'
import { ChatPanel } from './ChatPanel'
import { WarfrontMap } from './WarfrontMap'
import { Sheet } from './Sheet'
import { fmt, fmtTime, sprite } from './util'
import { clearSessionToken } from '../online/api'

const EMPTY_FORMATION: Record<TroopKey, number> = { kuilei: 0, yushou: 0, fuxiu: 0 }

export function WarfrontPanel({ now }: { now: number }) {
  const online = useOnline()
  const markGuideFlag = useGame(x => x.markGuideFlag)
  const maybeStartIntro = useGame(x => x.maybeStartIntro)
  const [selectedKey, setSelectedKey] = useState(WARFRONT_NODES[0].key)
  const [tactic, setTactic] = useState<WarfrontTactic>('raid')
  const [formation, setFormation] = useState<Record<TroopKey, number>>(EMPTY_FORMATION)
  const [preview, setPreview] = useState<WarfrontPreview | null>(null)
  const [working, setWorking] = useState(false)
  const [sectName, setSectName] = useState('')
  const [garrisonDraft, setGarrisonDraft] = useState<Record<TroopKey, number>>(EMPTY_FORMATION)
  const [showFriends, setShowFriends] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [commandCollapsed, setCommandCollapsed] = useState(true)
  const [showRename, setShowRename] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [showAccount, setShowAccount] = useState(false)

  useEffect(() => {
    void online.connect()
    const id = window.setInterval(() => void useOnline.getState().refresh(true), 900)
    return () => window.clearInterval(id)
  }, [])

  const snapshot = online.snapshot
  const selected = WARFRONT_NODE_MAP[selectedKey]
  const selectedState = snapshot?.nodes.find(node => node.key === selectedKey)
  const mySectId = snapshot?.player.sectId
  const owned = snapshot?.nodes.filter(node => node.ownerSectId === mySectId).length ?? 0
  const ownArmy = snapshot?.armies?.find(army => army.isMine)
  const cooldown = snapshot ? Math.max(0, snapshot.player.cooldownUntil - now) : 0
  const deployed = preview?.deployed ?? sum(formation)
  const myPower = preview?.myPower ?? 0
  const friendly = Boolean(selectedState?.ownerSectId && selectedState.ownerSectId === mySectId)

  useEffect(() => {
    if (snapshot && !showRename) setNameDraft(snapshot.player.name)
  }, [showRename, snapshot?.player.name])

  useEffect(() => {
    if (!snapshot || !selectedState) return
    let disposed = false
    const timer = window.setTimeout(() => {
      void useOnline.getState().preview(selectedKey, tactic, formation).then(next => {
        if (disposed || !next) return
        setPreview(next)
        if (sum(formation) === 0) setFormation(next.recommendedFormation)
      })
    }, 80)
    return () => { disposed = true; window.clearTimeout(timer) }
  }, [snapshot?.player.id, snapshot?.player.troops.kuilei, snapshot?.player.troops.yushou, snapshot?.player.troops.fuxiu, selectedKey, selectedState?.guardTroop, tactic, formation.kuilei, formation.yushou, formation.fuxiu])

  useEffect(() => {
    setGarrisonDraft(EMPTY_FORMATION)
  }, [selectedKey])

  useEffect(() => { if (snapshot) maybeStartIntro('warfront') }, [Boolean(snapshot), maybeStartIntro])

  const selectNode = (key: string) => {
    setSelectedKey(key)
    setCommandCollapsed(false)
    setFormation(EMPTY_FORMATION)
    setPreview(null)
  }

  const closeReport = useCallback(() => online.clearReport(), [online.clearReport])

  if (!snapshot && (online.status === 'idle' || online.status === 'connecting')) return <ConnectionState title="正在连接苍梧战区…" />
  if (!snapshot || online.status === 'offline') {
    return <ConnectionState title="多人服务器暂时不可达" detail={online.error} action="重新连接" onAction={() => void online.connect()} />
  }

  const marchDisabled = Boolean(working || ownArmy || friendly || deployed <= 0 || cooldown > 0 || snapshot.player.warEnergy <= 0)
  return (
    <div className="warfront-panel">
      <div className="online-identity">
        <span className="online-dot" />
        <div className="online-identity-copy">
          <div className="online-name-line"><b>{snapshot.player.name}</b><button className="identity-name-edit" type="button" onClick={() => setShowRename(value => !value)}>{showRename ? '取消' : '改名'}</button></div>
          <small>{snapshot.player.sectName} · 战力 {fmt(snapshot.player.battlePower)} · 在线共享战区</small>
          {showRename && <form className="online-rename-row" onSubmit={async event => {
            event.preventDefault()
            const renamed = await online.rename(nameDraft)
            if (renamed) setShowRename(false)
          }}>
            <input aria-label="修士名" value={nameDraft} onChange={event => setNameDraft(event.target.value)} minLength={2} maxLength={12} placeholder="2—12 个字符" autoFocus />
            <button className="btn-sub" type="submit" disabled={nameDraft.trim().length < 2}>确认</button>
          </form>}
        </div>
        <div className="online-identity-actions"><button className="btn-sub" data-tut="warfront-details" onClick={() => setShowDetails(true)}>排行榜</button><button className="btn-sub" data-tut="warfront-friends" onClick={() => setShowFriends(value => !value)}>好友{snapshot.friendRequests.filter(request => request.direction === 'incoming').length > 0 && <i>{snapshot.friendRequests.filter(request => request.direction === 'incoming').length}</i>}</button><button className="identity-reset" type="button" onClick={() => setShowAccount(true)} title="切换账号">账号</button></div>
      </div>

      <div className="warfront-heading">
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>{snapshot.seasonName}</div>
          <div className="warfront-summary">宗门占领 {owned}/{WARFRONT_NODES.length} · 个人战功 {fmt(snapshot.player.score)}</div>
          <div className="warfront-frontline" role="img" aria-label={`战线概览：我方占领 ${owned} 处，共 ${WARFRONT_NODES.length} 处据点`}>
            {snapshot.nodes.map(node => (
              <i key={node.key} className={node.ownerSectId ? (node.ownerSectId === mySectId ? 'mine' : 'rival') : 'neutral'} />
            ))}
          </div>
        </div>
        <div className="warfront-season">地图战争</div>
      </div>

      <WarfrontMap snapshot={snapshot} selectedKey={selectedKey} now={now} onSelect={selectNode} command={
        <div className={'warfront-command-bar' + (commandCollapsed ? ' collapsed' : '')}>
          <div className="warfront-command-heading">
            <div><span className="warfront-command-kicker">地图命令 · 已选据点</span><b>{selected.name}</b><small>{ownerLabel(selectedState!, mySectId)} · 守军 {fmt(selectedState!.garrisonTotal)} · 防守战力 {fmt(selectedState!.guardPower)}</small></div>
            <div className="warfront-command-tools">
              <div className="warfront-command-energy">
                <span>战争令</span>
                <span className="warfront-energy-pips">
                  {Array.from({ length: snapshot.player.warEnergyMax }, (_, i) => (
                    <i key={i} className={i < snapshot.player.warEnergy ? 'on' : ''} />
                  ))}
                </span>
              </div>
              <button className="warfront-command-toggle" type="button" aria-expanded={!commandCollapsed} onClick={() => setCommandCollapsed(value => !value)}>{commandCollapsed ? '展开指挥' : '收起'}</button>
            </div>
          </div>
          {friendly ? (
            <div className="warfront-command-summary warfront-command-garrison-summary">
              <div className="warfront-command-stat"><span>据点守军</span><b>{selectedState!.garrisonTotal}</b><small>/ 360 人</small></div>
              <div className="warfront-command-stat"><span>我的援军</span><b>{sum(selectedState!.garrisonByMe)}</b><small>已驻防</small></div>
              <div className="warfront-command-garrison-callout">分配援军，提升守军强度，守住据点持续收益。</div>
            </div>
          ) : (
            <div className="warfront-command-summary">
              <div className="warfront-command-stat"><span>出战</span><b>{deployed}</b><small>/ {snapshot.player.marchCap} 人</small></div>
              <div className="warfront-command-stat"><span>预计战力</span><b style={{ color: preview?.win ? 'var(--ok)' : 'var(--danger)' }}>{fmt(myPower)}</b><small>守军 {fmt(selectedState!.guardPower)}</small></div>
              <button className="btn-main warfront-march-button" disabled={marchDisabled} onClick={async () => {
                setWorking(true)
                try {
                  const marched = await online.march(selectedKey, tactic, formation)
                  if (marched) markGuideFlag('warfront-march')
                } finally { setWorking(false) }
              }}>
                {working ? '派出中…' : ownArmy ? '行军中…' : '派出行军'}
              </button>
            </div>
          )}
          {!commandCollapsed && <>
            {friendly ? <GarrisonPanel node={selectedState!} troops={snapshot.player.troops} draft={garrisonDraft} onDraftChange={setGarrisonDraft} /> : <>
              <div className="cost-row warfront-yield">{(Object.keys(selected.income) as ResourceKey[]).map(key => <span className="cost" key={key}><img src={sprite(RESOURCE_META[key].icon)} alt="" />+{selected.income[key]!.toFixed(2)}/s</span>)}</div>
              <div className="warfront-tactics" role="group" aria-label="行军策略">
                {(Object.keys(WARFRONT_TACTICS) as WarfrontTactic[]).map(key => <button key={key} className={`warfront-tactic${tactic === key ? ' selected' : ''}`} onClick={() => setTactic(key)}><span>{WARFRONT_TACTICS[key].name}</span><small>{WARFRONT_TACTICS[key].desc}</small></button>)}
              </div>
              <div className="progress"><i style={{ width: `${preview?.powerPercent ?? 0}%`, background: preview?.win ? 'var(--ok)' : 'var(--danger)' }} /></div>
              {ownArmy && <div className="blocker">已有部队行军至 {WARFRONT_NODE_MAP[ownArmy.destinationKey ?? '']?.name ?? '目标据点'}，所有玩家都能看到军队移动。</div>}
              {cooldown > 0 && !ownArmy && <div className="blocker">服务端整备冷却 · {fmtTime(cooldown)} 后可再次下令。</div>}
              <OnlineFormation enemyTroop={selectedState!.guardTroop} troops={snapshot.player.troops} formation={formation} marchCap={snapshot.player.marchCap} recommended={preview?.recommendedFormation ?? EMPTY_FORMATION} onChange={setFormation} />
            </>}
            {online.error && <div className="blocker danger">{online.error}</div>}
          </>}
        </div>
      } />
      {showAccount && <div className="account-switch-layer" role="dialog" aria-modal="true" aria-label="账号切换"><div className="account-switch-panel"><div className="account-switch-head"><div><b>账号管理</b><small>当前修士 · {snapshot.player.name}</small></div><button className="battle-skip" type="button" onClick={() => setShowAccount(false)}>关闭</button></div><p>切换账号不会删除当前修士数据。退出后可以登录其他账号，或注册新的修士。</p><div className="account-switch-actions"><button className="btn-main" type="button" onClick={() => { clearSessionToken(); window.location.reload() }}>退出并切换账号</button><button className="btn-sub" type="button" onClick={() => setShowAccount(false)}>继续游戏</button></div></div></div>}

      {showFriends && (
        <Sheet title="好友" sub={`共 ${snapshot.friends.length} 位`} onClose={() => setShowFriends(false)}>
          <FriendPanel snapshot={snapshot} />
        </Sheet>
      )}

      <ChatPanel />

      {online.lastReport && (
        <div className="warfront-battle-drawer">
          <div className="warfront-battle-drawer-title"><span>据点交战 · {online.lastReport.nodeName}</span><button className="battle-skip" onClick={closeReport}>收起战报</button></div>
          <WarfrontBattleScene report={online.lastReport} onComplete={() => undefined} />
          <div className="warfront-report-lines"><div>{online.lastReport.attackerName} 对阵 {online.lastReport.defenderName}</div><div>{online.lastReport.win ? '据点归属已同步到共享地图。' : '守军守住了据点，部队已折返。'}</div><div>兵损 <b>{online.lastReport.losses}</b> · 战功 <b>+{online.lastReport.scoreGained}</b></div></div>
        </div>
      )}

      {showDetails && (
        <Sheet title="战区排行榜" sub="征募 · 宗门榜 · 个人榜 · 战报" onClose={() => setShowDetails(false)}>
          <div className="season-recruit"><span>兵损由服务端记录，征募用于补充赛季军团。</span><button className="btn-sub" disabled={now < snapshot.player.recruitReadyAt} onClick={() => void online.recruit()}>{now < snapshot.player.recruitReadyAt ? `${fmtTime(snapshot.player.recruitReadyAt - now)} 后征募` : '征募援军 +72'}</button></div>
          <Leaderboard title="宗门榜" rows={snapshot.sectLeaderboard} />
          <Leaderboard title="个人榜" rows={snapshot.playerLeaderboard} />
          <SectManagement snapshot={snapshot} sectName={sectName} onNameChange={setSectName} />
          <div className="section-title">战报记录</div>
          <div className="online-reports">{snapshot.reports.length === 0 && <div className="card-meta">地图还没有交战记录。</div>}{snapshot.reports.slice(0, 5).map(report => report.kind === 'garrisonLoss'
            ? <div key={report.id}><b>据点失守</b> {report.attackerName} 攻破 {report.nodeName}<em>你的援军阵亡 {report.losses} 人</em></div>
            : <div key={report.id}><b>{report.attackerName}</b> {report.win ? '击破' : '败于'} {report.defenderName}<em>{report.nodeName} · +{report.scoreGained}</em></div>)}</div>
        </Sheet>
      )}
    </div>
  )
}

function OnlineFormation({ enemyTroop, troops, formation, marchCap, recommended, onChange }: { enemyTroop: TroopKey; troops: Record<TroopKey, number>; formation: Record<TroopKey, number>; marchCap: number; recommended: Record<TroopKey, number>; onChange: (next: Record<TroopKey, number>) => void }) {
  const used = sum(formation)
  const [expanded, setExpanded] = useState(false)
  const apply = (key: TroopKey, value: number) => { const others = used - formation[key]; const max = Math.min(troops[key], marchCap - others); onChange({ ...formation, [key]: Math.max(0, Math.min(value, max)) }) }
  const explain: Record<TroopKey, string> = { kuilei: '重甲肉盾，适合守点与正面抗伤；克制御兽。', yushou: '机动突击，适合奇袭与追击；克制符修。', fuxiu: '远程压制，适合先手集火；克制傀儡。' }
  const enemyName = TROOPS.find(item => item.key === enemyTroop)?.name ?? '守军'
  return <div className={'warfront-formation' + (expanded ? ' expanded' : '')}><button className="formation-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span>{expanded ? '▾' : '▸'} 编队配置 · {used}/{marchCap}</span><span className="btn-sub" role="presentation" onClick={event => { event.stopPropagation(); onChange(recommended) }}>一键择优</span></button>{expanded && <div className="formation-content"><div className="formation-guide">当前守军：<b>{enemyName}</b>。优先使用克制兵种，能提高有效战力；被克兵种只适合补足兵力。</div>{TROOPS.map(t => { const counters = TROOP_MAP[t.key].counters === enemyTroop; const countered = TROOP_MAP[enemyTroop].counters === t.key; const max = Math.min(troops[t.key], formation[t.key] + Math.max(0, marchCap - used)); return <div className="card online-troop" key={t.key}><img className="thumb" src={sprite(t.sprite)} alt={t.name} /><div className="card-body"><div className="card-name">{t.name}{counters && <span className="tag-counter good">克制</span>}{countered && <span className="tag-counter bad">被克</span>}</div><div className="card-meta">{explain[t.key]}</div><div className="card-meta">出战 {formation[t.key]} / 兵力 {troops[t.key]} · {counters ? '有效战力提升' : countered ? '有效战力下降' : '正常战力'}</div><input className="slider" type="range" min={0} max={Math.max(1, max)} value={formation[t.key]} onChange={event => apply(t.key, Number(event.target.value))} /></div></div> })}</div>}</div>
}

function GarrisonPanel({ node, troops, draft, onDraftChange }: { node: OnlineNodeState; troops: Record<TroopKey, number>; draft: Record<TroopKey, number>; onDraftChange: (next: Record<TroopKey, number>) => void }) {
  const markGuideFlag = useGame(x => x.markGuideFlag)
  const garrison = useOnline(x => x.garrison); const withdraw = useOnline(x => x.withdraw); const error = useOnline(x => x.error); const [working, setWorking] = useState(false)
  if (!node.ownerSectId) return <div className="garrison-hint" data-tut="garrison-panel">夺下据点后可派遣宗门援军，驻军会成为其他玩家看到的真实守军。</div>
  const used = sum(draft); const room = Math.max(0, 360 - node.garrisonTotal); const mine = node.garrisonByMe; const mineTotal = sum(mine)
  // 每格能加多少 = 总余量 - 其它兵种已占用的余量；曾经多算了当前兵种自己的旧值，
  // 导致滑块能拖到超出 360 上限，提交时被服务端拒绝却看不出哪里错了。
  const roomFor = (key: TroopKey) => Math.max(0, room - (used - draft[key]))
  const apply = (key: TroopKey, value: number) => { const max = Math.min(troops[key], roomFor(key)); onDraftChange({ ...draft, [key]: Math.max(0, Math.min(value, max)) }) }
  return <div className="garrison-panel" data-tut="garrison-panel"><div className="garrison-head"><div><b>宗门驻防</b><small>据点守军 {node.garrisonTotal}/360 · 防守战力 {fmt(node.garrisonPower)}</small></div><span>我的援军 {mineTotal}</span></div>{TROOPS.map(t => <div className="garrison-row" key={t.key}><span>{t.name}</span><b>{draft[t.key]}</b><input className="slider" type="range" min={0} max={Math.max(1, Math.min(troops[t.key], roomFor(t.key)))} value={draft[t.key]} onChange={event => apply(t.key, Number(event.target.value))} /><span className="garrison-stepper"><button className="garrison-step" type="button" disabled={draft[t.key] <= 0} onClick={() => apply(t.key, draft[t.key] - 12)}>-</button><button className="garrison-step" type="button" disabled={roomFor(t.key) <= 0} onClick={() => apply(t.key, draft[t.key] + 12)}>+</button></span></div>)}<div className="garrison-actions"><button className="btn-sub" data-tut="garrison-send" disabled={working || used <= 0 || used > room} onClick={async () => { setWorking(true); const ok = await garrison(node.key, draft); setWorking(false); if (ok) { markGuideFlag('warfront-garrison'); onDraftChange({ ...EMPTY_FORMATION }) } }}>派遣援军</button><button className="btn-sub" disabled={working || mineTotal <= 0} onClick={async () => { setWorking(true); await withdraw(node.key, mine); setWorking(false) }}>撤回援军</button></div>{error && <div className="sect-error">{error}</div>}</div>
}

function Leaderboard({ title, rows }: { title: string; rows: { id: string; rank: number; name: string; score: number; isMine?: boolean }[] }) { return <><div className="section-title">{title}</div><div className="warfront-rank">{rows.slice(0, 5).map(row => <div className={row.isMine ? 'me' : ''} key={row.id}><span>{row.rank}</span><b>{row.name}{row.isMine ? '（我）' : ''}</b><em>{fmt(row.score)}</em></div>)}</div></> }

function SectManagement({ snapshot, sectName, onNameChange }: { snapshot: NonNullable<ReturnType<typeof useOnline.getState>['snapshot']>; sectName: string; onNameChange: (name: string) => void }) {
  const createSect = useOnline(x => x.createSect); const joinSect = useOnline(x => x.joinSect); const error = useOnline(x => x.error); const [working, setWorking] = useState(false); const otherSects = snapshot.sectLeaderboard.filter(row => row.id !== snapshot.player.sectId)
  return <><div className="section-title">宗门协同</div><div className="sect-management"><div className="sect-management-current"><b>{snapshot.player.sectName}</b><span>同宗玩家共享据点归属，互相不可攻击。</span></div><div className="sect-create-row"><input aria-label="新宗门名称" maxLength={12} placeholder="创建新宗门（2—12字）" value={sectName} onChange={event => onNameChange(event.target.value)} /><button className="btn-sub" disabled={working || sectName.trim().length < 2} onClick={async () => { setWorking(true); await createSect(sectName); setWorking(false); onNameChange('') }}>创建</button></div>{otherSects.map(row => <div className="sect-row" key={row.id}><span><b>{row.name}</b><small>战功 {fmt(row.score)}</small></span><button className="btn-sub" disabled={working} onClick={async () => { setWorking(true); await joinSect(row.id); setWorking(false) }}>加入</button></div>)}{error && <div className="sect-error">{error}</div>}</div></>
}

function ConnectionState({ title, detail, action, onAction }: { title: string; detail?: string; action?: string; onAction?: () => void }) { return <div className="connection-state"><div className="connection-rune">◎</div><b>{title}</b>{detail && <span>{detail}</span>}{action && <button className="btn-main" onClick={onAction}>{action}</button>}</div> }
function ownerLabel(node: OnlineNodeState, mySectId?: string): string { if (!node.ownerSectId) return '秘境守军'; if (node.ownerSectId === mySectId) return `${node.ownerSectName} · 我方`; return `${node.ownerSectName} · 敌方玩家` }
function sum(value: Record<TroopKey, number>) { return value.kuilei + value.yushou + value.fuxiu }
