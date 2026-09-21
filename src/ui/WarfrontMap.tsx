import type { CSSProperties, ReactNode } from 'react'
import { WARFRONT_NODE_MAP, WARFRONT_NODES } from '../game/warfront'
import type { OnlineNodeState, WarfrontSnapshot } from '../online/contracts'
import { fmt } from './util'

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

  return (
    <section className="warfront-map-shell" aria-label="苍梧秘境共享战争地图">
      <div className="warfront-map-toolbar">
        <div>
          <span className="warfront-map-kicker">共享战争地图</span>
          <b>{snapshot.seasonName}</b>
        </div>
        <div className="warfront-map-live"><i /> {armies.length} 支行军 · {snapshot.friends.filter(friend => friend.online).length} 位好友在线</div>
      </div>
      <div className="warfront-map-canvas">
        <div className="warfront-map-grid" aria-hidden="true" />
        <svg className="warfront-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {WARFRONT_NODES.flatMap(node => node.connections
            .filter(key => node.key < key)
            .map(key => {
              const target = WARFRONT_NODE_MAP[key]
              return target ? <line key={`${node.key}-${key}`} x1={node.position.x} y1={node.position.y} x2={target.position.x} y2={target.position.y} /> : null
            }))}
        </svg>
        <div className="warfront-map-watermark" aria-hidden="true">苍梧</div>
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
          return <MapNode key={node.key} nodeKey={node.key} state={state} mySectId={snapshot.player.sectId} selected={selectedKey === node.key} onSelect={onSelect} />
        })}

        {armies.map(army => {
          const remaining = Math.max(0, (army.arriveAt ?? now) - now)
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
            </div>
          )
        })}

        {ownArmy && destination && (
          <div className="warfront-march-status">
            <span className="warfront-status-dot" />
            <div><b>行军至 {destination.name}</b><small>抵达后才会在据点交战 · {formatRemaining(ownArmy.arriveAt ?? now, now)}</small></div>
          </div>
        )}
      </div>
      {command}
      <div className="warfront-map-footer">
        <span><i className="legend-dot mine" />我方宗门</span>
        <span><i className="legend-dot rival" />敌对宗门</span>
        <span><i className="legend-dot neutral" />秘境守军</span>
        <span className="warfront-map-help">点击据点下达行军</span>
      </div>
    </section>
  )
}

function MapNode({ nodeKey, state, mySectId, selected, onSelect }: {
  nodeKey: string
  state: OnlineNodeState
  mySectId: string
  selected: boolean
  onSelect: (key: string) => void
}) {
  const def = WARFRONT_NODE_MAP[nodeKey]
  const relation = state.ownerSectId ? (state.ownerSectId === mySectId ? 'mine' : 'rival') : 'neutral'
  const className = `warfront-map-node ${relation}${selected ? ' selected' : ''}`
  return (
    <button
      type="button"
      className={className}
      style={pointStyle(def.position)}
      onClick={() => onSelect(nodeKey)}
      aria-label={`${def.name}，${state.ownerSectName ?? '秘境守军'}，守军 ${state.garrisonTotal}`}
    >
      <span className="warfront-node-ring"><span>{def.kind.slice(0, 1)}</span></span>
      <span className="warfront-node-copy"><b>{def.name}</b><small>{state.ownerSectName ?? '秘境守军'}</small></span>
      <span className="warfront-node-guard">守军 {fmt(state.garrisonTotal)}</span>
      {state.ownerSectId && <span className="warfront-node-banner">⚑</span>}
    </button>
  )
}

function pointStyle(point: { x: number; y: number }): CSSProperties {
  return { left: `${point.x}%`, top: `${point.y}%` }
}

function formatRemaining(arriveAt: number, now: number): string {
  return `${Math.max(0, Math.ceil((arriveAt - now) / 1000))} 秒`
}
