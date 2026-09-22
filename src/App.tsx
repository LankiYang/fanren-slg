import { useEffect, useState } from 'react'
import { REALMS, RESOURCE_META } from './game/data'
import type { BuildingKey, ResourceKey } from './game/types'
import { useGame } from './game/store'
import { TopBar } from './ui/TopBar'
import { Scene } from './ui/Scene'
import { Sheet, Cost } from './ui/Sheet'
import { BuildingPanel } from './ui/BuildingPanel'
import { WarfrontPanel } from './ui/WarfrontPanel'
import { SectPanel } from './ui/SectPanel'
import { PracticePanel } from './ui/PracticePanel'
import { OfflineSheet } from './ui/OfflineSheet'
import { QuestPanel } from './ui/QuestPanel'
import { JourneyGuide } from './ui/JourneyGuide'
import { Tutorial } from './ui/Tutorial'
import { BreakthroughCeremony } from './ui/BreakthroughCeremony'
import type { GuideRoute } from './game/guide'
import type { PracticeSection } from './game/guide'
import { sprite, fmt } from './ui/util'
import { CharacterSelect } from './ui/CharacterSelect'
import { SeekPanel } from './ui/SeekPanel'
import { cultivationRequirement } from './game/seek'

type Tab = 'home' | 'practice' | 'warfront' | 'sect'

export default function App() {
  const tick = useGame(x => x.tick)
  const refreshExpedition = useGame(x => x.refreshExpedition)
  const breakthrough = useGame(x => x.breakthrough)
  const offlineReport = useGame(x => x.offlineReport)
  const clearOfflineReport = useGame(x => x.clearOfflineReport)
  const [now, setNow] = useState(Date.now())
  const [tab, setTab] = useState<Tab>('home')
  const [practiceSection, setPracticeSection] = useState<PracticeSection>('army')
  const [picked, setPicked] = useState<BuildingKey | null>(null)
  const [showBreak, setShowBreak] = useState(false)
  const [showQuests, setShowQuests] = useState(false)
  const [ceremonyRealm, setCeremonyRealm] = useState<string | null>(null)
  const goToGuideRoute = (route: GuideRoute) => {
    const launchGuide = () => {
      if (route.guideId) useGame.getState().startGuide(route.guideId)
    }
    setShowQuests(false)
    setPicked(null)
    setShowBreak(false)
    if (route.kind === 'home') {
      setTab('home')
      if (route.building) setPicked(route.building)
      if (route.focus === 'seek') {
        window.setTimeout(() => document.querySelector('.seek-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      }
      window.setTimeout(launchGuide, 80)
      return
    }
    if (route.kind === 'practice') {
      setPracticeSection(route.section)
      setTab('practice')
      window.setTimeout(launchGuide, 80)
      return
    }
    setTab(route.kind)
    window.setTimeout(launchGuide, 80)
  }

  // 主循环：每 500ms 结算一次产出与升级完成
  useEffect(() => {
    tick()
    refreshExpedition()
    const id = setInterval(() => { tick(); refreshExpedition(); setNow(Date.now()) }, 500)
    return () => clearInterval(id)
  }, [refreshExpedition, tick])

  return (
    <div className="app">
      <TopBar onBreakthrough={() => setShowBreak(true)} />

      <div className="scene-wrap">
        {tab === 'warfront' ? (
          // 战区是玩家投入最重的系统，给它整屏空间而不是挤在 72% 高的弹层里。
          <WarfrontPanel now={now} />
        ) : (
          <>
            <Scene now={now} onPick={k => setPicked(k)} />

            <SeekPanel />

            <JourneyGuide now={now} onOpen={() => setShowQuests(true)} onGo={goToGuideRoute} />
          </>
        )}
      </div>

      <div className="tabbar">
        {([
          ['home', 'ui/tab-home.webp', '洞府'],
          ['practice', 'ui/tab-army.webp', '历练'],
          ['warfront', 'ui/tab-stage.webp', '战区'],
          ['sect', 'ui/tab-sect.webp', '宗门'],
        ] as [Tab, string, string][]).map(([k, ico, label]) => (
          <button
            key={k}
            className={'tab' + (tab === k ? ' on' : '')}
            onClick={() => {
              // 底部导航切换时关闭建筑详情，避免多个 sheet 叠加遮挡目标页面。
              setPicked(null)
              setTab(k)
            }}
          >
            <img className="tab-ico" src={sprite(ico)} alt="" />
            {label}
          </button>
        ))}
      </div>

      {picked && (
        <BuildingPanel bkey={picked} now={now} onClose={() => setPicked(null)} />
      )}

      {tab === 'practice' && (
        <Sheet title="历练" sub="演武 · 秘境 · 远征 · 修士" onClose={() => setTab('home')}><PracticePanel now={now} initialTab={practiceSection} /></Sheet>
      )}
      {tab === 'sect' && (
        <Sheet title="宗门" onClose={() => setTab('home')}><SectPanel now={now} /></Sheet>
      )}

      {showQuests && (
        <Sheet title="道途指南" sub="当前目标 · 阶段路线 · 30 日节奏" onClose={() => setShowQuests(false)}><QuestPanel onGo={goToGuideRoute} /></Sheet>
      )}

      {showBreak && (
        <BreakthroughSheet
          onClose={() => setShowBreak(false)}
          onDo={breakthrough}
          onSuccess={setCeremonyRealm}
        />
      )}

      {/* 突破仪式盖在最顶层，比引导还高——它是一次性的高光时刻，不该被任何东西打断 */}
      {ceremonyRealm && (
        <BreakthroughCeremony realmName={ceremonyRealm} onDone={() => setCeremonyRealm(null)} />
      )}

      {/* 回流弹窗优先级最高，盖在其他面板之上 */}
      {offlineReport && (
        <OfflineSheet report={offlineReport} onClose={clearOfflineReport} />
      )}

      {/* 新手引导盖在最上层（跳过按钮在组件内部，需跟随对话框翻转） */}
      <Tutorial />
      <CharacterSelect />
    </div>
  )
}

function BreakthroughSheet({ onClose, onDo, onSuccess }: {
  onClose: () => void
  onDo: () => { ok: boolean; reason?: string }
  onSuccess: (realmName: string) => void
}) {
  const s = useGame()
  const [hint, setHint] = useState('')
  const cur = REALMS[Math.min(s.realm, REALMS.length - 1)]
  const next = REALMS[s.realm + 1]
  const insightNeed = cultivationRequirement(s.realm)

  return (
    <Sheet title="境界突破" sub={cur.name} onClose={onClose}>
      {!next ? (
        <div className="sheet-desc">已抵达当前版本的最高境界。</div>
      ) : (
        <>
          <div className="sheet-desc">
            突破至 <b style={{ color: 'var(--gold)' }}>{next.name}</b>
            <br />
            全局产出 ×{cur.outputBonus.toFixed(2)} → ×{next.outputBonus.toFixed(2)}
            <br />
            全军战力 ×{cur.powerBonus.toFixed(2)} → ×{next.powerBonus.toFixed(2)}
          </div>

          <div className="section-title">
            前置：洞府 {next.requiresDongfu} 级
            <span style={{
              color: s.buildings.dongfu.level >= next.requiresDongfu ? 'var(--ok)' : 'var(--danger)',
            }}>
              （当前 {s.buildings.dongfu.level}）
            </span>
          </div>

          <div className="section-title">消耗</div>
          <Cost cost={next.cost} have={s.resources} />
          <div className="breakthrough-insight">
            <span>寻道修为</span>
            <b className={s.seek.cultivation >= insightNeed ? 'ok' : 'lack'}>
              {fmt(s.seek.cultivation)} / {fmt(insightNeed)}
            </b>
          </div>

          <button
            className="btn-main"
            onClick={() => {
              const r = onDo()
              if (r.ok) { onSuccess(next.name); onClose() }
              else setHint(r.reason ?? '无法突破')
            }}
          >
            突破
          </button>
          <div className="hint">{hint}</div>

          <div className="section-title">当前储备</div>
          <div className="cost-row">
            {(Object.keys(RESOURCE_META) as ResourceKey[]).map(k => (
              <span className="cost" key={k}>
                <img src={sprite(RESOURCE_META[k].icon)} alt="" />
                {fmt(s.resources[k])}
              </span>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
