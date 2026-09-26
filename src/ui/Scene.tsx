import { BUILDINGS, dongfuSprite } from '../game/data'
import type { BuildingKey } from '../game/types'
import { useGame } from '../game/store'
import { sprite, fmtTime } from './util'
import { SceneAmbientCanvas } from './SceneAmbientCanvas'
import { useEffect, useRef, useState } from 'react'
import { webglAvailable } from './world/webgl'

export function Scene({ now, onPick }: { now: number; onPick: (k: BuildingKey) => void }) {
  const s = useGame()
  const dongfuLv = s.buildings.dongfu.level
  const activeKeys = BUILDINGS.filter(def => s.buildings[def.key].level > 0).map(def => def.key)
  // 3D 模式：three.js 画地形与环境，建筑 DOM 由引擎每帧按地块投影定位；WebGL 不可用或加载失败时退回 2D 背景
  const [mode, setMode] = useState<'3d' | '2d'>(() => (webglAvailable() ? '3d' : '2d'))
  const [ready, setReady] = useState(false)
  const sceneRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const anchors = useRef(new Map<BuildingKey, HTMLElement>())

  useEffect(() => {
    if (mode !== '3d') return
    let world: { resize(): void; dispose(): void; setAnchors(m: Map<BuildingKey, HTMLElement>): void } | null = null
    let ro: ResizeObserver | null = null
    let cancelled = false
    import('./world/HomeWorld').then(({ HomeWorld }) => {
      if (cancelled || !canvasRef.current) return
      world = new HomeWorld(canvasRef.current)
      world.setAnchors(anchors.current)
      ro = new ResizeObserver(() => world?.resize())
      if (sceneRef.current) ro.observe(sceneRef.current)
      setReady(true)
    }).catch(err => {
      console.warn('洞府 3D 场景加载失败，退回 2D：', err)
      if (!cancelled) setMode('2d')
    })
    return () => { cancelled = true; ro?.disconnect(); world?.dispose() }
  }, [mode])

  return (
    <div className={'scene' + (mode === '3d' ? ' scene-3d' + (ready ? ' ready' : '') : '')} ref={sceneRef}>
      {mode === '3d'
        ? <canvas className="scene-world" ref={canvasRef} aria-hidden="true" />
        : <img className="scene-bg" src={sprite('bg/main-valley.svg')} alt="" />}
      <div className="scene-shade" />

      {/* 按地面线从远到近排序：近处建筑后渲染，自然遮挡远处（画家算法） */}
      {[...BUILDINGS].sort((a, b) => a.pos.y - b.pos.y).map(def => {
        const b = s.buildings[def.key]
        const locked = b.level === 0 && dongfuLv < def.unlockAt
        const busy = b.upgradingUntil !== null && now < b.upgradingUntil
        const done = b.upgradingUntil !== null && now >= b.upgradingUntil

        return (
          <button
            key={def.key}
            className={[
              'bld',
              `bld-${def.key}`,
              locked ? 'bld-locked' : '',
              b.level > 0 && !locked ? 'bld-active' : '',
              busy ? 'bld-upgrading' : '',
            ].filter(Boolean).join(' ')}
            data-tut={def.key}
            ref={el => { if (el) anchors.current.set(def.key, el); else anchors.current.delete(def.key) }}
            style={mode === '3d' ? undefined : { left: `${def.pos.x}%`, top: `${def.pos.y}%`, width: `${def.scale}%`, zIndex: Math.round(def.pos.y * 10) }}
            onClick={() => onPick(def.key)}
            aria-label={`${def.name}${locked ? `，需洞府 ${def.unlockAt} 级` : b.level === 0 ? '，可兴建' : `，${b.level}级`}`}
          >
            {b.level > 0 && !locked && <BuildingEffects bkey={def.key} busy={busy} />}
            {/* 洞府外观随等级分三档，其余建筑用固定图 */}
            <img
              src={sprite(def.key === 'dongfu' ? dongfuSprite(b.level) : def.sprite)}
              alt={def.name}
            />
            <span className={'bld-tag' + (busy ? ' busy' : done ? ' ready' : '')}>
              {locked
                ? `${def.name} 🔒${def.unlockAt}`
                : busy
                  ? `${def.name} ⏳${fmtTime(b.upgradingUntil! - now)}`
                  : done
                    ? `${def.name} ✓`
                    : b.level === 0
                      ? `${def.name} ·建`
                      : `${def.name} ${b.level}`}
            </span>
          </button>
        )
      })}
      {mode === '2d' && <SceneAmbientCanvas activeKeys={activeKeys} />}
    </div>
  )
}

function BuildingEffects({ bkey, busy }: { bkey: BuildingKey; busy: boolean }) {
  return (
    <span className={'bld-fx' + (busy ? ' construction' : '')} aria-hidden="true">
      <i className="fx-halo" />
      <i className="fx-ring fx-ring-a" />
      <i className="fx-ring fx-ring-b" />
      <i className="fx-particle fx-particle-a" />
      <i className="fx-particle fx-particle-b" />
      <i className="fx-particle fx-particle-c" />
      <i className="fx-particle fx-particle-d" />
      <i className="fx-trace" />
      <i className="fx-trace fx-trace-b" />
      <i className="fx-spark" />
      <i className="fx-spark fx-spark-b" />
      <span className={'fx-mark fx-mark-' + bkey} />
    </span>
  )
}
