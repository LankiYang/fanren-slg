// 战区 3D 沙盘：地形按据点性质塑形——
//   坠星堡（核心据点）立在北境高台、凌云台（遗迹）是一方孤悬的石台、迷雾关（关隘）夹在两山之间的垭口、
//   望月灵泉在一汪湖边、赤铁矿岭是赭红色岩丘、青萝药圃是成片的梯田、我方营地在南端平原。
// 据点、行军等交互元素仍是 DOM，本类只负责画面并提供「地图百分比坐标 → 屏幕百分比」的投影。
import * as THREE from 'three'
import { WARFRONT_NODES } from '../../game/warfront'
import { sprite } from '../util'
import { cloudTexture } from './textures'

type Pt = { x: number; y: number }
export type Relation = 'mine' | 'rival' | 'neutral'

const ss = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
const gauss = (x: number, y: number, cx: number, cy: number, s: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s))
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s) }
function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x: number, z: number) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.17

/** 地图 % 坐标 → 世界坐标 */
const S = 1.25
export const toWorld = (p: Pt) => ({ x: (p.x - 50) * S, z: (p.y - 50) * S })

const STREAM: Pt[] = [{ x: 12, y: 4 }, { x: 13, y: 20 }, { x: 11, y: 36 }, { x: 12, y: 50 }, { x: 15, y: 63 }, { x: 21, y: 74 }, { x: 26, y: 81 }]
const LAKE = { x: 27, y: 83, r: 7.5 }
const PLATEAUS: Record<string, { elev: number; r: number }> = {
  'star-fort': { elev: 8, r: 8 }, 'cloud-platform': { elev: 4.2, r: 6.5 }, 'mist-gate': { elev: 1.4, r: 5 },
  moonwell: { elev: 0.6, r: 5 }, 'iron-ridge': { elev: 2.2, r: 5.5 }, 'spirit-field': { elev: 0.6, r: 7 },
}
function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}
const polyDist = (p: Pt, line: Pt[]) => { let d = Infinity; for (let i = 0; i < line.length - 1; i++) d = Math.min(d, segDist(p, line[i], line[i + 1])); return d }
const ROAD_LINES: Pt[][] = WARFRONT_NODES.flatMap(n => n.connections.filter(k => n.key < k).map(k => [n.position, WARFRONT_NODES.find(m => m.key === k)!.position]))
ROAD_LINES.push([{ x: 50, y: 94 }, WARFRONT_NODES.find(n => n.key === 'moonwell')!.position], [{ x: 50, y: 94 }, WARFRONT_NODES.find(n => n.key === 'iron-ridge')!.position])
const roadDist = (p: Pt) => Math.min(...ROAD_LINES.map(l => polyDist(p, l)))

/** 地形高度（输入地图 % 坐标，输出世界高度） */
export function mapHeight(x: number, y: number) {
  const n = fbm(x * 0.08, y * 0.08)
  let h = (fbm(x * 0.2, y * 0.2) - 0.5) * 0.8
  // 北境群山，护住坠星堡
  h += ss(9, -4, y) * (14 + n * 12)
  h += gauss(x, y, 34, 6, 7) * 12 + gauss(x, y, 66, 5, 8) * 13
  h += gauss(x, y, 50, 10, 9) * 9
  // 西侧山脊 + 迷雾关东侧山头 → 垭口
  h += ss(10, 0, x) * (12 + n * 8)
  h += gauss(x, y, 5, 48, 7) * 11 + gauss(x, y, 33, 43, 5.5) * 9 + gauss(x, y, 30, 62, 5) * 6
  // 东侧山
  h += ss(90, 100, x) * (10 + n * 8)
  // 赤铁矿岭：一簇岩丘
  h += gauss(x, y, 80, 85, 5) * 8 + gauss(x, y, 66, 88, 4) * 5 + gauss(x, y, 76, 74, 4) * 5
  // 凌云台：孤立石台
  h += gauss(x, y, 50, 30, 7) * 3
  // 据点台地整平
  for (const node of WARFRONT_NODES) {
    const pl = PLATEAUS[node.key]
    if (!pl) continue
    const d = Math.hypot(x - node.position.x, y - node.position.y)
    const w = 1 - ss(pl.r * 0.7, pl.r * 1.3, d)
    if (w > 0) h = h + (pl.elev - h) * w
  }
  // 我方营地
  { const d = Math.hypot(x - 50, y - 94); const w = 1 - ss(5, 9, d); if (w > 0) h = h * (1 - w) }
  // 驿道压平
  const rd = roadDist({ x, y })
  if (rd < 2.2) h = h + (Math.min(h, h * 0.6 + 0.4) - h) * (1 - ss(1, 2.2, rd))
  // 溪流与湖下切
  const sd = polyDist({ x, y }, STREAM)
  if (sd < 3) h = h + (-0.9 - h) * (1 - ss(1, 3, sd))
  const ld = Math.hypot(x - LAKE.x, y - LAKE.y)
  if (ld < LAKE.r + 3) h = h + (-1.2 - h) * (1 - ss(LAKE.r - 1, LAKE.r + 3, ld))
  return h
}

const FLAG_VERT = `uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; float w = uv.x; p.z += sin(uv.x * 6.0 - uTime * 5.0) * 0.35 * w; p.y += sin(uv.x * 4.0 - uTime * 4.0) * 0.12 * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`
const FLAG_FRAG = `uniform vec3 uColor; varying vec2 vUv; void main(){ float shade = 0.8 + 0.2 * sin(vUv.x * 6.0); vec3 c = uColor * shade; if (vUv.y > 0.82 || vUv.y < 0.18) c = mix(c, vec3(0.94,0.84,0.55), 0.7); gl_FragColor = vec4(c, 1.0); }`
const ROAD_FRAG = `uniform float uTime; varying vec2 vUv; void main(){ float d = fract(vUv.x * 0.5 - uTime * 0.35); float dash = smoothstep(0.0, 0.1, d) * (1.0 - smoothstep(0.45, 0.55, d)); float edge = 1.0 - smoothstep(0.25, 0.5, abs(vUv.y - 0.5)); gl_FragColor = vec4(vec3(0.95,0.82,0.5), dash * edge * 0.85); }`
const WATER_FRAG = `uniform float uTime; varying vec2 vUv; void main(){ float w = sin(vUv.x * 18.0 + uTime * 1.5) * sin(vUv.y * 14.0 - uTime * 1.1); vec3 c = mix(vec3(0.16,0.42,0.46), vec3(0.55,0.83,0.78), 0.35 + w * 0.15); gl_FragColor = vec4(c, 0.88); }`
const BASIC_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`

const PITCH = 66
const RELATION_COLOR: Record<Relation, string> = { mine: '#3fbfa9', rival: '#d65a48', neutral: '#d8b168' }

interface Marker { group: THREE.Group; flag: THREE.ShaderMaterial; ring: THREE.Mesh; disc: THREE.Mesh }

let mapTerrainCache: { ys: Float32Array; colors: Float32Array } | null = null

export class WarfrontWorld {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(38, 1.2, 1, 800)
  private clock = new THREE.Clock()
  private raf = 0
  private disposed = false
  private time = { value: 0 }
  private markers = new Map<string, Marker>()
  private selected = ''
  private intro = 0
  private mists: THREE.Sprite[] = []
  private clouds: { s: THREE.Sprite; x0: number; speed: number }[] = []
  onProjectionChange: (() => void) | null = null

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color('#122930')
    this.scene.fog = new THREE.Fog('#122930', 150, 260)
    this.scene.add(new THREE.HemisphereLight('#d8efe6', '#2a3a30', 1.1))
    const sun = new THREE.DirectionalLight('#fff0cf', 2.2)
    sun.position.set(-50, 80, -30)
    this.scene.add(sun)
    this.buildTerrain()
    this.buildWater()
    this.buildRoads()
    this.buildMarkers()
    this.buildAtmosphere()
    this.resize()
    this.loop()
  }

  /** 地图 % 坐标 → 画布内百分比（DOM 覆盖层用） */
  project(p: Pt, cam: THREE.Camera = this.finalCam): Pt {
    const w = toWorld(p)
    const v = new THREE.Vector3(w.x, mapHeight(p.x, p.y), w.z).project(cam)
    return { x: (v.x + 1) * 50, y: (1 - v.y) * 50 }
  }

  setNodes(nodes: { key: string; relation: Relation }[], selected: string) {
    this.selected = selected
    for (const n of nodes) {
      const m = this.markers.get(n.key)
      if (!m) continue
      const c = new THREE.Color(RELATION_COLOR[n.relation])
      ;(m.flag.uniforms.uColor.value as THREE.Color).copy(c)
      ;(m.disc.material as THREE.MeshBasicMaterial).color.copy(c)
      ;(m.disc.material as THREE.MeshBasicMaterial).opacity = n.relation === 'neutral' ? 0.1 : 0.26
    }
  }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // 以据点范围取景：逐步拉远直到所有据点（留边距）都落在画内
    const pitch = THREE.MathUtils.degToRad(PITCH)
    const target = new THREE.Vector3(0, 0, 0)
    let d = 60
    const pts = [...WARFRONT_NODES.map(n => n.position), { x: 50, y: 96 }]
    for (let i = 0; i < 40; i++) {
      this.camera.position.set(0, Math.sin(pitch) * d, target.z + Math.cos(pitch) * d)
      this.camera.lookAt(target); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld()
      const ok = pts.every(p => { const q = this.project(p, this.camera); return q.x > 10 && q.x < 90 && q.y > 16 && q.y < 92 })
      if (ok) break
      d += 6
    }
    this.baseDist = d
    ;(this.scene.fog as THREE.Fog).near = d * 1.1
    ;(this.scene.fog as THREE.Fog).far = d * 2.6
    this.finalCam = this.camera.clone()
    this.onProjectionChange?.()
  }
  private baseDist = 100
  /** 取景完成后的镜头快照：覆盖层投影只认它，不受开场运镜影响 */
  private finalCam = new THREE.PerspectiveCamera()

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.scene.traverse(o => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose()
    })
    this.renderer.dispose()
  }

  private buildTerrain() {
    const seg = 150, size = 150
    const geo = new THREE.PlaneGeometry(size * S, size * S, seg, seg)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    // 地形计算较重（每顶点多次采样高度），切页签回来时直接复用
    const cached = mapTerrainCache
    const colors = cached?.colors ?? new Float32Array(pos.count * 3)
    if (cached) (pos.array as Float32Array).set(cached.ys)
    else {
    const grass = new THREE.Color('#5d8a5a'), grass2 = new THREE.Color('#86ad6a'), dry = new THREE.Color('#a39a68')
    const rockLow = new THREE.Color('#6f5a42'), jade = new THREE.Color('#3f8a80'), jadeTop = new THREE.Color('#90cdb8'), blue = new THREE.Color('#2f566c')
    const redRock = new THREE.Color('#9a4a36'), redTop = new THREE.Color('#c9774f'), road = new THREE.Color('#c8b58a')
    const fieldA = new THREE.Color('#9cc46a'), fieldB = new THREE.Color('#d8c97a')
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const mx = pos.getX(i) / S + 50, my = pos.getZ(i) / S + 50
      const h = mapHeight(mx, my)
      pos.setY(i, h)
      const n = fbm(mx * 0.12, my * 0.12)
      c.copy(grass).lerp(grass2, n).lerp(dry, ss(0.6, 0.9, fbm(mx * 0.05 + 9, my * 0.05)) * 0.5)
      // 药圃梯田：条带色块
      const fd = Math.hypot(mx - 78, my - 52)
      if (fd < 11) { const band = Math.floor((my + mx * 0.3) / 2.2) % 2 ? fieldA : fieldB; c.lerp(band, (1 - ss(8, 11, fd)) * 0.8) }
      const k = ss(3, 20, h + fbm(mx * 0.3, my * 0.3) * 4)
      if (k > 0) {
        const red = gauss(mx, my, 76, 83, 9)
        const m = new THREE.Color().copy(rockLow).lerp(blue, ss(0, 0.45, k)).lerp(jade, ss(0.35, 0.7, k)).lerp(jadeTop, ss(0.75, 1, k))
        m.lerp(new THREE.Color().copy(redRock).lerp(redTop, k), Math.min(1, red * 1.6))
        m.multiplyScalar(0.85 + fbm(mx * 0.7, my * 0.7) * 0.3)
        c.lerp(m, ss(0, 0.25, k))
      }
      const rd = roadDist({ x: mx, y: my })
      if (rd < 1.4) c.lerp(road, 1 - ss(0.8, 1.4, rd))
      // 地图边缘压暗成「纸边」
      const edge = Math.max(Math.abs(mx - 50), Math.abs(my - 50))
      c.multiplyScalar(1 - ss(46, 62, edge) * 0.55)
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    }
    mapTerrainCache = { ys: Float32Array.from(pos.array as Float32Array), colors }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })))
  }

  private buildWater() {
    const mat = new THREE.ShaderMaterial({ uniforms: { uTime: this.time }, vertexShader: BASIC_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r * S * 1.05, 48), mat)
    const lw = toWorld(LAKE)
    lake.rotation.x = -Math.PI / 2
    lake.position.set(lw.x, -0.35, lw.z)
    this.scene.add(lake)
    const curve = new THREE.CatmullRomCurve3(STREAM.map(p => { const w = toWorld(p); return new THREE.Vector3(w.x, -0.3, w.z) }))
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 1.3, 6, false), mat)
    tube.scale.y = 0.2
    tube.position.y = -0.2
    this.scene.add(tube)
  }

  /** 驿道：沿地形起伏的流光虚线 */
  private buildRoads() {
    const mat = new THREE.ShaderMaterial({ uniforms: { uTime: this.time }, vertexShader: BASIC_VERT, fragmentShader: ROAD_FRAG, transparent: true, depthWrite: false })
    for (const [a, b] of ROAD_LINES) {
      const N = 40, verts: number[] = [], uvs: number[] = [], idx: number[] = []
      const wa = toWorld(a), wb = toWorld(b)
      const len = Math.hypot(wb.x - wa.x, wb.z - wa.z)
      const nx = -(wb.z - wa.z) / len, nz = (wb.x - wa.x) / len
      for (let i = 0; i <= N; i++) {
        const t = i / N, mx = a.x + (b.x - a.x) * t, my = a.y + (b.y - a.y) * t
        const w = toWorld({ x: mx, y: my }), h = Math.max(mapHeight(mx, my), -0.2) + 0.25
        verts.push(w.x + nx * 0.9, h, w.z + nz * 0.9, w.x - nx * 0.9, h, w.z - nz * 0.9)
        uvs.push(t * len / 3, 0, t * len / 3, 1)
        if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      geo.setIndex(idx)
      const mesh = new THREE.Mesh(geo, mat); mesh.material.side = THREE.DoubleSide
      this.scene.add(mesh)
    }
  }

  /** 据点：石台 + 旗杆 + 随风飘动的阵营旗 + 领地光盘 + 选中光环 */
  private buildMarkers() {
    const stone = new THREE.MeshLambertMaterial({ color: '#b9bcb0' }), stoneDark = new THREE.MeshLambertMaterial({ color: '#7e847c' }), pole = new THREE.MeshLambertMaterial({ color: '#6e4430' })
    for (const node of WARFRONT_NODES) {
      const w = toWorld(node.position), h = mapHeight(node.position.x, node.position.y)
      const g = new THREE.Group()
      g.position.set(w.x, h, w.z)
      const core = node.kind === '核心据点'
      const base = new THREE.Mesh(new THREE.CylinderGeometry(core ? 4.2 : 3.2, core ? 4.8 : 3.8, 1.2, 8), stoneDark)
      base.position.y = 0.6
      const top = new THREE.Mesh(new THREE.CylinderGeometry(core ? 3.4 : 2.6, core ? 4.2 : 3.2, 0.9, 8), stone)
      top.position.y = 1.6
      g.add(base, top)
      if (core || node.kind === '遗迹' || node.kind === '关隘') {
        // 城楼 / 石阙：两座方塔 + 顶
        for (const s of [-1, 1]) {
          const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, core ? 4.2 : 3, 1.4), stone)
          tower.position.set(s * 1.8, 2 + (core ? 2.1 : 1.5), 0)
          const cap = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.2, 4), new THREE.MeshLambertMaterial({ color: '#2f4a55' }))
          cap.position.set(s * 1.8, 2 + (core ? 4.8 : 3.6), 0); cap.rotation.y = Math.PI / 4
          g.add(tower, cap)
        }
      }
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 6), pole)
      pl.position.set(0, 5.4, 0)
      g.add(pl)
      const flagMat = new THREE.ShaderMaterial({ uniforms: { uTime: this.time, uColor: { value: new THREE.Color(RELATION_COLOR.neutral) } }, vertexShader: FLAG_VERT, fragmentShader: FLAG_FRAG, side: THREE.DoubleSide })
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2, 12, 2), flagMat)
      flag.geometry.translate(1.7, 0, 0)
      flag.position.set(0.1, 7.8, 0)
      g.add(flag)
      const disc = new THREE.Mesh(new THREE.CircleGeometry(core ? 12 : 9, 40), new THREE.MeshBasicMaterial({ color: RELATION_COLOR.neutral, transparent: true, opacity: 0.1, depthWrite: false }))
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.15
      g.add(disc)
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.2, 48), new THREE.MeshBasicMaterial({ color: '#ffe7a8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }))
      ring.rotation.x = -Math.PI / 2; ring.position.y = 2.2
      g.add(ring)
      this.scene.add(g)
      this.markers.set(node.key, { group: g, flag: flagMat, ring, disc })
    }
    // 我方营地：帐篷
    const camp = toWorld({ x: 50, y: 94 })
    for (const [dx, dz] of [[-2.4, 0], [2.4, 0.6], [0, -2]]) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.4, 4), new THREE.MeshLambertMaterial({ color: '#e2d5b6' }))
      tent.position.set(camp.x + dx, 1.2, camp.z + dz); tent.rotation.y = Math.PI / 4
      this.scene.add(tent)
    }
  }

  private buildAtmosphere() {
    const loader = new THREE.TextureLoader()
    const cloudTex = cloudTexture(5)
    // 林地：成片松林，避开驿道、据点、湖与溪
    const pine = loader.load(sprite('scene/pine.svg')); pine.colorSpace = THREE.SRGBColorSpace
    const pineDark = loader.load(sprite('scene/pine-dark.svg')); pineDark.colorSpace = THREE.SRGBColorSpace
    const pm = [new THREE.SpriteMaterial({ map: pine, alphaTest: 0.35 }), new THREE.SpriteMaterial({ map: pineDark, alphaTest: 0.35 })]
    let sd = 11
    const r = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646 }
    const groves: [number, number, number, number][] = [[36, 24, 7, 16], [64, 24, 7, 16], [40, 66, 6, 12], [60, 64, 6, 12], [90, 36, 6, 12], [8, 84, 6, 10], [88, 96, 6, 10], [14, 96, 6, 10], [62, 42, 4, 8], [22, 30, 5, 10]]
    for (const [gx, gy, rad, n] of groves) for (let i = 0; i < n; i++) {
      const x = gx + (r() - 0.5) * rad * 2, y = gy + (r() - 0.5) * rad * 2
      if (roadDist({ x, y }) < 3 || polyDist({ x, y }, STREAM) < 3 || Math.hypot(x - LAKE.x, y - LAKE.y) < LAKE.r + 2) continue
      if (WARFRONT_NODES.some(nd => Math.hypot(x - nd.position.x, y - nd.position.y) < 7)) continue
      const h = mapHeight(x, y), w = toWorld({ x, y })
      const sp = new THREE.Sprite(pm[h > 4 ? 1 : 0]); const k = 3 + r() * 1.6
      sp.scale.set(k, k * 1.18, 1); sp.center.set(0.5, 0.05); sp.position.set(w.x, h - 0.1, w.z)
      this.scene.add(sp)
    }
    // 迷雾关：常驻雾团
    const mg = WARFRONT_NODES.find(n => n.key === 'mist-gate')!.position
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.35, depthWrite: false }))
      const w = toWorld({ x: mg.x - 8 + i * 4, y: mg.y - 4 + (i % 2) * 6 })
      s.position.set(w.x, 4 + i * 0.6, w.z); s.scale.set(14, 4.4, 1)
      this.mists.push(s); this.scene.add(s)
    }
    // 高空云影
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.4, depthWrite: false }))
      const x0 = -80 + i * 38
      s.position.set(x0, 26 + (i % 2) * 6, -40 + i * 18); s.scale.set(34, 11, 1)
      this.clouds.push({ s, x0, speed: 1.2 + (i % 3) * 0.4 }); this.scene.add(s)
    }
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime
    this.time.value = t
    // 开场：镜头从高处俯冲落到取景位置（覆盖层投影以最终位置为准，开场期间由 CSS 淡入）
    this.intro = Math.min(1, this.intro + dt / 1.4)
    const e = 1 - Math.pow(1 - this.intro, 3)
    const pitch = THREE.MathUtils.degToRad(PITCH + (1 - e) * 14), d = this.baseDist * (1 + (1 - e) * 0.5)
    this.camera.position.set(0, Math.sin(pitch) * d, Math.cos(pitch) * d)
    this.camera.lookAt(0, 0, 0)
    for (const [key, m] of this.markers) {
      const mat = m.ring.material as THREE.MeshBasicMaterial
      const sel = key === this.selected
      mat.opacity += ((sel ? 0.55 + Math.sin(t * 4) * 0.3 : 0) - mat.opacity) * 0.15
      m.ring.scale.setScalar(sel ? 1 + Math.sin(t * 4) * 0.06 : 1)
    }
    this.mists.forEach((s, i) => { s.material.opacity = 0.28 + Math.sin(t * 0.6 + i) * 0.1; s.position.x += Math.sin(t * 0.3 + i) * 0.01 })
    for (const c of this.clouds) c.s.position.x = ((c.x0 + t * c.speed + 110) % 220) - 110
    this.renderer.render(this.scene, this.camera)
  }
}
