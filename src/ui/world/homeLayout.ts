// 洞府 3D 场景的空间规划（世界坐标，y 向上，z 越小越远）。
// 布局讲「合理」：洞府凿在后山山脚；河从后山左侧瀑布落下、沿左岸流出；灵田傍河取水；
// 炼丹房挨着灵田取药；矿脉嵌在右侧山体、炼器阁就近取矿；坊市与宗门大殿守在入口大道两侧。
import type { BuildingKey } from '../../game/types'

export interface Plot {
  /** 地块中心 */
  x: number
  z: number
  /** DOM 建筑图在世界里的宽度（决定屏幕上的像素宽） */
  size: number
  /** 地块整平后的高度（台地） */
  elev: number
  /** 整平半径 */
  r: number
}

export const PLOTS: Record<BuildingKey, Plot> = {
  // 后排：山脚台地
  dongfu: { x: 3, z: -50, size: 30, elev: 3.2, r: 11 },
  cangjing: { x: -15, z: -38, size: 17, elev: 1.6, r: 8 },
  juling: { x: 22, z: -36, size: 19, elev: 1.6, r: 9 },
  // 中排：灵田贴河取水、炼丹房挨着灵田、矿脉嵌进右山
  lingtian: { x: -17, z: -16, size: 20, elev: 0, r: 9.5 },
  liandan: { x: 2, z: -21, size: 16, elev: 0.4, r: 7.5 },
  kuangmai: { x: 25, z: -14, size: 22, elev: 0.6, r: 9 },
  // 前排
  yanwu: { x: -17, z: 7, size: 20, elev: 0.2, r: 9.5 },
  lianqi: { x: 20, z: 8, size: 18, elev: 0.3, r: 8.5 },
  zongmen: { x: -12, z: 31, size: 24, elev: 0.8, r: 11 },
  fangshi: { x: 18, z: 31, size: 19, elev: 0.2, r: 9 },
}

/** 河道中心线（从后山瀑布脚下流到左前方出画） */
export const RIVER: [number, number][] = [
  [-26, -62], [-28, -52], [-31, -40], [-33, -27], [-31, -14], [-30, -2], [-33, 12], [-37, 26], [-43, 40], [-50, 56],
]
export const RIVER_HALF_WIDTH = 3.2

/** 石板道：入口大道直通洞府，再分岔到各建筑 */
export const ROADS: [number, number][][] = [
  [[1, 70], [2, 46], [3, 22], [2, 0], [2, -30], [3, -40]],
  [[2, 36], [-4, 34]],
  [[2, 34], [10, 33]],
  [[2, 12], [-8, 10]],
  [[2, 12], [12, 10]],
  [[2, -12], [-8, -14]],
  [[2, -10], [16, -13]],
  [[2, -34], [-8, -37]],
  [[3, -34], [14, -35]],
]

function segDist(px: number, pz: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t))
}
export function polyDist(px: number, pz: number, line: [number, number][]) {
  let d = Infinity
  for (let i = 0; i < line.length - 1; i++) d = Math.min(d, segDist(px, pz, line[i], line[i + 1]))
  return d
}
export const riverDist = (x: number, z: number) => polyDist(x, z, RIVER)
export const roadDist = (x: number, z: number) => Math.min(...ROADS.map(r => polyDist(x, z, r)))

// ── 地形高度 ──
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s) }
function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export const fbm = (x: number, z: number) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.17
const ss = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
const gauss = (x: number, z: number, cx: number, cz: number, s: number) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s))

/** 未整平的自然地形 */
function natural(x: number, z: number) {
  const n = fbm(x * 0.06, z * 0.06)
  let h = (fbm(x * 0.15, z * 0.15) - 0.5) * 0.9
  // 后山：层叠峰峦，洞府正后方主峰
  h += ss(-54, -72, z) * (22 + n * 22)
  h += gauss(x, z, 5, -70, 13) * 26
  h += gauss(x, z, -24, -68, 10) * 18
  h += gauss(x, z, 30, -64, 11) * 18
  // 左右山体
  h += ss(-40, -58, x) * (16 + n * 18)
  h += ss(36, 52, x) * (18 + n * 16)
  // 矿脉背靠的右山余脉
  h += gauss(x, z, 40, -18, 9) * 15
  // 前景低丘
  h += ss(44, 62, z) * 4 * n
  return h
}

export function heightAt(x: number, z: number) {
  let h = natural(x, z)
  // 地块整平（台地）
  for (const p of Object.values(PLOTS)) {
    const d = Math.hypot(x - p.x, z - p.z)
    const w = 1 - ss(p.r * 0.75, p.r * 1.35, d)
    if (w > 0) h = h + (p.elev - h) * w
  }
  // 路面压平
  const rd = roadDist(x, z)
  if (rd < 3) h = h + (Math.min(h, 1.2) - h) * (1 - ss(1.2, 3, rd))
  // 河道下切
  const d = riverDist(x, z)
  if (d < RIVER_HALF_WIDTH + 3) h = h + (-1.6 - h) * (1 - ss(RIVER_HALF_WIDTH - 0.8, RIVER_HALF_WIDTH + 3, d))
  return h
}
