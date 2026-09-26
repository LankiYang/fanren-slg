// 洞府 3D 场景：three.js 负责地形、水、树、云、灵气粒子与镜头；
// 建筑仍是 DOM（便于点击与新手引导定位），每帧按 3D 地块投影到屏幕并同步位置/大小/层级。
import * as THREE from 'three'
import type { BuildingKey } from '../../game/types'
import { sprite } from '../util'
import { cloudTexture } from './textures'
import { PLOTS, RIVER, RIVER_HALF_WIDTH, fbm, heightAt, riverDist, roadDist } from './homeLayout'

const col = (hex: string) => new THREE.Color(hex)
const ss = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

/** 柔和圆点贴图（粒子 / 光晕） */
function dotTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, inner); grd.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)')); grd.addColorStop(1, outer)
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

/** 远山剪影贴图：一层青绿山峦（上亮下暗，底部融进雾） */
function ridgeTexture(top: string, bottom: string, seedV: number, peaks = 7) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256
  const g = c.getContext('2d')!
  seed = seedV
  const grd = g.createLinearGradient(0, 40, 0, 256)
  grd.addColorStop(0, top); grd.addColorStop(1, bottom)
  g.fillStyle = grd
  g.beginPath(); g.moveTo(0, 256)
  let x = 0
  g.lineTo(0, 140 + rnd() * 60)
  for (let i = 0; i < peaks; i++) {
    const w = 1024 / peaks, px = x + w * (0.3 + rnd() * 0.4), py = 30 + rnd() * 110
    g.quadraticCurveTo(px - w * 0.2, py + 20, px, py)
    x += w
    g.quadraticCurveTo(px + w * 0.25, py + 30, x, 120 + rnd() * 80)
  }
  g.lineTo(1024, 256); g.closePath(); g.fill()
  // 皴线
  g.strokeStyle = 'rgba(20,40,40,.18)'; g.lineWidth = 2
  for (let i = 0; i < 60; i++) { const sx = rnd() * 1024, sy = 120 + rnd() * 120; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + 4, sy + 10, sx + 1, sy + 22); g.stroke() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

function skyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#16283a'); grd.addColorStop(0.45, '#3f6d74'); grd.addColorStop(0.8, '#c9b98e'); grd.addColorStop(1, '#e8d6a8')
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

const WATER_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const WATER_FRAG = `
uniform float uTime; varying vec2 vUv;
void main(){
  float edge = abs(vUv.x - 0.5) * 2.0;
  vec3 deep = vec3(0.13,0.42,0.45), shallow = vec3(0.62,0.86,0.80);
  vec3 c = mix(deep, shallow, smoothstep(0.35, 1.0, edge));
  float w = sin(vUv.y * 5.0 - uTime * 1.6 + sin(vUv.x * 9.0 + vUv.y * 1.3) * 1.2);
  float streak = smoothstep(0.82, 1.0, w) * (1.0 - edge) * 0.55;
  float glint = smoothstep(0.96, 1.0, sin(vUv.y * 13.0 - uTime * 2.4 + vUv.x * 20.0)) * 0.35;
  c += vec3(streak + glint);
  float foam = smoothstep(0.78, 1.0, edge) * (0.6 + 0.4 * sin(vUv.y * 20.0 - uTime * 2.0));
  c = mix(c, vec3(0.93,0.97,0.94), foam * 0.6);
  gl_FragColor = vec4(c, 0.9 - smoothstep(0.9, 1.0, edge) * 0.5);
}`
const FALL_FRAG = `
uniform float uTime; varying vec2 vUv;
void main(){
  float x = vUv.x;
  float streak = 0.55 + 0.45 * sin(x * 38.0 + sin(x * 7.0) * 3.0);
  float flow = fract(vUv.y * 3.0 + uTime * 1.3 + sin(x * 21.0) * 0.3);
  float s = smoothstep(0.0, 0.5, flow) * streak;
  vec3 c = mix(vec3(0.62,0.86,0.82), vec3(1.0), s * 0.8);
  float a = (1.0 - smoothstep(0.35, 0.5, abs(x - 0.5))) * (0.75 + 0.25 * s);
  gl_FragColor = vec4(c, a * smoothstep(0.0, 0.08, vUv.y));
}`
const MOTE_VERT = `
attribute float aSize; attribute vec3 aColor; varying vec3 vColor; varying float vAlpha;
uniform float uTime; attribute float aPhase;
void main(){
  vColor = aColor;
  vAlpha = 0.55 + 0.45 * sin(uTime * 2.0 + aPhase);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (260.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`
const MOTE_FRAG = `
uniform sampler2D uTex; varying vec3 vColor; varying float vAlpha;
void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vColor, t.a * vAlpha); }`

interface Mote { base: THREE.Vector3; speed: number; spread: number; life: number; kind: 'rise' | 'wander' }

let homeTerrainCache: { ys: Float32Array; colors: Float32Array } | null = null

export class HomeWorld {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(34, 1, 1, 600)
  private clock = new THREE.Clock()
  private raf = 0
  private anchors = new Map<BuildingKey, HTMLElement>()
  private uniforms: { uTime: { value: number } }[] = []
  private motes!: THREE.Points
  private moteData: Mote[] = []
  private swaySprites: { s: THREE.Sprite; phase: number; base: number }[] = []
  private clouds: { s: THREE.Sprite; speed: number; x0: number }[] = []
  private cranes: { s: THREE.Sprite; phase: number; speed: number; y: number; z: number; w: number }[] = []
  private pointer = new THREE.Vector2()
  private pointerSmooth = new THREE.Vector2()
  private disposed = false
  private readonly tmp = new THREE.Vector3()
  private readonly tmp2 = new THREE.Vector3()
  private readonly baseCam = new THREE.Vector3(0, 90, 80)
  private readonly target = new THREE.Vector3(0, 0, -22)
  private onPointer = (e: PointerEvent) => { this.pointer.set(e.clientX / window.innerWidth * 2 - 1, e.clientY / window.innerHeight * 2 - 1) }

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = skyTexture()
    this.scene.fog = new THREE.Fog('#a9c4b8', 150, 360)
    this.scene.add(new THREE.HemisphereLight('#dff3ea', '#3a5a3c', 1.25))
    const sun = new THREE.DirectionalLight('#fff0cf', 2.1)
    sun.position.set(-40, 70, 30)
    this.scene.add(sun)
    this.buildFarRidges()
    this.buildTerrain()
    this.buildWater()
    this.buildFoliage()
    this.buildMotes()
    this.buildSkyLife()
    window.addEventListener('pointermove', this.onPointer, { passive: true })
    this.resize()
    this.loop()
  }

  setAnchors(map: Map<BuildingKey, HTMLElement>) { this.anchors = map; this.project() }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // 以「水平视野」为准取景：竖屏时纵向 fov 自动变大，山谷左右两岸始终完整入画
    const hfov = THREE.MathUtils.degToRad(36), halfWidth = 43, pitch = THREE.MathUtils.degToRad(47)
    const d = halfWidth / Math.tan(hfov / 2)
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / this.camera.aspect))
    this.baseCam.set(this.target.x, Math.sin(pitch) * d, this.target.z + Math.cos(pitch) * d)
    this.camera.far = d * 4
    this.camera.updateProjectionMatrix()
    this.project()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('pointermove', this.onPointer)
    this.scene.traverse(o => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose()
    })
    this.renderer.dispose()
  }

  // ── 地形：高度 + 顶点色（草地 / 河岸 / 石板路 / 青绿山石） ──
  private buildTerrain() {
    const size = 190, seg = 170
    const geo = new THREE.PlaneGeometry(size, size, seg, seg)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, 0, -25)
    const pos = geo.attributes.position as THREE.BufferAttribute
    // 地形计算较重（每顶点多次采样高度），切页签回来时直接复用
    const cached = homeTerrainCache
    const colors = cached?.colors ?? new Float32Array(pos.count * 3)
    if (cached) (pos.array as Float32Array).set(cached.ys)
    else {
    const grassA = col('#6f9a5c'), grassB = col('#a3c47e'), grassFar = col('#5f8f70')
    const sand = col('#cdbd92'), road = col('#cbbb94'), roadEdge = col('#9f8f68')
    const ochre = col('#8a6c48'), jade = col('#3f8f84'), jadeTop = col('#86cdb6'), blue = col('#2f5f76')
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const h = heightAt(x, z)
      pos.setY(i, h)
      const n = fbm(x * 0.09, z * 0.09)
      c.copy(grassA).lerp(grassB, n).lerp(grassFar, ss(-20, -60, z) * 0.35)
      // 山体：赭 → 石青 → 石绿山头（青绿山水设色）
      const hs = heightAt(x + 0.8, z) - heightAt(x - 0.8, z), vs = heightAt(x, z + 0.8) - heightAt(x, z - 0.8)
      const slope = Math.hypot(hs, vs) / 1.6
      const rock = Math.max(ss(4, 12, h), ss(0.7, 1.6, slope) * ss(1.5, 5, h))
      if (rock > 0) {
        const k = ss(6, 34, h + fbm(x * 0.2, z * 0.2) * 8)
        const m = new THREE.Color().copy(ochre).lerp(blue, ss(0, 0.45, k)).lerp(jade, ss(0.35, 0.7, k)).lerp(jadeTop, ss(0.7, 1, k))
        m.multiplyScalar(0.85 + fbm(x * 0.5, z * 0.5) * 0.3)
        c.lerp(m, rock)
      }
      const rd = riverDist(x, z)
      if (rd < RIVER_HALF_WIDTH + 2.4) c.lerp(sand, 1 - ss(RIVER_HALF_WIDTH + 0.6, RIVER_HALF_WIDTH + 2.4, rd))
      const pd = roadDist(x, z)
      if (pd < 2.2) c.lerp(pd > 1.7 ? roadEdge : road.clone().multiplyScalar(0.92 + fbm(x * 1.4, z * 1.4) * 0.16), 1 - ss(1.7, 2.2, pd))
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    }
    homeTerrainCache = { ys: Float32Array.from(pos.array as Float32Array), colors }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }))
    this.scene.add(mesh)
  }

  private buildFarRidges() {
    const layers: [string, string, number, number, number][] = [
      ['#a9c7bd', '#c9d8c6', -200, 90, 11], ['#7fae9f', '#a9c3b2', -165, 70, 23], ['#5f998c', '#8fb3a1', -135, 52, 37],
    ]
    for (const [top, bottom, z, h, sd] of layers) {
      const tex = ridgeTexture(top, bottom, sd)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(460, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }))
      m.position.set(0, h / 2 - 6, z)
      this.scene.add(m)
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture('rgba(255,244,210,1)'), transparent: true, depthWrite: false, fog: false }))
    glow.position.set(60, 60, -230); glow.scale.set(120, 120, 1)
    this.scene.add(glow)
  }

  // ── 河 + 瀑布：流动着色器 ──
  private buildWater() {
    const curve = new THREE.CatmullRomCurve3(RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z)))
    const N = 220, pts = curve.getSpacedPoints(N)
    const verts: number[] = [], uvs: number[] = [], idx: number[] = []
    let acc = 0
    for (let i = 0; i <= N; i++) {
      const p = pts[i], q = pts[Math.min(N, i + 1)], o = pts[Math.max(0, i - 1)]
      const dir = new THREE.Vector3().subVectors(q, o).normalize()
      const nx = -dir.z, nz = dir.x
      if (i > 0) acc += p.distanceTo(pts[i - 1])
      const w = RIVER_HALF_WIDTH + 0.6
      verts.push(p.x + nx * w, -0.6, p.z + nz * w, p.x - nx * w, -0.6, p.z - nz * w)
      uvs.push(0, acc / 9, 1, acc / 9)
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(idx)
    const u = { uTime: { value: 0 } }
    this.uniforms.push(u)
    this.scene.add(new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide })))
    // 瀑布：贴在后山左侧崖面，底部接河源
    const top = heightAt(-25, -68)
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(5, top + 2, 1, 8), new THREE.ShaderMaterial({ uniforms: u, vertexShader: WATER_VERT, fragmentShader: FALL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
    fall.position.set(-26, (top + 2) / 2 - 1.4, -63.5)
    fall.rotation.x = -0.35
    this.scene.add(fall)
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture('rgba(240,250,246,0.9)'), transparent: true, depthWrite: false }))
    mist.position.set(-26.5, 1.5, -61); mist.scale.set(14, 8, 1)
    this.swaySprites.push({ s: mist, phase: 0, base: 14 })
    this.scene.add(mist)
  }

  // ── 树木：SVG 松与灌木作为公告板，避开地块、道路和河 ──
  private buildFoliage() {
    const loader = new THREE.TextureLoader()
    const mat = (name: string) => {
      const t = loader.load(sprite(`scene/${name}.svg`)); t.colorSpace = THREE.SRGBColorSpace
      return new THREE.SpriteMaterial({ map: t, alphaTest: 0.35, transparent: true })
    }
    const pineM = [mat('pine'), mat('pine-dark')], bushM = [mat('bush'), mat('bush-plain')]
    seed = 42
    let placed = 0
    for (let tries = 0; tries < 2600 && placed < 190; tries++) {
      const x = -80 + rnd() * 160, z = -95 + rnd() * 150
      const h = heightAt(x, z)
      if (h > 30) continue
      const nearPlot = Object.values(PLOTS).some(p => Math.hypot(x - p.x, z - p.z) < p.r + 2.5)
      if (nearPlot || roadDist(x, z) < 3.2 || riverDist(x, z) < RIVER_HALF_WIDTH + 1.6) continue
      // 谷地中央稀疏、山脚与边缘茂密
      const edge = Math.max(ss(26, 44, Math.abs(x)), ss(-40, -58, z), ss(36, 50, z), ss(3, 10, h))
      if (rnd() > 0.12 + edge * 0.85) continue
      const isPine = rnd() < 0.7
      const s = new THREE.Sprite(isPine ? pineM[h > 8 ? 1 : 0] : bushM[rnd() < 0.3 ? 0 : 1])
      const k = isPine ? 5.6 + rnd() * 3.4 : 3 + rnd() * 1.6
      s.scale.set(k, k * (isPine ? 1.18 : 0.78), 1)
      s.center.set(0.5, 0.05)
      s.position.set(x, h - 0.2, z)
      this.scene.add(s)
      if (isPine && placed % 3 === 0) this.swaySprites.push({ s, phase: rnd() * 6, base: 0 })
      placed++
    }
  }

  // ── 灵气粒子：聚灵阵、洞府上升的灵光 + 灵田、河边的萤火 ──
  private buildMotes() {
    const sources: [number, number, number, number, Mote['kind'], string][] = [
      [PLOTS.juling.x, PLOTS.juling.z, 5, 70, 'rise', '#9ff0dc'],
      [PLOTS.dongfu.x, PLOTS.dongfu.z + 4, 9, 50, 'rise', '#b8c8ff'],
      [PLOTS.lingtian.x, PLOTS.lingtian.z, 10, 36, 'wander', '#d8f59a'],
      [-31, -8, 14, 30, 'wander', '#e9ffb0'],
      [0, -10, 40, 50, 'wander', '#f4e6b0'],
    ]
    seed = 9
    const positions: number[] = [], colors: number[] = [], sizes: number[] = [], phases: number[] = []
    for (const [x, z, spread, n, kind, hex] of sources) {
      const c = col(hex)
      for (let i = 0; i < n; i++) {
        const b = new THREE.Vector3(x + (rnd() - 0.5) * spread, heightAt(x, z) + 0.5, z + (rnd() - 0.5) * spread)
        this.moteData.push({ base: b, speed: 0.6 + rnd() * 1.2, spread, life: rnd() * 10, kind })
        positions.push(b.x, b.y, b.z); colors.push(c.r, c.g, c.b); sizes.push(kind === 'rise' ? 0.9 + rnd() * 0.9 : 0.6 + rnd() * 0.6); phases.push(rnd() * 6.28)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
    const u = { uTime: { value: 0 }, uTex: { value: dotTexture() } }
    this.uniforms.push(u)
    this.motes = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    this.scene.add(this.motes)
  }

  // ── 云与仙鹤 ──
  private buildSkyLife() {
    const loader = new THREE.TextureLoader()
    const cloudTex = cloudTexture(3)
    seed = 77
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55 + rnd() * 0.3, depthWrite: false }))
      const w = 30 + rnd() * 26
      s.scale.set(w, w * 0.32, 1)
      s.position.set(-90 + rnd() * 180, 22 + rnd() * 20, -70 - rnd() * 60)
      this.clouds.push({ s, speed: 0.6 + rnd() * 0.8, x0: s.position.x })
      this.scene.add(s)
    }
    const craneTex = loader.load(sprite('scene/crane.svg')); craneTex.colorSpace = THREE.SRGBColorSpace
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: craneTex, transparent: true, depthWrite: false }))
      const w = 4.4 - i * 0.8
      s.scale.set(w, w * 0.5, 1)
      this.cranes.push({ s, phase: i * 0.06, speed: 0.018, y: 26 + i * 2, z: -40 - i * 3, w })
      this.scene.add(s)
    }
  }

  /** 把每个建筑地块的前沿投影到屏幕，驱动 DOM 建筑的位置、宽度与遮挡顺序 */
  private project() {
    if (!this.anchors.size) return
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    this.camera.updateMatrixWorld()
    const right = this.tmp2.setFromMatrixColumn(this.camera.matrixWorld, 0)
    for (const [key, el] of this.anchors) {
      const p = PLOTS[key]
      const ax = p.x, ay = p.elev, az = p.z + p.r * 0.45
      this.tmp.set(ax, ay, az).project(this.camera)
      const sx = (this.tmp.x + 1) / 2 * w, sy = (1 - this.tmp.y) / 2 * h
      this.tmp.set(ax - right.x * p.size / 2, ay - right.y * p.size / 2, az - right.z * p.size / 2).project(this.camera)
      const lx = (this.tmp.x + 1) / 2 * w
      const bw = Math.abs(sx - lx) * 2
      el.style.left = `${sx.toFixed(1)}px`
      el.style.top = `${sy.toFixed(1)}px`
      el.style.width = `${bw.toFixed(1)}px`
      el.style.zIndex = String(Math.round((az + 100) * 10))
    }
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime
    for (const u of this.uniforms) u.uTime.value = t
    // 镜头：缓慢呼吸 + 跟随指针的轻微视差
    this.pointerSmooth.lerp(this.pointer, 0.04)
    this.camera.position.set(
      this.baseCam.x + Math.sin(t * 0.13) * 2.2 + this.pointerSmooth.x * 2.4,
      this.baseCam.y + Math.sin(t * 0.21) * 0.8 - this.pointerSmooth.y * 1.2,
      this.baseCam.z + Math.cos(t * 0.11) * 1.4,
    )
    this.camera.lookAt(this.target)
    // 粒子
    const pos = this.motes.geometry.attributes.position as THREE.BufferAttribute
    this.moteData.forEach((m, i) => {
      m.life += dt * m.speed
      if (m.kind === 'rise') {
        const k = (m.life % 6) / 6
        pos.setXYZ(i, m.base.x + Math.sin(m.life * 1.3 + i) * 1.2, m.base.y + k * 16, m.base.z + Math.cos(m.life * 1.1 + i) * 1.2)
      } else {
        pos.setXYZ(i, m.base.x + Math.sin(m.life * 0.7 + i) * 2.4, m.base.y + 1.2 + Math.sin(m.life * 1.9 + i * 0.3) * 0.9, m.base.z + Math.cos(m.life * 0.6 + i * 0.7) * 2.4)
      }
    })
    pos.needsUpdate = true
    for (const { s, phase, base } of this.swaySprites) {
      if (base) { const k = 1 + Math.sin(t * 1.6) * 0.08; s.scale.set(base * k, base * 0.57 * k, 1) }
      else s.material.rotation = Math.sin(t * 0.9 + phase) * 0.035
    }
    for (const c of this.clouds) { c.s.position.x = ((c.x0 + t * c.speed + 120) % 240) - 120 }
    for (const c of this.cranes) {
      const k = ((t * c.speed + c.phase) % 1)
      c.s.position.set(-70 + k * 150, c.y + Math.sin(k * 12) * 1.5, c.z + k * 18)
      c.s.scale.y = c.w * 0.5 * (0.65 + Math.abs(Math.sin(t * 3 + c.phase * 30)) * 0.5)
    }
    this.renderer.render(this.scene, this.camera)
    this.project()
  }
}

