import { useEffect, useRef } from 'react'
import { BUILDING_MAP } from '../game/data'
import type { BuildingKey } from '../game/types'

const PARTICLE_POOL_SIZE = 72

type ParticleMode = 'rise' | 'firefly' | 'spark' | 'trade' | 'orbit'

interface Particle {
  anchor: number
  progress: number
  speed: number
  drift: number
  phase: number
  size: number
  mode: ParticleMode
}

interface Anchor {
  key: BuildingKey
  x: number
  y: number
  spread: number
  color: string
  accent: string
  mode: ParticleMode
  rise: number
}

const EFFECTS: Record<BuildingKey, Omit<Anchor, 'key' | 'x' | 'y' | 'spread'>> = {
  cangjing: { color: '151,171,255', accent: '216,177,104', mode: 'orbit', rise: .08 },
  lianqi: { color: '255,177,92', accent: '217,112,112', mode: 'spark', rise: .1 },
  juling: { color: '79,209,197', accent: '216,177,104', mode: 'rise', rise: .13 },
  lingtian: { color: '169,231,126', accent: '111,191,115', mode: 'firefly', rise: .11 },
  dongfu: { color: '151,171,255', accent: '79,209,197', mode: 'orbit', rise: .08 },
  kuangmai: { color: '241,201,120', accent: '216,177,104', mode: 'spark', rise: .1 },
  fangshi: { color: '216,177,104', accent: '79,209,197', mode: 'trade', rise: .04 },
  liandan: { color: '255,177,92', accent: '217,112,112', mode: 'spark', rise: .12 },
  yanwu: { color: '217,112,112', accent: '216,177,104', mode: 'spark', rise: .08 },
  zongmen: { color: '216,177,104', accent: '151,171,255', mode: 'orbit', rise: .06 },
}

/** 固定数量的场景粒子池，只读取建筑锚点，不参与任何游戏结算。 */
export function SceneAmbientCanvas({ activeKeys }: { activeKeys: BuildingKey[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signature = activeKeys.join('|')

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    const context = canvas.getContext('2d')
    if (!context) return

    const anchors = activeKeys.map(key => {
      const def = BUILDING_MAP[key]
      const effect = EFFECTS[key]
      return {
        key,
        x: def.pos.x / 100,
        y: def.pos.y / 100,
        spread: Math.max(.025, def.scale / 1000),
        ...effect,
      }
    })
    const particles: Particle[] = Array.from({ length: Math.max(18, Math.min(PARTICLE_POOL_SIZE, anchors.length * 14)) }, () => ({
      anchor: 0,
      progress: 0,
      speed: .2,
      drift: 0,
      phase: 0,
      size: 1,
      mode: 'rise',
    }))

    let width = 0
    let height = 0
    let frame = 0
    let last = 0
    let stopped = false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const reset = (particle: Particle, randomize = true) => {
      const anchor = anchors.length ? anchors[Math.floor(Math.random() * anchors.length)] : undefined
      particle.anchor = anchor ? anchors.indexOf(anchor) : 0
      particle.progress = randomize ? Math.random() : 0
      particle.speed = anchor?.mode === 'spark' ? .7 + Math.random() * .55 : .22 + Math.random() * .32
      particle.drift = (Math.random() - .5) * 2
      particle.phase = Math.random() * Math.PI * 2
      particle.size = .7 + Math.random() * 1.45
      particle.mode = anchor?.mode ?? 'rise'
    }

    particles.forEach(particle => reset(particle))

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const rgba = (rgb: string, alpha: number) => `rgba(${rgb},${Math.max(0, Math.min(1, alpha))})`

    const draw = (now: number, delta: number) => {
      context.clearRect(0, 0, width, height)
      if (!anchors.length || !width || !height) return
      const seconds = now / 1000

      context.save()
      context.globalCompositeOperation = 'lighter'
      for (const anchor of anchors) {
        const x = anchor.x * width
        const y = anchor.y * height - height * .035
        const radiusX = Math.max(10, anchor.spread * width * 2.8)
        const radiusY = Math.max(3, height * .012)
        const phase = seconds * (anchor.mode === 'orbit' ? .8 : .45)
        context.beginPath()
        context.ellipse(x, y, radiusX, radiusY, phase, 0, Math.PI * 1.45)
        context.strokeStyle = rgba(anchor.accent, .14 + Math.sin(seconds * 1.7 + x) * .05)
        context.lineWidth = 1
        context.stroke()
      }

      for (const particle of particles) {
        if (!anchors.length) continue
        const anchor = anchors[particle.anchor % anchors.length]
        particle.progress += delta * particle.speed
        if (particle.progress >= 1) {
          reset(particle, false)
          continue
        }

        const t = particle.progress
        const baseX = anchor.x * width
        const baseY = anchor.y * height - height * .035
        let x = baseX
        let y = baseY
        let alpha = Math.sin(t * Math.PI) * .78

        if (particle.mode === 'trade') {
          x += (t * 2 - 1) * width * anchor.spread * 3.6
          y += Math.sin(t * Math.PI * 2 + particle.phase) * height * .018
        } else if (particle.mode === 'firefly') {
          x += Math.sin(t * Math.PI * 2 + particle.phase) * width * anchor.spread * 3
          y -= t * height * anchor.rise
          alpha *= .75 + Math.sin(t * Math.PI * 4 + particle.phase) * .2
        } else if (particle.mode === 'orbit') {
          const angle = particle.phase + t * Math.PI * 2
          x += Math.cos(angle) * width * anchor.spread * 2.4
          y += Math.sin(angle) * height * .02 - t * height * anchor.rise * .25
        } else {
          x += particle.drift * width * anchor.spread * Math.sin(t * Math.PI)
          y -= t * height * anchor.rise
          if (particle.mode === 'spark') alpha *= t < .16 ? t / .16 : 1
        }

        const size = particle.size * (1 - t * .45)
        context.fillStyle = rgba(anchor.color, alpha * .18)
        context.beginPath()
        context.arc(x, y, size * 3.4, 0, Math.PI * 2)
        context.fill()
        const spriteFrame = Math.floor((t * 4 + particle.phase) % 4)
        drawMote(context, x, y, size, rgba(anchor.color, alpha), spriteFrame)
      }
      context.restore()
    }

    const render = (now: number) => {
      if (stopped) return
      const delta = Math.min(.08, last ? (now - last) / 1000 : .016)
      last = now
      draw(now, delta)
      if (!reducedMotion) frame = window.requestAnimationFrame(render)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    render(0)
    if (!reducedMotion) frame = window.requestAnimationFrame(render)

    return () => {
      stopped = true
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      context.clearRect(0, 0, width, height)
    }
  }, [signature])

  return <canvas ref={canvasRef} className="scene-fx-canvas" aria-hidden="true" />
}

function drawMote(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, frame: number) {
  context.fillStyle = color
  context.beginPath()
  if (frame === 0) {
    context.arc(x, y, size, 0, Math.PI * 2)
  } else if (frame === 1) {
    context.moveTo(x, y - size * 1.45)
    context.lineTo(x + size * 1.45, y)
    context.lineTo(x, y + size * 1.45)
    context.lineTo(x - size * 1.45, y)
    context.closePath()
  } else if (frame === 2) {
    context.rect(x - size, y - size, size * 2, size * 2)
  } else {
    context.arc(x, y, size * .7, 0, Math.PI * 2)
    context.strokeStyle = color
    context.lineWidth = Math.max(.6, size * .55)
  }
  frame === 3 ? context.stroke() : context.fill()
}
