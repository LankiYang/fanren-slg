// 矢量美术的共用底座：统一色板 + 等距投影 + 材质纹理 + SVG 拼装。
// 精细化原则：细墨线（随底色走）、每个面有受光渐变、墙根压暗、棱边提亮、表面贴等距纹理。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets/sprites')

/** 色板：墨、青绿、石青、赭木、朱砂、金、宣纸。新素材只准从这里取色。 */
export const C = {
  line: '#141b21',
  ink: '#16202a',
  ink2: '#22313d',
  ink3: '#34475a',
  jade0: '#1f5a57', jade1: '#2f7f78', jade2: '#4fb3a4', jade3: '#8fd9c8', jade4: '#d4f5ec',
  blue0: '#1f3f5b', blue1: '#2e5a7a', blue2: '#4a86a8', blue3: '#8dbad2',
  tile0: '#23363f', tile1: '#2f4a55', tile2: '#436773', tile3: '#6a909a',
  wood0: '#4a2e22', wood1: '#6e4430', wood2: '#96603f', wood3: '#c08a5c',
  red0: '#6e2323', red1: '#9c3a30', red2: '#c65440', red3: '#e7836a',
  gold0: '#8a6a34', gold1: '#b98f4a', gold2: '#d8b168', gold3: '#f0d596', gold4: '#fff1c9',
  stone0: '#4b5055', stone1: '#6c7176', stone2: '#8f9497', stone3: '#b9bcb8', stone4: '#dcdcd2',
  paper0: '#c9b996', paper1: '#e2d5b6', paper2: '#f3ead4',
  grass0: '#2f4f3a', grass1: '#3f6a45', grass2: '#5b8a55', grass3: '#86b36e', grass4: '#b9d98f',
  fire0: '#a8391f', fire1: '#e0672d', fire2: '#f5a340', fire3: '#ffe08a',
  purple0: '#3b2a55', purple1: '#5d4386', purple2: '#8a6bc0', purple3: '#c6b0f0',
  skin: '#f1d6bd', skin2: '#d9b294',
}

export const f = n => Math.round(n * 10) / 10

// ── 颜色运算 ──
const toRgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
export const mix = (a, b, t) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)) }
export const dk = (c, t) => mix(c, '#0a0f14', t)
export const lt = (c, t) => mix(c, '#fff8e8', t)

// ── 等距纹理：图案本身按「面坐标」画，再用 patternTransform 剪切到等距面上 ──
const MAT = { L: '0.866 0.5 0 1 0 0', R: '0.866 -0.5 0 1 0 0', T: '0.866 0.5 -0.866 0.5 0 0' }
const PATTERNS = {
  // 石砌：错缝条石
  stone: (id, m) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="12" height="6" patternTransform="matrix(${m})"><path d="M0 6H12M0 3H12M4 0V3M10 3V6" fill="none" stroke="#000" stroke-opacity=".22" stroke-width=".55"/><path d="M0 .5H12M0 3.5H12" stroke="#fff" stroke-opacity=".1" stroke-width=".5"/></pattern>`,
  // 青砖：更密的错缝
  brick: (id, m) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="3" patternTransform="matrix(${m})"><path d="M0 3H6M0 1.5H6M1.5 0V1.5M4.5 1.5V3" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".4"/></pattern>`,
  // 木板：竖向拼板 + 木纹
  plank: (id, m) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="3.2" height="16" patternTransform="matrix(${m})"><path d="M0 0V16" stroke="#000" stroke-opacity=".3" stroke-width=".45"/><path d="M1.6 2q.4 4 0 7M1.2 10q.3 3 0 5" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".35"/></pattern>`,
  // 棂格：金色细格
  lattice: (id, m) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="2.6" height="2.6" patternTransform="matrix(${m})"><path d="M0 0H2.6V2.6" fill="none" stroke="${C.gold2}" stroke-opacity=".7" stroke-width=".4"/></pattern>`,
  // 冰裂纹窗
  ice: (id, m) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="matrix(${m})"><path d="M0 2L2.5 0M2.5 0L3 3L6 2.2M3 3L1.5 6M3 3L5 6" fill="none" stroke="${C.gold2}" stroke-opacity=".7" stroke-width=".4"/></pattern>`,
  // 方砖地
  flag: (id, m) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="matrix(${m})"><path d="M0 0H10M0 0V10" fill="none" stroke="#000" stroke-opacity=".18" stroke-width=".6"/><path d="M1 1H9" stroke="#fff" stroke-opacity=".1" stroke-width=".5"/></pattern>`,
  // 灰泥：零星斑点
  plaster: (id, m) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="14" height="11" patternTransform="matrix(${m})"><circle cx="3" cy="4" r=".5" fill="#000" fill-opacity=".08"/><circle cx="10" cy="8" r=".7" fill="#000" fill-opacity=".06"/><path d="M6 2q2 1 3 0" stroke="#000" stroke-opacity=".06" stroke-width=".5" fill="none"/></pattern>`,
}

/** 收集图元并自动算包围盒，输出紧贴内容的 viewBox（场景里建筑按底边中点落地，留白会让它“飘”） */
export class Canvas {
  constructor() { this.parts = []; this.defs = []; this.minX = Infinity; this.minY = Infinity; this.maxX = -Infinity; this.maxY = -Infinity; this.cache = new Map(); this.n = 0 }
  track(x, y) { if (x < this.minX) this.minX = x; if (y < this.minY) this.minY = y; if (x > this.maxX) this.maxX = x; if (y > this.maxY) this.maxY = y }
  add(s, pts = []) { this.parts.push(s); for (const [x, y] of pts) this.track(x, y); return this }
  def(s) { this.defs.push(s); return this }
  /** 线性渐变（按对象包围盒），同参复用。dir: v 竖 / h 横 / d 斜 */
  grad(stops, dir = 'v') {
    const key = 'g' + dir + JSON.stringify(stops)
    if (!this.cache.has(key)) {
      const id = 'g' + (this.n++)
      const [x2, y2] = dir === 'h' ? [1, 0] : dir === 'd' ? [1, 1] : [0, 1]
      this.def(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a === 1 ? '' : ` stop-opacity="${a}"`}/>`).join('')}</linearGradient>`)
      this.cache.set(key, id)
    }
    return `url(#${this.cache.get(key)})`
  }
  rad(color, o = 0.8, inner = 0) {
    const key = 'r' + color + o + inner
    if (!this.cache.has(key)) {
      const id = 'r' + (this.n++)
      this.def(`<radialGradient id="${id}"><stop offset="${inner}" stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`)
      this.cache.set(key, id)
    }
    return `url(#${this.cache.get(key)})`
  }
  /** 等距纹理：name 为 PATTERNS 键 + 面（L/R/T），如 'stoneL' */
  pat(name) {
    if (!this.cache.has(name)) {
      const face = name.slice(-1), base = name.slice(0, -1)
      const id = 'p' + (this.n++)
      this.def(PATTERNS[base](id, MAT[face]))
      this.cache.set(name, id)
    }
    return `url(#${this.cache.get(name)})`
  }
  poly(pts, fill, extra = '') { return this.add(`<path d="M${pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L')}Z" fill="${fill}" ${extra}/>`, pts) }
  line(pts, attrs) { return this.add(`<path d="M${pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L')}" fill="none" ${attrs}/>`, pts) }
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
  /** 把另一张 Canvas 平移后并入（树、灯等小部件复用） */
  embed(other, dx, dy, s = 1) {
    // 子画布的渐变 id 与本画布同名会串色，并入前统一加前缀
    const pre = 'e' + (this.n++) + '_'
    const fix = t => t.replace(/id="([gpr]\d+)"/g, `id="${pre}$1"`).replace(/url\(#([gpr]\d+)\)/g, `url(#${pre}$1)`)
    this.defs.push(...other.defs.map(fix))
    this.add(`<g transform="translate(${f(dx)} ${f(dy)})${s !== 1 ? ` scale(${s})` : ''}">${fix(other.parts.join(''))}</g>`, [[dx + other.minX * s, dy + other.minY * s], [dx + other.maxX * s, dy + other.maxY * s]])
  }
  /** mirror=true 时整体水平翻转（兵种统一朝右、妖兽统一朝左，战斗场景里面对面） */
  toString(pad = 4, fixed = null, mirror = false) {
    const vb = fixed ?? [f(this.minX - pad), f(this.minY - pad), f(this.maxX - this.minX + pad * 2), f(this.maxY - this.minY + pad * 2)]
    const body = mirror ? `<g transform="matrix(-1 0 0 1 ${f(vb[0] * 2 + vb[2])} 0)">${this.parts.join('')}</g>` : this.parts.join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}">${this.defs.length ? `<defs>${this.defs.join('')}</defs>` : ''}${body}</svg>`
  }
}

let uid = 0
/** 每个文件的 id 前缀不同，避免同页多个内联 SVG 冲突（img 引用不冲突，但保险起见） */
export function save(rel, svg) {
  const out = resolve(ROOT, rel)
  mkdirSync(dirname(out), { recursive: true })
  const p = rel.replace(/[^a-z0-9]/gi, '').slice(-6) + (uid++)
  const s = String(svg).replace(/\s+\/>/g, '/>').replace(/id="((?:e\d+_)?[gpr]\d+)"/g, `id="${p}$1"`).replace(/url\(#((?:e\d+_)?[gpr]\d+)\)/g, `url(#${p}$1)`)
  writeFileSync(out, s)
}

// ── 等距投影：x 向右下、y 向左下、z 向上。可见面为顶面、y=max 面（左）、x=max 面（右）──
const K = 0.866
export const iso = (x, y, z = 0) => [(x - y) * K, (x + y) * 0.5 - z]
export const P = pts => pts.map(p => iso(...p))
/** 屏幕坐标 → z=0 地面坐标 */
export const unIso = (sx, sy) => [(sx / K + 2 * sy) / 2, (2 * sy - sx / K) / 2]

const LW = `stroke="${C.line}" stroke-opacity=".78" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round"`
export const STROKE = LW
export const THIN = `stroke="${C.line}" stroke-opacity=".55" stroke-width=".6" stroke-linejoin="round" stroke-linecap="round"`

const faceL = b => P([[b.x, b.y + b.d, b.z], [b.x + b.w, b.y + b.d, b.z], [b.x + b.w, b.y + b.d, b.z + b.h], [b.x, b.y + b.d, b.z + b.h]])
const faceR = b => P([[b.x + b.w, b.y, b.z], [b.x + b.w, b.y + b.d, b.z], [b.x + b.w, b.y + b.d, b.z + b.h], [b.x + b.w, b.y, b.z + b.h]])
const faceT = b => P([[b.x, b.y, b.z + b.h], [b.x + b.w, b.y, b.z + b.h], [b.x + b.w, b.y + b.d, b.z + b.h], [b.x, b.y + b.d, b.z + b.h]])

/**
 * 长方体：t/l/r 为顶/左/右面底色。
 * tex / texTop: 表面纹理（stone/brick/plank/plaster/flag/lattice）；ao: 墙根压暗；hi: 棱边高光
 */
export function box(cv, o) {
  const b = { z: 0, ...o }
  const { t, l, r, stroke = true, tex, texTop, ao = true, hi = true } = b
  const s = stroke ? LW : ''
  const L = faceL(b), R = faceR(b), T = faceT(b)
  cv.poly(L, cv.grad([[0, lt(l, 0.07)], [1, dk(l, 0.1)]]), s)
  cv.poly(R, cv.grad([[0, dk(r, 0.02)], [1, dk(r, 0.2)]]), s)
  if (tex) { cv.poly(L, cv.pat(tex + 'L')); cv.poly(R, cv.pat(tex + 'R')) }
  if (ao && b.h > 3) { const g = cv.grad([[0, '#000', 0], [0.6, '#000', 0], [1, '#000', 0.28]]); cv.poly(L, g); cv.poly(R, g) }
  cv.poly(T, cv.grad([[0, lt(t, 0.1)], [1, t]]), s)
  if (texTop) cv.poly(T, cv.pat(texTop + 'T'))
  if (hi) {
    cv.line([T[3], T[2], T[1]], `stroke="${lt(t, 0.6)}" stroke-opacity=".7" stroke-width=".8"`)
    cv.line([L[1], L[2]], `stroke="${lt(l, 0.5)}" stroke-opacity=".5" stroke-width=".7"`)
  }
  return b
}

/** 在盒子左面（y=max）上画矩形：u 沿 x 方向 0..1，v 沿高度 0..1 */
export function quadL(b, u0, u1, v0, v1) {
  const y = b.y + b.d, z = b.z ?? 0
  return P([[b.x + b.w * u0, y, z + b.h * v0], [b.x + b.w * u1, y, z + b.h * v0], [b.x + b.w * u1, y, z + b.h * v1], [b.x + b.w * u0, y, z + b.h * v1]])
}
export function quadR(b, u0, u1, v0, v1) {
  const x = b.x + b.w, z = b.z ?? 0
  return P([[x, b.y + b.d * u0, z + b.h * v0], [x, b.y + b.d * u1, z + b.h * v0], [x, b.y + b.d * u1, z + b.h * v1], [x, b.y + b.d * u0, z + b.h * v1]])
}
export function onL(cv, b, u0, u1, v0, v1, fill, extra = LW) { cv.poly(quadL(b, u0, u1, v0, v1), fill, extra) }
export function onR(cv, b, u0, u1, v0, v1, fill, extra = LW) { cv.poly(quadR(b, u0, u1, v0, v1), fill, extra) }

/** 左/右面上的圆拱门 */
function arch(cv, a, bb, c, d, m, fill) {
  cv.path(`M${f(a[0])} ${f(a[1])}L${f(bb[0])} ${f(bb[1])}L${f(c[0])} ${f(c[1])}Q${f(m[0])} ${f(m[1])} ${f(d[0])} ${f(d[1])}Z`, `fill="${fill}" ${LW}`, [a, bb, m])
}
export function archL(cv, b, uc, uw, vh, fill) {
  const y = b.y + b.d, z = b.z ?? 0, x0 = b.x + b.w * (uc - uw / 2), x1 = b.x + b.w * (uc + uw / 2)
  arch(cv, iso(x0, y, z), iso(x1, y, z), iso(x1, y, z + b.h * vh), iso(x0, y, z + b.h * vh), iso((x0 + x1) / 2, y, z + b.h * vh + (x1 - x0) * 0.55), fill)
}
export function archR(cv, b, uc, uw, vh, fill) {
  const x = b.x + b.w, z = b.z ?? 0, y0 = b.y + b.d * (uc - uw / 2), y1 = b.y + b.d * (uc + uw / 2)
  arch(cv, iso(x, y0, z), iso(x, y1, z), iso(x, y1, z + b.h * vh), iso(x, y0, z + b.h * vh), iso(x, (y0 + y1) / 2, z + b.h * vh + (y1 - y0) * 0.55), fill)
}

const qpt = (e, t) => [(1 - t) * (1 - t) * e.ax + 2 * (1 - t) * t * e.qx + t * t * e.bx, (1 - t) * (1 - t) * e.ay + 2 * (1 - t) * t * e.qy + t * t * e.by]

/**
 * 中式屋顶（庑殿 / 攒尖）：檐口两端上翘、中段下垂；可见坡面铺筒瓦垄 + 瓦当，檐下露出檐厚，
 * 垂脊带走兽，正脊两端鸱吻，檐角起翘。colors: [前坡, 侧坡, 后坡, 屋脊]
 */
export function roof(cv, { x, y, z, w, d, h, o = 6, lift = 5, ridge = 0.35, colors, gold = false }) {
  const X0 = x - o, X1 = x + w + o, Y0 = y - o, Y1 = y + d + o
  const along = w >= d
  const Ym = (Y0 + Y1) / 2, Xm = (X0 + X1) / 2
  const R0 = along ? [X0 + (X1 - X0) * ridge * 0.5, Ym, z + h] : [Xm, Y0 + (Y1 - Y0) * ridge * 0.5, z + h]
  const R1 = along ? [X1 - (X1 - X0) * ridge * 0.5, Ym, z + h] : [Xm, Y1 - (Y1 - Y0) * ridge * 0.5, z + h]
  const c00 = [X0, Y0, z + lift], c10 = [X1, Y0, z + lift], c11 = [X1, Y1, z + lift], c01 = [X0, Y1, z + lift]
  const [front, side, back, ridgeC] = colors
  const accent = gold ? C.gold3 : lt(ridgeC, 0.2)
  const eave = (a, b) => {
    const [ax, ay] = iso(...a), [bx, by] = iso(...b)
    const [mx, my] = iso((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z - lift * 0.35)
    return { ax, ay, bx, by, qx: 2 * mx - (ax + bx) / 2, qy: 2 * my - (ay + by) / 2 }
  }
  const face = (e, rest, fill) => {
    const rp = rest.map(p => iso(...p))
    const dd = `M${f(e.ax)} ${f(e.ay)}Q${f(e.qx)} ${f(e.qy)} ${f(e.bx)} ${f(e.by)}${rp.map(([px, py]) => `L${f(px)} ${f(py)}`).join('')}Z`
    cv.path(dd, `fill="${fill}" ${LW}`, [[e.ax, e.ay], [e.bx, e.by], [e.qx, e.qy], ...rp])
    return dd
  }
  // 檐厚：沿檐曲线向下的一条暗带
  const thickness = (e, col) => {
    const top = [], bot = []
    for (let i = 0; i <= 16; i++) { const p = qpt(e, i / 16); top.push(p); bot.push([p[0], p[1] + 2.6]) }
    cv.poly([...top, ...bot.reverse()], dk(col, 0.55), THIN)
    cv.line(top.map(p => [p[0], p[1] + 2.6]), `stroke="${gold ? C.gold1 : C.red1}" stroke-opacity=".8" stroke-width=".7"`)
  }
  // 瓦垄：凹槽暗线 + 筒瓦亮线；檐口一排瓦当
  const tiles = (e, rA, rB, col) => {
    const ra = iso(...rA), rb = iso(...rB)
    const len = Math.hypot(e.bx - e.ax, e.by - e.ay)
    const n = Math.max(4, Math.round(len / 3.2))
    for (let i = 1; i < n; i++) {
      const t = i / n, p = qpt(e, t), r = [ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t]
      cv.line([p, r], `stroke="${dk(col, 0.45)}" stroke-opacity=".55" stroke-width=".7"`)
      cv.line([[p[0] + 1, p[1] - 0.3], [r[0] + 0.6, r[1]]], `stroke="${lt(col, 0.28)}" stroke-opacity=".6" stroke-width=".9"`)
    }
    for (let i = 0; i <= n; i++) { const p = qpt(e, i / n); cv.circle(p[0] + 0.5, p[1] + 0.6, 1.05, `fill="${lt(col, 0.18)}" stroke="${dk(col, 0.6)}" stroke-width=".4"`) }
  }
  const eF = along ? eave(c01, c11) : eave(c01, c11), eS = eave(c11, c10)
  if (along) {
    face(eave(c10, c00), [R0, R1], back)
    face(eave(c00, c01), [R0], back)
    face(eF, [R1, R0], cv.grad([[0, lt(front, 0.14)], [1, dk(front, 0.08)]]))
    face(eS, [R1], cv.grad([[0, dk(side, 0.02)], [1, dk(side, 0.18)]]))
    tiles(eF, R0, R1, front); tiles(eS, R1, R1, side)
  } else {
    face(eave(c00, c01), [R0], back)
    face(eave(c10, c00), [R0, R1], back)
    face(eS, [R1, R0], cv.grad([[0, dk(side, 0.02)], [1, dk(side, 0.18)]]))
    face(eF, [R1], cv.grad([[0, lt(front, 0.14)], [1, dk(front, 0.08)]]))
    tiles(eS, R1, R0, side); tiles(eF, R1, R1, front)
  }
  thickness(eF, front); thickness(eS, side)
  // 垂脊 + 走兽
  const hip = (c, R) => {
    const a = iso(...c), b = iso(...R)
    cv.line([a, b], `stroke="${C.line}" stroke-opacity=".85" stroke-width="2.6"`)
    cv.line([a, b], `stroke="${ridgeC}" stroke-width="1.4"`)
    for (let k = 1; k <= 3; k++) { const t = 0.06 + k * 0.05; cv.circle(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 1.2, 0.9, `fill="${accent}" stroke="${C.line}" stroke-width=".35"`) }
  }
  hip(c01, along ? R0 : R1); hip(c11, R1); hip(c10, along ? R1 : R0)
  // 檐角起翘
  for (const [c, dir] of [[c01, -1], [c11, 0], [c10, 1]]) {
    const [px, py] = iso(...c)
    const dx = dir === 0 ? 0 : dir * 3.4
    cv.path(`M${f(px)} ${f(py + 1)}q${f(dx * 0.4)} -1.5 ${f(dx)} -5.5`, `fill="none" stroke="${C.line}" stroke-width="2.6" stroke-linecap="round"`, [[px + dx, py - 6]])
    cv.path(`M${f(px)} ${f(py + 1)}q${f(dx * 0.4)} -1.5 ${f(dx)} -5.5`, `fill="none" stroke="${accent}" stroke-width="1.2" stroke-linecap="round"`)
  }
  // 正脊 + 鸱吻 / 宝顶
  const [r0x, r0y] = iso(...R0), [r1x, r1y] = iso(...R1)
  if (Math.hypot(r1x - r0x, r1y - r0y) > 1) {
    cv.line([[r0x, r0y], [r1x, r1y]], `stroke="${C.line}" stroke-opacity=".9" stroke-width="4.4" stroke-linecap="round"`)
    cv.line([[r0x, r0y], [r1x, r1y]], `stroke="${ridgeC}" stroke-width="2.8" stroke-linecap="round"`)
    cv.line([[r0x, r0y - 1], [r1x, r1y - 1]], `stroke="${lt(ridgeC, 0.5)}" stroke-width=".7" stroke-linecap="round"`)
    const kiss = (px, py, dir) => {
      cv.path(`M${f(px)} ${f(py + 1)}c${f(dir * 0.5)} -4 ${f(dir * 3)} -8 ${f(dir * 6.5)} -9c${f(-dir * 0.6)} 2 ${f(-dir * 0.2)} 4 ${f(dir * 1.6)} 4.6c${f(-dir * 2.4)} 1 ${f(-dir * 4)} 2.4 ${f(-dir * 4.6)} 5.4z`, `fill="${accent}" stroke="${C.line}" stroke-width=".7" stroke-linejoin="round"`, [[px + dir * 8, py - 10]])
      cv.path(`M${f(px + dir * 2.2)} ${f(py - 4)}q${f(dir * 1.5)} -1 ${f(dir * 2.4)} -3.5`, `fill="none" stroke="${C.line}" stroke-opacity=".6" stroke-width=".5"`)
    }
    kiss(r0x, r0y, -1); kiss(r1x, r1y, 1)
  } else {
    cv.path(`M${f(r0x)} ${f(r0y)}v-9`, `stroke="${C.line}" stroke-width="2.8" stroke-linecap="round"`, [[r0x, r0y - 14]])
    cv.path(`M${f(r0x)} ${f(r0y)}v-9`, `stroke="${accent}" stroke-width="1.4" stroke-linecap="round"`)
    cv.circle(r0x, r0y - 4, 2.6, `fill="${accent}" ${LW}`)
    cv.circle(r0x, r0y - 10, 1.6, `fill="${C.gold3}" ${LW}`)
  }
}

/** 等距椭圆（地面上的圆）：返回点列 */
export function isoEllipse(cx, cy, z, r, n = 48) {
  const pts = []
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(iso(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)) }
  return pts
}

/** 松：虬干 + 分枝 + 片状松针团（每团带放射针线与受光顶） */
export function pine(cv, x, y, s = 1, dark = false) {
  const [px, py] = iso(x, y, 0)
  const S = v => v * s
  cv.ellipse(px + S(4), py, S(14), S(3.5), 'fill="#000" fill-opacity=".2"')
  const trunk = `M${f(px - S(2.6))} ${f(py)}C${f(px - S(1))} ${f(py - S(16))} ${f(px + S(6))} ${f(py - S(24))} ${f(px + S(1))} ${f(py - S(40))}L${f(px + S(4))} ${f(py - S(40))}C${f(px + S(9))} ${f(py - S(24))} ${f(px + S(3.4))} ${f(py - S(12))} ${f(px + S(3.4))} ${f(py)}Z`
  cv.path(trunk, `fill="${cv.grad([[0, C.wood2], [1, C.wood0]], 'h')}" ${LW}`, [[px - S(3), py], [px + S(9), py - S(40)]])
  for (let i = 0; i < 5; i++) cv.path(`M${f(px + S(0.5 + i * 0.3))} ${f(py - S(4 + i * 7))}q${f(S(1.2))} ${f(S(-1))} ${f(S(2))} 0`, `fill="none" stroke="${C.line}" stroke-opacity=".45" stroke-width=".5"`)
  const branches = [[1, -20, -12, -26], [3, -27, 13, -32], [2, -35, -9, -42], [3, -40, 8, -46]]
  for (const [bx, by, ex, ey] of branches) cv.path(`M${f(px + S(bx))} ${f(py + S(by))}Q${f(px + S((bx + ex) / 2))} ${f(py + S(by - 1))} ${f(px + S(ex))} ${f(py + S(ey))}`, `fill="none" stroke="${C.wood1}" stroke-width="${f(S(1.6))}" stroke-linecap="round"`)
  const clumps = [[-13, -26, 11, 5.6], [14, -31, 11, 5.6], [-9, -42, 9.5, 5.2], [9, -46, 9.5, 5.2], [1, -54, 7.5, 5]]
  clumps.forEach(([cx0, cy0, rx, ry], i) => {
    const cx = px + S(cx0), cy = py + S(cy0), RX = S(rx), RY = S(ry)
    // 松针团：圆拱顶 + 底部三道波浪，像国画里的「松针伞」
    const shape = (dy, sc = 1) => {
      const l = cx - RX * sc, r = cx + RX * sc, b = cy + dy + RY * 0.4, t = cy + dy - RY * 1.2
      const w3 = (r - l) / 3
      return `M${f(l)} ${f(b)}C${f(l)} ${f(t + RY * 0.3)} ${f(cx - RX * 0.3)} ${f(t)} ${f(cx)} ${f(t)}C${f(cx + RX * 0.35)} ${f(t)} ${f(r)} ${f(t + RY * 0.3)} ${f(r)} ${f(b)}` +
        `Q${f(r - w3 * 0.5)} ${f(b + RY * 0.6)} ${f(r - w3)} ${f(b)}Q${f(r - w3 * 1.5)} ${f(b + RY * 0.6)} ${f(l + w3)} ${f(b)}Q${f(l + w3 * 0.5)} ${f(b + RY * 0.6)} ${f(l)} ${f(b)}Z`
    }
    cv.path(shape(S(1.4)), `fill="${dark ? '#1c3226' : C.grass0}"`, [[cx - RX, cy - RY * 1.2], [cx + RX, cy + RY * 1.4]])
    cv.path(shape(0), `fill="${cv.grad([[0, dark ? C.grass1 : [C.grass3, C.grass2, C.grass3, C.grass2, C.grass3][i]], [1, dark ? C.grass0 : C.grass1]])}" ${LW}`)
    for (let k = -3; k <= 3; k++) {
      const bx = cx + (k / 3.4) * RX * 0.85, by = cy - RY * 0.6 * (1 - Math.abs(k) / 4.5)
      cv.path(`M${f(bx)} ${f(by + RY * 0.5)}L${f(bx + k * S(0.7))} ${f(by - RY * 0.5)}`, `stroke="${C.grass4}" stroke-opacity=".65" stroke-width=".55" stroke-linecap="round"`)
    }
  })
}

/** 灌木：多团叶簇，受光顶 + 叶片短线 */
export function bush(cv, x, y, s = 1, col = [C.grass1, C.grass2, C.grass3]) {
  const [px, py] = iso(x, y, 0)
  cv.ellipse(px + 1, py, 12 * s, 4 * s, 'fill="#000" fill-opacity=".2"')
  const blobs = [[-6, -6, 7], [6, -7, 7.5], [0, -13, 7.2], [-2, -5, 5]]
  blobs.forEach(([dx, dy, r], i) => {
    const cx = px + dx * s, cy = py + dy * s, R = r * s
    cv.circle(cx, cy, R, `fill="${cv.grad([[0, lt(col[Math.min(2, i)], 0.12)], [1, dk(col[0], 0.15)]])}" ${LW}`)
    for (let k = 0; k < 4; k++) { const a = -2.4 + k * 0.5; cv.path(`M${f(cx + Math.cos(a) * R * 0.5)} ${f(cy + Math.sin(a) * R * 0.5)}l${f(Math.cos(a) * 2 * s)} ${f(Math.sin(a) * 2 * s)}`, `stroke="${C.grass4}" stroke-opacity=".6" stroke-width=".6" stroke-linecap="round"`) }
  })
  if (col[3]) for (const [dx, dy] of [[-4, -9], [5, -11], [1, -16]]) cv.circle(px + dx * s, py + dy * s, 1.2 * s, `fill="${col[3]}" stroke="${C.line}" stroke-width=".3"`)
}

/** 放射光晕 defs（兼容旧接口） */
export function glow(id, color, o = 0.8) {
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`
}
export function lin(id, stops, x2 = 0, y2 = 1) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`
}

let seedV = 1
export const srand = s => { seedV = s }
export const rnd = () => { seedV = (seedV * 16807) % 2147483647; return (seedV - 1) / 2147483646 }

/**
 * 青绿山石：石绿山头 → 石青山腰 → 赭石山脚渐变；背光面压暗、受光棱提亮，
 * 再加披麻皴、苔点和山脚碎石。peaks 相对 (ox, oy)，y 向上为负。
 */
export function crag(cv, ox, oy, w, peaks, id, { dark = false, seed = 3 } = {}) {
  srand(seed)
  const fill = cv.grad(dark
    ? [[0, C.jade1], [0.45, C.blue1], [1, C.ink2]]
    : [[0, '#6cc2ad'], [0.22, C.jade2], [0.45, C.jade1], [0.72, C.blue1], [0.9, '#5b4632'], [1, C.wood1]])
  void id
  const L = [ox - w / 2, oy], R = [ox + w / 2, oy]
  const pts = [L]
  const ps = peaks.map(([x, y]) => [ox + x, oy + y])
  ps.forEach((p, i) => {
    pts.push(p)
    const n = ps[i + 1]
    if (n) pts.push([(p[0] + n[0]) / 2, Math.max(p[1], n[1]) + Math.abs(n[0] - p[0]) * 0.35])
  })
  pts.push(R)
  let d = `M${f(L[0])} ${f(L[1])}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const cx = (a[0] + b[0]) / 2 + (b[1] < a[1] ? -4 : 4), cy = Math.min(a[1], b[1]) + Math.abs(a[1] - b[1]) * 0.25
    d += `Q${f(cx)} ${f(cy)} ${f(b[0])} ${f(b[1])}`
  }
  d += `Q${f(ox)} ${f(oy + 10)} ${f(L[0])} ${f(L[1])}Z`
  cv.path(d, `fill="${fill}" ${LW}`, pts)
  ps.forEach((p, i) => {
    const next = ps[i + 1] ?? R
    const H = oy - p[1]
    const foot = [Math.min(next[0], p[0] + H * 0.6), oy]
    // 背光面
    cv.path(`M${f(p[0])} ${f(p[1])}Q${f(p[0] + 8)} ${f((p[1] + oy) / 2)} ${f(foot[0] - 6)} ${f(oy + 2)}L${f(Math.min(R[0], foot[0] + 26))} ${f(oy + 2)}Q${f(next[0])} ${f((next[1] + oy) / 2)} ${f(next === R ? R[0] : (p[0] + next[0]) / 2)} ${f(next === R ? R[1] : Math.max(p[1], next[1]) + Math.abs(next[0] - p[0]) * 0.35)}Q${f((p[0] + next[0]) / 2)} ${f(p[1] + 4)} ${f(p[0])} ${f(p[1])}Z`, `fill="${C.ink}" fill-opacity=".3"`)
    // 受光棱
    cv.path(`M${f(p[0])} ${f(p[1] + 1)}Q${f(p[0] - H * 0.08)} ${f(p[1] + H * 0.16)} ${f(p[0] - H * 0.18)} ${f(p[1] + H * 0.32)}`, `fill="none" stroke="${C.jade4}" stroke-opacity=".35" stroke-width=".9" stroke-linecap="round"`)
    // 披麻皴：顺山势的一簇长短弧线
    const n = Math.round(H / 5)
    for (let k = 0; k < n; k++) {
      const t = 0.18 + rnd() * 0.72, side = rnd() > 0.5 ? 1 : -1
      const sx = p[0] + side * H * t * (0.25 + rnd() * 0.3), sy = p[1] + H * t
      const len = 5 + rnd() * 8
      cv.path(`M${f(sx)} ${f(sy)}q${f(side * len * 0.3)} ${f(len * 0.5)} ${f(side * len * 0.2)} ${f(len)}`, `fill="none" stroke="${C.line}" stroke-opacity="${f(0.18 + rnd() * 0.2)}" stroke-width=".7" stroke-linecap="round"`, [[sx, sy]])
    }
    // 苔点：山顶与山肩的墨绿小点
    for (let k = 0; k < 10; k++) {
      const t = rnd() * 0.45, sx = p[0] + (rnd() - 0.5) * H * t * 0.9, sy = p[1] + 3 + H * t * 0.8
      cv.ellipse(sx, sy, 1.6 + rnd(), 0.9 + rnd() * 0.5, `fill="${rnd() > 0.4 ? C.grass0 : C.grass3}" fill-opacity=".85"`)
    }
    // 山头草坡
    cv.path(`M${f(p[0] - 9)} ${f(p[1] + 8)}Q${f(p[0] - 3)} ${f(p[1] - 1)} ${f(p[0])} ${f(p[1])}Q${f(p[0] + 4)} ${f(p[1] + 2)} ${f(p[0] + 8)} ${f(p[1] + 9)}Q${f(p[0])} ${f(p[1] + 5)} ${f(p[0] - 9)} ${f(p[1] + 8)}Z`, `fill="${cv.grad([[0, C.grass4], [1, C.grass2]])}" fill-opacity=".9"`)
  })
  // 山脚碎石
  for (let k = 0; k < 7; k++) {
    const sx = L[0] + 10 + rnd() * (w - 20), sy = oy + 2 + rnd() * 5, r = 2 + rnd() * 3
    cv.path(`M${f(sx - r)} ${f(sy)}Q${f(sx - r)} ${f(sy - r)} ${f(sx)} ${f(sy - r * 0.9)}Q${f(sx + r)} ${f(sy - r * 0.6)} ${f(sx + r)} ${f(sy)}Z`, `fill="${cv.grad([[0, C.stone3], [1, C.stone1]])}" ${THIN}`, [[sx - r, sy - r], [sx + r, sy]])
  }
}
