// 矢量美术的共用底座：统一色板 + 等距投影 + SVG 拼装。
// 所有素材都从这里取色，保证「青绿山水 · 描金」一个风格到底，不再各画各的。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets/sprites')

/** 色板：墨、青绿、石青、赭木、朱砂、金、宣纸。新素材只准从这里取色。 */
export const C = {
  line: '#1b2229',      // 描边墨线
  ink: '#16202a',
  ink2: '#22313d',
  ink3: '#34475a',
  jade0: '#1f5a57', jade1: '#2f7f78', jade2: '#4fb3a4', jade3: '#8fd9c8', jade4: '#d4f5ec',
  blue0: '#1f3f5b', blue1: '#2e5a7a', blue2: '#4a86a8', blue3: '#8dbad2',
  tile0: '#23363f', tile1: '#2f4a55', tile2: '#436773', tile3: '#6a909a',  // 青瓦
  wood0: '#4a2e22', wood1: '#6e4430', wood2: '#96603f', wood3: '#c08a5c',
  red0: '#6e2323', red1: '#9c3a30', red2: '#c65440', red3: '#e7836a',       // 朱砂
  gold0: '#8a6a34', gold1: '#b98f4a', gold2: '#d8b168', gold3: '#f0d596', gold4: '#fff1c9',
  stone0: '#4b5055', stone1: '#6c7176', stone2: '#8f9497', stone3: '#b9bcb8', stone4: '#dcdcd2',
  paper0: '#c9b996', paper1: '#e2d5b6', paper2: '#f3ead4',
  grass0: '#2f4f3a', grass1: '#3f6a45', grass2: '#5b8a55', grass3: '#86b36e', grass4: '#b9d98f',
  fire0: '#a8391f', fire1: '#e0672d', fire2: '#f5a340', fire3: '#ffe08a',
  purple0: '#3b2a55', purple1: '#5d4386', purple2: '#8a6bc0', purple3: '#c6b0f0',
  skin: '#f1d6bd', skin2: '#d9b294',
}

export const f = n => Math.round(n * 10) / 10

/** 收集图元并自动算包围盒，输出紧贴内容的 viewBox（场景里建筑按底边中点落地，留白会让它“飘”） */
export class Canvas {
  constructor() { this.parts = []; this.defs = []; this.minX = Infinity; this.minY = Infinity; this.maxX = -Infinity; this.maxY = -Infinity }
  track(x, y) { if (x < this.minX) this.minX = x; if (y < this.minY) this.minY = y; if (x > this.maxX) this.maxX = x; if (y > this.maxY) this.maxY = y }
  add(s, pts = []) { this.parts.push(s); for (const [x, y] of pts) this.track(x, y); return this }
  def(s) { this.defs.push(s); return this }
  poly(pts, fill, extra = '') { return this.add(`<path d="M${pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L')}Z" fill="${fill}" ${extra}/>`, pts) }
  path(d, attrs, bbox = []) {
    // 纯绝对坐标的路径自动计入包围盒（含相对指令的无法静态求点，需调用方显式传 bbox）
    if (!bbox.length && !/[a-df-z]/.test(d)) {
      const nums = d.replace(/[A-Z]/g, ' ').trim().split(/[\s,]+/).map(Number)
      if (!/[HV]/.test(d)) for (let i = 0; i + 1 < nums.length; i += 2) bbox.push([nums[i], nums[i + 1]])
    }
    return this.add(`<path d="${d}" ${attrs}/>`, bbox)
  }
  circle(x, y, r, attrs) { return this.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" ${attrs}/>`, [[x - r, y - r], [x + r, y + r]]) }
  ellipse(x, y, rx, ry, attrs) { return this.add(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" ${attrs}/>`, [[x - rx, y - ry], [x + rx, y + ry]]) }
  /** mirror=true 时整体水平翻转（兵种统一朝右、妖兽统一朝左，战斗场景里面对面） */
  toString(pad = 4, fixed = null, mirror = false) {
    const vb = fixed ?? [f(this.minX - pad), f(this.minY - pad), f(this.maxX - this.minX + pad * 2), f(this.maxY - this.minY + pad * 2)]
    const body = mirror ? `<g transform="matrix(-1 0 0 1 ${f(vb[0] * 2 + vb[2])} 0)">${this.parts.join('')}</g>` : this.parts.join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}">${this.defs.length ? `<defs>${this.defs.join('')}</defs>` : ''}${body}</svg>`
  }
}

export function save(rel, svg) {
  const out = resolve(ROOT, rel)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, String(svg).replace(/\s+\/>/g, '/>'))
}

// ── 等距投影：x 向右下、y 向左下、z 向上。可见面为顶面、y=max 面（左）、x=max 面（右）──
const K = 0.866
export const iso = (x, y, z = 0) => [(x - y) * K, (x + y) * 0.5 - z]
export const P = pts => pts.map(p => iso(...p))

const LW = 'stroke="#1b2229" stroke-width="1.6" stroke-linejoin="round"'
export const STROKE = LW

/** 长方体：t/l/r 分别是顶面、左面、右面颜色 */
export function box(cv, { x, y, z = 0, w, d, h, t, l, r, stroke = true }) {
  const s = stroke ? LW : ''
  cv.poly(P([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]), l, s)
  cv.poly(P([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]), r, s)
  cv.poly(P([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), t, s)
}

/** 在盒子左面（y=max）上画矩形：u 沿 x 方向 0..1，v 沿高度 0..1 */
export function onL(cv, b, u0, u1, v0, v1, fill, extra = LW) {
  const y = b.y + b.d, z = b.z ?? 0
  cv.poly(P([[b.x + b.w * u0, y, z + b.h * v0], [b.x + b.w * u1, y, z + b.h * v0], [b.x + b.w * u1, y, z + b.h * v1], [b.x + b.w * u0, y, z + b.h * v1]]), fill, extra)
}
/** 在盒子右面（x=max）上画矩形：u 沿 y 方向 0..1 */
export function onR(cv, b, u0, u1, v0, v1, fill, extra = LW) {
  const x = b.x + b.w, z = b.z ?? 0
  cv.poly(P([[x, b.y + b.d * u0, z + b.h * v0], [x, b.y + b.d * u1, z + b.h * v0], [x, b.y + b.d * u1, z + b.h * v1], [x, b.y + b.d * u0, z + b.h * v1]]), fill, extra)
}
/** 左/右面上的圆拱门 */
export function archL(cv, b, uc, uw, vh, fill) {
  const y = b.y + b.d, z = b.z ?? 0, x0 = b.x + b.w * (uc - uw / 2), x1 = b.x + b.w * (uc + uw / 2)
  const [ax, ay] = iso(x0, y, z), [bx, by] = iso(x1, y, z), [cx, cy] = iso(x1, y, z + b.h * vh), [dx, dy] = iso(x0, y, z + b.h * vh)
  const [mx, my] = iso((x0 + x1) / 2, y, z + b.h * vh + (x1 - x0) * 0.55)
  cv.path(`M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}L${f(cx)} ${f(cy)}Q${f(mx + (cx - dx) * 0)} ${f(my)} ${f(dx)} ${f(dy)}Z`, `fill="${fill}" ${LW}`, [[ax, ay], [bx, by], [mx, my]])
}
export function archR(cv, b, uc, uw, vh, fill) {
  const x = b.x + b.w, z = b.z ?? 0, y0 = b.y + b.d * (uc - uw / 2), y1 = b.y + b.d * (uc + uw / 2)
  const [ax, ay] = iso(x, y0, z), [bx, by] = iso(x, y1, z), [cx, cy] = iso(x, y1, z + b.h * vh), [dx, dy] = iso(x, y0, z + b.h * vh)
  const [mx, my] = iso(x, (y0 + y1) / 2, z + b.h * vh + (y1 - y0) * 0.55)
  cv.path(`M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}L${f(cx)} ${f(cy)}Q${f(mx)} ${f(my)} ${f(dx)} ${f(dy)}Z`, `fill="${fill}" ${LW}`, [[ax, ay], [bx, by], [mx, my]])
}

/**
 * 中式屋顶（庑殿式）：底边外挑 o，檐口两端上翘 lift、中段下垂，这是一眼认出「中式」的关键曲线。
 * 屋脊两端加鸱吻小卷。colors: [前坡, 侧坡, 后坡, 屋脊]
 */
export function roof(cv, { x, y, z, w, d, h, o = 6, lift = 5, ridge = 0.35, colors, gold = false }) {
  const X0 = x - o, X1 = x + w + o, Y0 = y - o, Y1 = y + d + o
  const along = w >= d
  const Ym = (Y0 + Y1) / 2, Xm = (X0 + X1) / 2
  // 屋脊两端
  const R0 = along ? [X0 + (X1 - X0) * ridge * 0.5, Ym, z + h] : [Xm, Y0 + (Y1 - Y0) * ridge * 0.5, z + h]
  const R1 = along ? [X1 - (X1 - X0) * ridge * 0.5, Ym, z + h] : [Xm, Y1 - (Y1 - Y0) * ridge * 0.5, z + h]
  const c00 = [X0, Y0, z + lift], c10 = [X1, Y0, z + lift], c11 = [X1, Y1, z + lift], c01 = [X0, Y1, z + lift]
  const [front, side, back, ridgeC] = colors
  const eave = (a, b, sag = 1) => {
    const [ax, ay] = iso(...a), [bx, by] = iso(...b)
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z - lift * 0.35 * sag]
    const [mx, my] = iso(...m)
    // 二次曲线控制点 = 2*mid - (a+b)/2，使曲线真正经过下垂的中点
    return { ax, ay, bx, by, qx: 2 * mx - (ax + bx) / 2, qy: 2 * my - (ay + by) / 2 }
  }
  const face = (pts4or3, e, fill) => {
    // pts: [eaveA, eaveB, ...ridge points]，第一条边走曲线
    const rest = pts4or3.slice(2).map(p => iso(...p))
    const d = `M${f(e.ax)} ${f(e.ay)}Q${f(e.qx)} ${f(e.qy)} ${f(e.bx)} ${f(e.by)}${rest.map(([px, py]) => `L${f(px)} ${f(py)}`).join('')}Z`
    cv.path(d, `fill="${fill}" ${LW}`, [[e.ax, e.ay], [e.bx, e.by], [e.qx, e.qy], ...rest])
  }
  if (along) {
    face([c10, c00, R0, R1], eave(c10, c00), back)            // 后坡（y=min）
    face([c00, c01, R0], eave(c00, c01), back)                 // 西侧三角
    face([c01, c11, R1, R0], eave(c01, c11), front)            // 前坡（左可见）
    face([c11, c10, R1], eave(c11, c10), side)                 // 东侧三角（右可见）
  } else {
    face([c00, c01, R0], eave(c00, c01), back)
    face([c10, c00, R0, R1], eave(c10, c00), back)
    face([c11, c10, R1, R0], eave(c11, c10), side)             // 东坡（右可见）
    face([c01, c11, R1, R0], eave(c01, c11), front)            // 南侧三角（左可见）
  }
  // 瓦垄：前坡上几道细线，给屋面一点材质
  const rows = 5
  for (let i = 1; i < rows; i++) {
    const t = i / rows
    if (along) {
      const a = iso(X0 + (X1 - X0) * t, Y1, z + lift * 0.4), b = iso(R0[0] + (R1[0] - R0[0]) * t, Ym, z + h)
      cv.path(`M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`, `stroke="${C.line}" stroke-opacity=".28" stroke-width="1"`)
    } else {
      const a = iso(X1, Y0 + (Y1 - Y0) * t, z + lift * 0.4), b = iso(Xm, R0[1] + (R1[1] - R0[1]) * t, z + h)
      cv.path(`M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`, `stroke="${C.line}" stroke-opacity=".28" stroke-width="1"`)
    }
  }
  // 屋脊 + 鸱吻
  const [r0x, r0y] = iso(...R0), [r1x, r1y] = iso(...R1)
  cv.path(`M${f(r0x)} ${f(r0y)}L${f(r1x)} ${f(r1y)}`, `stroke="${C.line}" stroke-width="4.2" stroke-linecap="round"`)
  cv.path(`M${f(r0x)} ${f(r0y)}L${f(r1x)} ${f(r1y)}`, `stroke="${ridgeC}" stroke-width="2" stroke-linecap="round"`)
  const curl = (px, py, dir) => cv.path(`M${f(px)} ${f(py)}q${f(dir * 2)} -6 ${f(dir * 6)} -7q${f(-dir * 1)} 3 ${f(-dir * 1.5)} 5`, `fill="none" stroke="${gold ? C.gold2 : ridgeC}" stroke-width="2.2" stroke-linecap="round"`, [[px, py - 8]])
  curl(r0x, r0y, -1); curl(r1x, r1y, 1)
  // 檐口金边：可见两条檐的高光线
  const e1 = along ? eave(c01, c11) : eave(c11, c10), e2 = along ? eave(c11, c10) : eave(c01, c11)
  for (const e of [e1, e2]) cv.path(`M${f(e.ax)} ${f(e.ay)}Q${f(e.qx)} ${f(e.qy)} ${f(e.bx)} ${f(e.by)}`, `fill="none" stroke="${gold ? C.gold2 : C.tile3}" stroke-width="1.3" stroke-opacity=".9" transform="translate(0 -1.6)"`)
}

/** 等距椭圆（地面上的圆）：返回 path d */
export function isoEllipse(cx, cy, z, r, n = 48) {
  const pts = []
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(iso(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)) }
  return pts
}

/** 松树：三层扁平松冠，古画里的「松」 */
export function pine(cv, x, y, s = 1, dark = false) {
  const [px, py] = iso(x, y, 0)
  const trunk = `M${f(px - 2 * s)} ${f(py)}C${f(px - 1 * s)} ${f(py - 14 * s)} ${f(px + 4 * s)} ${f(py - 22 * s)} ${f(px + 1 * s)} ${f(py - 34 * s)}L${f(px + 4 * s)} ${f(py - 34 * s)}C${f(px + 7 * s)} ${f(py - 22 * s)} ${f(px + 3 * s)} ${f(py - 12 * s)} ${f(px + 3 * s)} ${f(py)}Z`
  cv.path(trunk, `fill="${C.wood1}" ${LW}`, [[px - 3 * s, py], [px + 6 * s, py - 34 * s]])
  const tiers = [[-2, -30, 16, 7], [4, -40, 13, 6], [0, -49, 9, 5]]
  tiers.forEach(([dx, dy, rx, ry], i) => {
    const cx = px + dx * s, cy = py + dy * s
    cv.path(`M${f(cx - rx * s)} ${f(cy + ry * 0.4 * s)}Q${f(cx - rx * 0.6 * s)} ${f(cy - ry * s)} ${f(cx)} ${f(cy - ry * 1.1 * s)}Q${f(cx + rx * 0.7 * s)} ${f(cy - ry * s)} ${f(cx + rx * s)} ${f(cy + ry * 0.4 * s)}Q${f(cx)} ${f(cy + ry * 0.9 * s)} ${f(cx - rx * s)} ${f(cy + ry * 0.4 * s)}Z`,
      `fill="${dark ? C.grass0 : [C.grass1, C.grass2, C.grass2][i]}" ${LW}`, [[cx - rx * s, cy - ry * 1.2 * s], [cx + rx * s, cy + ry * s]])
    cv.path(`M${f(cx - rx * 0.5 * s)} ${f(cy - ry * 0.35 * s)}Q${f(cx)} ${f(cy - ry * 0.85 * s)} ${f(cx + rx * 0.35 * s)} ${f(cy - ry * 0.5 * s)}`, `fill="none" stroke="${C.grass4}" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"`)
  })
}

/** 圆冠树 / 灌木 */
export function bush(cv, x, y, s = 1, col = [C.grass1, C.grass2, C.grass3]) {
  const [px, py] = iso(x, y, 0)
  cv.ellipse(px, py, 10 * s, 4 * s, `fill="#000" fill-opacity=".18"`)
  cv.circle(px - 5 * s, py - 6 * s, 7 * s, `fill="${col[0]}" ${LW}`)
  cv.circle(px + 5 * s, py - 7 * s, 7.5 * s, `fill="${col[1]}" ${LW}`)
  cv.circle(px, py - 12 * s, 7 * s, `fill="${col[2]}" ${LW}`)
}

/** 平面岩石块（等距多边形）：用于洞府、矿脉的山体 */
export function rock(cv, pts, cols = [C.stone1, C.stone2, C.stone3]) {
  cv.poly(pts, cols[0], LW)
}

/** 放射光晕 defs */
export function glow(id, color, o = 0.8) {
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`
}
export function lin(id, stops, x2 = 0, y2 = 1) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`
}

/**
 * 青绿山石：石绿山头 → 石青山腰 → 赭石山脚的渐变，右半背光压暗，再加几笔皴线。
 * peaks: [[x, y], ...] 为山峰（相对 base 中点，y 向上为负），base 宽 w，底边 y=0。
 */
export function crag(cv, ox, oy, w, peaks, id, { dark = false } = {}) {
  cv.def(lin(id, dark
    ? [[0, C.jade1], [0.45, C.blue1], [1, C.ink2]]
    : [[0, C.jade2], [0.35, C.jade1], [0.7, C.blue1], [1, C.wood1]]))
  const L = [ox - w / 2, oy], R = [ox + w / 2, oy]
  const pts = [L]
  const ps = peaks.map(([x, y]) => [ox + x, oy + y])
  ps.forEach((p, i) => {
    pts.push(p)
    const n = ps[i + 1]
    if (n) pts.push([(p[0] + n[0]) / 2, Math.max(p[1], n[1]) + Math.abs(n[0] - p[0]) * 0.35])
  })
  pts.push(R)
  // 用曲线把相邻点连顺：山体不能是尖锐多边形
  let d = `M${f(L[0])} ${f(L[1])}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const cx = (a[0] + b[0]) / 2 + (b[1] < a[1] ? -4 : 4), cy = Math.min(a[1], b[1]) + Math.abs(a[1] - b[1]) * 0.25
    d += `Q${f(cx)} ${f(cy)} ${f(b[0])} ${f(b[1])}`
  }
  d += `Q${f(ox)} ${f(oy + 10)} ${f(L[0])} ${f(L[1])}Z`
  cv.path(d, `fill="url(#${id})" ${STROKE}`, pts)
  // 背光面
  ps.forEach((p, i) => {
    const next = ps[i + 1] ?? R
    const foot = [Math.min(next[0], p[0] + (oy - p[1]) * 0.6), oy]
    cv.path(`M${f(p[0])} ${f(p[1])}Q${f(p[0] + 8)} ${f((p[1] + oy) / 2)} ${f(foot[0] - 6)} ${f(oy + 2)}L${f(Math.min(R[0], foot[0] + 26))} ${f(oy + 2)}Q${f(next[0])} ${f((next[1] + oy) / 2)} ${f(next === R ? R[0] : (p[0] + next[0]) / 2)} ${f(next === R ? R[1] : Math.max(p[1], next[1]) + Math.abs(next[0] - p[0]) * 0.35)}Q${f((p[0] + next[0]) / 2)} ${f(p[1] + 4)} ${f(p[0])} ${f(p[1])}Z`, `fill="${C.ink}" fill-opacity=".32"`)
    // 皴线
    for (let k = 0; k < 3; k++) {
      const t = 0.3 + k * 0.2, sx = p[0] - 6 + k * 3, sy = p[1] + (oy - p[1]) * t
      cv.path(`M${f(sx - 10)} ${f(sy)}q6 -4 12 -1`, `fill="none" stroke="${C.line}" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"`)
    }
    // 山头苔
    cv.path(`M${f(p[0] - 9)} ${f(p[1] + 8)}Q${f(p[0] - 3)} ${f(p[1] - 1)} ${f(p[0])} ${f(p[1])}Q${f(p[0] + 4)} ${f(p[1] + 2)} ${f(p[0] + 8)} ${f(p[1] + 9)}Q${f(p[0])} ${f(p[1] + 5)} ${f(p[0] - 9)} ${f(p[1] + 8)}Z`, `fill="${C.grass3}" fill-opacity=".85"`)
  })
}
