import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { webglAvailable } from './world/webgl'
import type { Relation } from './world/WarfrontWorld'

type Pt = { x: number; y: number }
/** 3D 沙盘可用时，覆盖层坐标需经镜头投影；否则直接用地图百分比 */
const ProjectCtx = createContext<((p: Pt) => Pt) | null>(null)
import { TROOP_MAP } from '../game/data'
import { WARFRONT_NODE_MAP, WARFRONT_NODES } from '../game/warfront'
import type { OnlineNodeState, WarfrontSnapshot } from '../online/contracts'
import { fmt, sprite } from './util'

interface WarfrontMapProps {
  snapshot: WarfrontSnapshot
  selectedKey: string
  now: number
  onSelect: (key: string) => void
  command?: ReactNode
}

export function WarfrontMap({ snapshot, selectedKey, now, onSelect, command }: WarfrontMapProps) {
  const nodeState = new Map(snapshot.nodes.map(node => [node.key, node]))
  const armies = snapshot.armies ?? []
  const ownArmy = armies.find(army => army.isMine)
  const destination = ownArmy ? WARFRONT_NODE_MAP[ownArmy.destinationKey ?? ''] : null
  const mapPosition = snapshot.player.mapPosition ?? { x: 50, y: 94 }
  const justCaptured = useCaptureFlash(snapshot.nodes)
  const world = useWarfrontWorld(snapshot, selectedKey)
  const pointStyle = (p: Pt) => toStyle(world.project ? world.project(p) : p)

  return (
    <ProjectCtx.Provider value={world.project}>
    <section className={'warfront-map-shell' + (world.mode === '3d' ? ' warfront-3d' + (world.ready ? ' ready' : '') : '')} aria-label="苍梧秘境共享战争地图">
      <div className="warfront-map-toolbar">
        <div>
          <span className="warfront-map-kicker">共享战争地图</span>
          <b>{snapshot.seasonName}</b>
        </div>
        <div className="warfront-map-live"><i /> {armies.length} 支行军 · {snapshot.friends.filter(friend => friend.online).length} 位好友在线</div>
      </div>
      <div className="warfront-map-stage">
        <div className="warfront-map-canvas">
          {world.mode === '3d'
            ? <canvas className="warfront-world" ref={world.canvasRef} aria-hidden="true" />
            : <img className="warfront-map-terrain" src={sprite('bg/warfront-map.svg')} alt="" aria-hidden="true" />}
          <div className="warfront-map-atmosphere" aria-hidden="true" />
          {world.mode === '2d' && <div className="warfront-map-grid" aria-hidden="true" />}
          {world.mode === '2d' && <svg className="warfront-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {WARFRONT_NODES.flatMap(node => node.connections
              .filter(key => node.key < key)
              .map(key => {
                const target = WARFRONT_NODE_MAP[key]
                return target ? <line key={`${node.key}-${key}`} x1={node.position.x} y1={node.position.y} x2={target.position.x} y2={target.position.y} /> : null
              }))}
          </svg>}
          {world.mode === '2d' && <div className="warfront-map-watermark" aria-hidden="true">苍梧</div>}
          <div className="warfront-map-compass" aria-hidden="true"><b>N</b><span>✦</span></div>

          <div className="warfront-player-position" style={pointStyle(mapPosition)} aria-label={`${snapshot.player.name}当前位置`}>
            <span className="warfront-position-pulse" />
            <span className="warfront-position-flag">◆</span>
          </div>

          {snapshot.friends.filter(friend => friend.online).map(friend => {
            const destination = friend.marchDestinationKey ? WARFRONT_NODE_MAP[friend.marchDestinationKey] : null
            return <div className="warfront-friend-position" key={friend.id} style={pointStyle(friend.mapPosition)} title={`${friend.name} · ${friend.sectName}`} aria-label={`${friend.name}，${friend.online ? '在线' : '离线'}${destination ? `，正在前往${destination.name}` : ''}`}>
              <span className="warfront-friend-pulse" />
              <span className="warfront-friend-glyph">◆</span>
              <span className="warfront-friend-label">{friend.name}</span>
              {destination && <small>→ {destination.name}</small>}
            </div>
          })}

          {WARFRONT_NODES.map(node => {
            const state = nodeState.get(node.key)
            if (!state) return null
            return <MapNode key={node.key} nodeKey={node.key} state={state} mySectId={snapshot.player.sectId} selected={selectedKey === node.key} justCaptured={justCaptured.has(node.key)} onSelect={onSelect} />
          })}

          {armies.map(army => {
            const remaining = Math.max(0, (army.arriveAt ?? now) - now)
            const total = Math.max(1, (army.arriveAt ?? now) - (army.startedAt ?? now))
            const progress = Math.max(0, Math.min(1, (now - (army.startedAt ?? now)) / total))
            const armyDestination = WARFRONT_NODE_MAP[army.destinationKey ?? '']
            return (
              <div
                className={`warfront-army ${army.isMine ? 'mine' : 'rival'}`}
                key={army.id}
                style={pointStyle(army.position)}
                title={`${army.name} · ${army.deployed} 人 · ${armyDestination?.name ?? '行军中'}`}
              >
                <div className="warfront-army-trail" />
                <div className="warfront-army-glyph"><span>⚑</span></div>
                <div className="warfront-army-label">{army.isMine ? '我的军队' : army.name}</div>
                <div className="warfront-army-meta">{army.deployed} 人 · {Math.ceil(remaining / 1000)}s</div>
                <div className="warfront-army-progress"><i style={{ width: `${progress * 100}%` }} /></div>
              </div>
            )
          })}

          {ownArmy && destination && (
            <div className="warfront-march-status">
              <span className="warfront-status-dot" />
              <div className="warfront-march-status-body">
                <b>行军至 {destination.name}</b>
                <small>抵达后才会在据点交战 · {formatRemaining(ownArmy.arriveAt ?? now, now)}</small>
                <div className="warfront-march-progress"><i style={{ width: `${marchProgress(ownArmy, now) * 100}%` }} /></div>
              </div>
            </div>
          )}
        </div>
      </div>
      {command && <div className="warfront-command-slot">{command}</div>}
      <div className="warfront-map-footer">
        <span><i className="legend-dot mine" />我方宗门</span>
        <span><i className="legend-dot rival" />敌对宗门</span>
        <span><i className="legend-dot neutral" />秘境守军</span>
        <span className="warfront-map-help">点击据点选择目标</span>
      </div>
    </section>
    </ProjectCtx.Provider>
  )
}

/** 挂载 3D 沙盘：懒加载 three.js，失败或无 WebGL 时退回 2D 舆图 */
function useWarfrontWorld(snapshot: WarfrontSnapshot, selectedKey: string) {
  const [mode, setMode] = useState<'3d' | '2d'>(() => (webglAvailable() ? '3d' : '2d'))
  const [ready, setReady] = useState(false)
  const [, setVersion] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<import('./world/WarfrontWorld').WarfrontWorld | null>(null)

  useEffect(() => {
    if (mode !== '3d') return
    let ro: ResizeObserver | null = null
    let cancelled = false
    import('./world/WarfrontWorld').then(({ WarfrontWorld }) => {
      if (cancelled || !canvasRef.current) return
      const w = new WarfrontWorld(canvasRef.current)
      worldRef.current = w
      w.onProjectionChange = () => setVersion(v => v + 1)
      ro = new ResizeObserver(() => w.resize())
      ro.observe(canvasRef.current)
      setReady(true)
    }).catch(err => { console.warn('战区 3D 沙盘加载失败，退回 2D：', err); if (!cancelled) setMode('2d') })
    return () => { cancelled = true; ro?.disconnect(); worldRef.current?.dispose(); worldRef.current = null }
  }, [mode])

  useEffect(() => {
    const w = worldRef.current
    if (!w) return
    w.setNodes(snapshot.nodes.map(n => ({ key: n.key, relation: (n.ownerSectId ? (n.ownerSectId === snapshot.player.sectId ? 'mine' : 'rival') : 'neutral') as Relation })), selectedKey)
  })

  const project = mode === '3d' && ready && worldRef.current ? (p: Pt) => worldRef.current!.project(p) : null
  return { mode, ready, canvasRef, project }
}

function MapNode({ nodeKey, state, mySectId, selected, justCaptured, onSelect }: {
  nodeKey: string
  state: OnlineNodeState
  mySectId: string
  selected: boolean
  justCaptured: boolean
  onSelect: (key: string) => void
}) {
  const def = WARFRONT_NODE_MAP[nodeKey]
  const relation = state.ownerSectId ? (state.ownerSectId === mySectId ? 'mine' : 'rival') : 'neutral'
  const className = `warfront-map-node ${relation}${selected ? ' selected' : ''}${justCaptured ? ' captured' : ''}`
  return (
    <button
      type="button"
      className={className}
      style={usePointStyle(def.position)}
      onClick={() => onSelect(nodeKey)}
      aria-label={`${def.name}，${state.ownerSectName ?? '秘境守军'}，守军 ${state.garrisonTotal}`}
    >
      <span className="warfront-node-ring"><img src={sprite(TROOP_MAP[state.guardTroop].sprite)} alt={TROOP_MAP[state.guardTroop].name} /></span>
      <span className="warfront-node-copy"><span className="warfront-node-kind">{def.kind}</span><b>{def.name}</b><small>{state.ownerSectName ?? '秘境守军'}</small></span>
      <span className="warfront-node-guard">守军 {fmt(state.garrisonTotal)}</span>
      {state.ownerSectId && <span className="warfront-node-banner">⚑</span>}
    </button>
  )
}

/** 追踪据点归属变化，短暂标记为 captured 以触发一次金光闪烁；不改变任何领域数据。 */
function useCaptureFlash(nodes: OnlineNodeState[]): Set<string> {
  const prevOwners = useRef<Map<string, string | null> | null>(null)
  const [flashed, setFlashed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const prev = prevOwners.current
    const next = new Map(nodes.map(node => [node.key, node.ownerSectId]))
    prevOwners.current = next
    if (!prev) return
    const changed = nodes.filter(node => prev.has(node.key) && prev.get(node.key) !== node.ownerSectId).map(node => node.key)
    if (changed.length === 0) return
    setFlashed(current => new Set([...current, ...changed]))
    const timer = window.setTimeout(() => {
      setFlashed(current => { const next = new Set(current); changed.forEach(key => next.delete(key)); return next })
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [nodes])

  return flashed
}

function marchProgress(army: { startedAt: number | null; arriveAt: number | null }, now: number): number {
  const start = army.startedAt ?? now
  const total = Math.max(1, (army.arriveAt ?? now) - start)
  return Math.max(0, Math.min(1, (now - start) / total))
}

function toStyle(point: Pt): CSSProperties {
  return { left: `${point.x}%`, top: `${point.y}%` }
}
/** 覆盖层定位：有 3D 投影就走投影 */
function usePointStyle(point: Pt): CSSProperties {
  const project = useContext(ProjectCtx)
  return toStyle(project ? project(point) : point)
}

function formatRemaining(arriveAt: number, now: number): string {
  return `${Math.max(0, Math.ceil((arriveAt - now) / 1000))} 秒`
}
