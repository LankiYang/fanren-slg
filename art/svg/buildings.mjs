// 洞府场景建筑：统一等距视角、统一墨线、统一青瓦朱柱。
import { C, Canvas, save, iso, P, box, onL, onR, archL, archR, roof, isoEllipse, pine, bush, glow, lin, crag, STROKE, f } from './lib.mjs'

const TILE = [C.tile2, C.tile1, C.tile0, C.tile3]
const GOLD_TILE = [C.gold1, C.gold0, C.wood1, C.gold3]
const RED_TILE = [C.red1, C.red0, C.wood0, C.red3]

function plinth(cv, x, y, w, d, h, z = 0) {
  const b = { x, y, z, w, d, h, t: C.stone3, l: C.stone2, r: C.stone1 }
  box(cv, b)
  // 石缝
  onL(cv, b, 0, 1, 0.5, 0.5, 'none', `stroke="${C.line}" stroke-opacity=".25"`)
  return b
}

/** 殿身：米白墙 + 朱柱 + 格窗 */
function hall(cv, { x, y, z, w, d, h, cols = 4, door = true, wallL = C.paper1, wallR = C.paper0, pillar = C.red1, lattice = C.wood1 }) {
  const b = { x, y, z, w, d, h, t: wallL, l: wallL, r: wallR }
  box(cv, b)
  for (let i = 0; i <= cols; i++) { const u = i / cols; onL(cv, b, Math.max(0, u - 0.035), Math.min(1, u + 0.035), 0, 1, pillar) }
  const rc = Math.max(2, Math.round(cols * d / w))
  for (let i = 0; i <= rc; i++) { const u = i / rc; onR(cv, b, Math.max(0, u - 0.045), Math.min(1, u + 0.045), 0, 1, C.red0) }
  for (let i = 0; i < cols; i++) {
    const u0 = i / cols + 0.06, u1 = (i + 1) / cols - 0.06
    const mid = door && i === Math.floor(cols / 2) - (cols % 2 === 0 ? 0 : 0)
    if (door && i === Math.floor((cols - 1) / 2)) onL(cv, b, u0, u1, 0, 0.72, C.wood0)
    else onL(cv, b, u0, u1, 0.32, 0.78, lattice)
    void mid
  }
  for (let i = 0; i < rc; i++) onR(cv, b, i / rc + 0.1, (i + 1) / rc - 0.1, 0.32, 0.78, C.wood0)
  // 额枋：柱头一道暗梁
  onL(cv, b, 0, 1, 0.84, 1, C.wood1)
  onR(cv, b, 0, 1, 0.84, 1, C.wood0)
  return b
}

function stairsL(cv, xc, yEdge, width, steps, stepH, depth, z0 = 0) {
  // 从平台左面（y=max）向 +y 方向下行的台阶
  for (let i = 0; i < steps; i++) {
    box(cv, { x: xc - width / 2, y: yEdge, z: z0, w: width, d: depth * (steps - i), h: stepH * (i + 1), t: C.stone4, l: C.stone2, r: C.stone1 })
  }
}

function banner(cv, x, y, z, h, col = C.red2) {
  const [bx, by] = iso(x, y, z), [tx, ty] = iso(x, y, z + h)
  cv.path(`M${f(bx)} ${f(by)}L${f(tx)} ${f(ty)}`, `stroke="${C.line}" stroke-width="3" stroke-linecap="round"`, [[bx, by], [tx, ty]])
  cv.path(`M${f(bx)} ${f(by)}L${f(tx)} ${f(ty)}`, `stroke="${C.wood2}" stroke-width="1.4"`)
  cv.circle(tx, ty - 2, 2.4, `fill="${C.gold2}" ${STROKE}`)
  cv.path(`M${f(tx + 1)} ${f(ty + 3)}l14 2q-2 10 1 22l-15 -3z`, `fill="${col}" ${STROKE}`, [[tx + 16, ty + 28]])
  cv.path(`M${f(tx + 5)} ${f(ty + 9)}l6 1M${f(tx + 5)} ${f(ty + 15)}l6 1`, `stroke="${C.gold3}" stroke-width="1.4" stroke-linecap="round"`)
}

function lantern(cv, x, y, z) {
  const [px, py] = iso(x, y, z)
  cv.path(`M${f(px)} ${f(py - 12)}v4`, `stroke="${C.line}" stroke-width="1.2"`)
  cv.ellipse(px, py - 4, 4, 5, `fill="${C.red2}" ${STROKE}`)
  cv.ellipse(px, py - 4, 2, 3.4, `fill="${C.fire3}" fill-opacity=".7"`)
}

function shadow(cv, x, y, w, d, pad = 8) {
  cv.poly(P([[x - pad, y - pad * 0.2, 0], [x + w + pad * 1.6, y - pad * 0.2, 0], [x + w + pad * 1.6, y + d + pad * 1.6, 0], [x - pad, y + d + pad * 1.6, 0]]), '#0b1219', 'fill-opacity=".22"')
}

// ── 宗门大殿：高台、重檐、金瓦 —— 场景里最「重」的建筑 ──
function zongmen() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 130, 100)
  plinth(cv, 0, 0, 130, 100, 9)
  plinth(cv, 10, 8, 110, 80, 9, 9)
  stairsL(cv, 65, 88, 34, 3, 6, 4, 0)
  banner(cv, 6, 94, 9, 44)
  banner(cv, 124, 12, 9, 44)
  const h1 = hall(cv, { x: 22, y: 18, z: 18, w: 86, d: 54, h: 32, cols: 5 })
  void h1
  roof(cv, { x: 22, y: 18, z: 50, w: 86, d: 54, h: 12, o: 11, lift: 6, ridge: 0.9, colors: GOLD_TILE, gold: true })
  const up = { x: 36, y: 28, z: 58, w: 58, d: 34, h: 12, t: C.paper1, l: C.paper1, r: C.paper0 }
  box(cv, up)
  onL(cv, up, 0.32, 0.68, 0.12, 0.92, C.ink2)
  onL(cv, up, 0.36, 0.64, 0.24, 0.8, C.gold2)
  roof(cv, { x: 36, y: 28, z: 70, w: 58, d: 34, h: 24, o: 10, lift: 7, ridge: 0.5, colors: GOLD_TILE, gold: true })
  lantern(cv, 30, 92, 18); lantern(cv, 100, 92, 18)
  return cv
}

// ── 藏经阁：三重檐方阁，纵向最高 ──
function cangjing() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 60, 60, 6)
  plinth(cv, 0, 0, 60, 60, 7)
  pine(cv, -4, 58, 0.9)
  hall(cv, { x: 7, y: 7, z: 7, w: 46, d: 46, h: 26, cols: 3 })
  roof(cv, { x: 7, y: 7, z: 33, w: 46, d: 46, h: 9, o: 9, lift: 6, ridge: 0.95, colors: TILE })
  hall(cv, { x: 12, y: 12, z: 38, w: 36, d: 36, h: 20, cols: 3, door: false })
  roof(cv, { x: 12, y: 12, z: 58, w: 36, d: 36, h: 8, o: 8, lift: 5, ridge: 0.95, colors: TILE })
  hall(cv, { x: 17, y: 17, z: 62, w: 26, d: 26, h: 16, cols: 2, door: false })
  roof(cv, { x: 17, y: 17, z: 78, w: 26, d: 26, h: 26, o: 8, lift: 5, ridge: 1, colors: TILE })
  const [tx, ty] = iso(30, 30, 104)
  cv.path(`M${f(tx)} ${f(ty)}v-12`, `stroke="${C.line}" stroke-width="3.4" stroke-linecap="round"`, [[tx, ty - 14]])
  cv.path(`M${f(tx)} ${f(ty)}v-12`, `stroke="${C.gold2}" stroke-width="1.6" stroke-linecap="round"`)
  cv.circle(tx, ty - 6, 2.6, `fill="${C.gold3}" ${STROKE}`)
  // 经卷匾
  const b = { x: 7, y: 7, z: 7, w: 46, d: 46, h: 26 }
  onL(cv, b, 0.3, 0.7, 0.86, 1.04, C.ink2)
  return cv
}

// ── 炼器阁：厚墙工坊 + 烟囱 + 炉口火光 ──
function lianqi() {
  const cv = new Canvas()
  cv.def(glow('forge', C.fire2, 0.9))
  shadow(cv, 0, 0, 90, 64)
  plinth(cv, 0, 0, 90, 64, 6)
  // 后烟囱
  box(cv, { x: 58, y: 10, z: 6, w: 14, d: 14, h: 70, t: C.stone2, l: C.stone1, r: C.stone0 })
  const [cx, cy] = iso(65, 17, 76)
  cv.ellipse(cx, cy, 12, 5, `fill="${C.fire2}" fill-opacity=".35"`)
  cv.path(`M${f(cx - 4)} ${f(cy - 4)}q-8 -12 2 -20q10 -8 2 -22`, `fill="none" stroke="${C.stone3}" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"`, [[cx - 12, cy - 48]])
  const b = { x: 8, y: 8, z: 6, w: 62, d: 48, h: 30, t: C.stone3, l: C.stone2, r: C.stone1 }
  box(cv, b)
  onL(cv, b, 0, 1, 0.8, 1, C.wood1)
  onR(cv, b, 0, 1, 0.8, 1, C.wood0)
  for (const u of [0, 0.5, 1]) onL(cv, b, Math.max(0, u - 0.03), Math.min(1, u + 0.03), 0, 0.8, C.wood1)
  archL(cv, b, 0.3, 0.3, 0.45, C.ink)
  onL(cv, b, 0.64, 0.86, 0.35, 0.68, C.wood0)
  onR(cv, b, 0.3, 0.7, 0.3, 0.62, C.wood0)
  // 炉口火光
  const [gx, gy] = iso(8 + 62 * 0.3, 56, 12)
  cv.ellipse(gx, gy, 20, 14, `fill="url(#forge)"`)
  cv.ellipse(gx, gy + 1, 6, 4.5, `fill="${C.fire3}"`)
  roof(cv, { x: 8, y: 8, z: 36, w: 62, d: 48, h: 16, o: 8, lift: 5, ridge: 0.6, colors: TILE })
  // 砧台
  box(cv, { x: 72, y: 50, z: 0, w: 10, d: 8, h: 8, t: C.stone2, l: C.stone1, r: C.stone0 })
  box(cv, { x: 70, y: 49, z: 8, w: 14, d: 10, h: 4, t: C.blue3, l: C.blue2, r: C.blue1 })
  return cv
}

// ── 炼丹房：朱墙殿 + 前庭铜鼎 + 丹烟 ──
function liandan() {
  const cv = new Canvas()
  cv.def(glow('dan', C.fire2, 0.85))
  shadow(cv, 0, 0, 84, 84)
  plinth(cv, 0, 0, 84, 84, 5)
  hall(cv, { x: 6, y: 6, z: 5, w: 56, d: 40, h: 26, cols: 3, wallL: C.red2, wallR: C.red1, pillar: C.red0, lattice: C.wood0 })
  roof(cv, { x: 6, y: 6, z: 31, w: 56, d: 40, h: 16, o: 8, lift: 5, ridge: 0.6, colors: TILE })
  // 铜鼎
  const [dx, dy] = iso(56, 62, 5)
  cv.ellipse(dx, dy + 2, 22, 9, `fill="#000" fill-opacity=".25"`)
  for (const s of [-1, 1]) cv.path(`M${f(dx + s * 11)} ${f(dy - 4)}l${f(s * 3)} 9`, `stroke="${C.line}" stroke-width="3.4" stroke-linecap="round"`)
  cv.path(`M${f(dx - 17)} ${f(dy - 22)}Q${f(dx - 18)} ${f(dy - 2)} ${f(dx)} ${f(dy)}Q${f(dx + 18)} ${f(dy - 2)} ${f(dx + 17)} ${f(dy - 22)}Z`, `fill="${C.gold1}" ${STROKE}`, [[dx - 18, dy - 24], [dx + 18, dy]])
  cv.path(`M${f(dx - 12)} ${f(dy - 12)}Q${f(dx)} ${f(dy - 7)} ${f(dx + 12)} ${f(dy - 12)}`, `fill="none" stroke="${C.gold0}" stroke-width="2"`)
  cv.ellipse(dx, dy - 22, 17, 6, `fill="${C.gold0}" ${STROKE}`)
  cv.ellipse(dx, dy - 22, 12, 3.8, `fill="${C.fire2}"`)
  for (const s of [-1, 1]) cv.path(`M${f(dx + s * 14)} ${f(dy - 24)}q${f(s * 2)} -9 ${f(s * 8)} -8`, `fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round"`)
  for (const s of [-1, 1]) cv.path(`M${f(dx + s * 14)} ${f(dy - 24)}q${f(s * 2)} -9 ${f(s * 8)} -8`, `fill="none" stroke="${C.gold2}" stroke-width="2" stroke-linecap="round"`)
  cv.ellipse(dx, dy - 26, 24, 16, `fill="url(#dan)"`)
  cv.path(`M${f(dx - 3)} ${f(dy - 26)}q-10 -12 0 -22q8 -8 -2 -20`, `fill="none" stroke="${C.jade3}" stroke-opacity=".75" stroke-width="4" stroke-linecap="round"`, [[dx - 10, dy - 70]])
  cv.path(`M${f(dx + 5)} ${f(dy - 28)}q8 -10 0 -18`, `fill="none" stroke="${C.paper2}" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"`)
  bush(cv, 80, 18, 0.9)
  return cv
}

// ── 坊市：两间铺面 + 布幌 + 灯笼串 ──
function fangshi() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 100, 70)
  plinth(cv, 0, 0, 100, 70, 4)
  const shop = (x, y, w, d, h, awning) => {
    const b = hall(cv, { x, y, z: 4, w, d, h, cols: 2, door: false, lattice: C.wood0 })
    onL(cv, b, 0.08, 0.92, 0.02, 0.5, C.wood0)
    // 柜台
    box(cv, { x: x + 4, y: y + d, z: 4, w: w - 8, d: 6, h: 8, t: C.wood3, l: C.wood2, r: C.wood1 })
    // 布篷
    cv.poly(P([[x - 2, y + d, 4 + h * 0.72], [x + w + 2, y + d, 4 + h * 0.72], [x + w + 2, y + d + 12, 4 + h * 0.46], [x - 2, y + d + 12, 4 + h * 0.46]]), awning, STROKE)
    for (let i = 1; i < 5; i++) { const u = x - 2 + (w + 4) * i / 5; const a = iso(u, y + d, 4 + h * 0.72), c = iso(u, y + d + 12, 4 + h * 0.46); cv.path(`M${f(a[0])} ${f(a[1])}L${f(c[0])} ${f(c[1])}`, `stroke="${C.paper2}" stroke-opacity=".6" stroke-width="2.4"`) }
    roof(cv, { x, y, z: 4 + h, w, d, h: 12, o: 6, lift: 5, ridge: 0.5, colors: TILE })
  }
  shop(6, 4, 40, 30, 22, C.jade1)
  shop(54, 6, 38, 28, 20, C.red1)
  // 货箱与布幌
  box(cv, { x: 44, y: 50, z: 4, w: 10, d: 10, h: 8, t: C.wood3, l: C.wood2, r: C.wood1 })
  box(cv, { x: 58, y: 52, z: 4, w: 8, d: 8, h: 6, t: C.gold3, l: C.gold2, r: C.gold1 })
  const [px, py] = iso(96, 44, 4), [qx, qy] = iso(96, 44, 46)
  cv.path(`M${f(px)} ${f(py)}L${f(qx)} ${f(qy)}`, `stroke="${C.line}" stroke-width="3"`, [[qx, qy]])
  cv.path(`M${f(qx)} ${f(qy + 2)}h-12v26l6 -4 6 4z`, `fill="${C.paper2}" ${STROKE}`, [[qx - 12, qy + 28]])
  cv.path(`M${f(qx - 6)} ${f(qy + 8)}v12`, `stroke="${C.red1}" stroke-width="3" stroke-linecap="round"`)
  for (const [x, y] of [[20, 44], [34, 44], [66, 44], [80, 44]]) lantern(cv, x, y, 26)
  return cv
}

// ── 聚灵阵：圆形阵台 + 灵柱 + 灵气旋 ──
function juling() {
  const cv = new Canvas()
  cv.def(glow('qi', C.jade2, 0.75))
  cv.def(lin('beam', [[0, C.jade3, 0], [0.5, C.jade3, 0.55], [1, C.jade2, 0.1]]))
  const cx = 45, cy = 45
  // 阵台：两层圆台（用多段柱侧面拼出厚度）
  const disk = (r, z, h, top, side) => {
    const bot = isoEllipse(cx, cy, z, r), topP = isoEllipse(cx, cy, z + h, r)
    const n = bot.length
    const sidePts = []
    for (let i = 0; i <= n / 2; i++) sidePts.push(bot[(i + n - n / 8) % n])
    for (let i = n / 2; i >= 0; i--) sidePts.push(topP[(i + n - n / 8) % n])
    cv.poly(sidePts, side, STROKE)
    cv.poly(topP, top, STROKE)
    return topP
  }
  const shadowP = isoEllipse(cx + 6, cy + 6, 0, 50)
  cv.poly(shadowP, '#0b1219', 'fill-opacity=".22"')
  disk(46, 0, 6, C.stone3, C.stone1)
  disk(38, 6, 5, C.stone4, C.stone2)
  // 阵纹
  for (const [r, w, o] of [[32, 2.2, 0.95], [22, 1.6, 0.8], [12, 1.4, 0.8]]) {
    const pts = isoEllipse(cx, cy, 11, r)
    cv.path('M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z', `fill="none" stroke="${C.jade2}" stroke-opacity="${o}" stroke-width="${w}"`)
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2
    const p0 = iso(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 11), p1 = iso(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32, 11)
    cv.path(`M${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}`, `stroke="${C.jade2}" stroke-opacity=".6" stroke-width="1.2"`)
  }
  const [mx, my] = iso(cx, cy, 11)
  cv.ellipse(mx, my - 18, 40, 34, `fill="url(#qi)"`)
  // 灵柱（先画后面的）
  const posts = [0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2 + Math.PI / 6; return [cx + Math.cos(a) * 34, cy + Math.sin(a) * 34] }).sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]))
  const beam = () => cv.path(`M${f(mx - 7)} ${f(my)}L${f(mx - 3)} ${f(my - 80)}L${f(mx + 3)} ${f(my - 80)}L${f(mx + 7)} ${f(my)}Z`, `fill="url(#beam)"`, [[mx, my - 80]])
  let beamDrawn = false
  for (const [px, py] of posts) {
    if (!beamDrawn && px + py > cx + cy) { beam(); vortex(cv, mx, my); beamDrawn = true }
    box(cv, { x: px - 3.5, y: py - 3.5, z: 11, w: 7, d: 7, h: 26, t: C.stone3, l: C.stone2, r: C.stone1 })
    const [tx, ty] = iso(px, py, 37)
    cv.path(`M${f(tx)} ${f(ty - 14)}l5 9 -5 7 -5 -7z`, `fill="${C.jade3}" ${STROKE}`, [[tx - 5, ty - 14]])
    cv.path(`M${f(tx)} ${f(ty - 14)}l5 9 -5 7z`, `fill="${C.jade2}"`)
    cv.circle(tx, ty - 7, 8, `fill="url(#qi)"`)
  }
  return cv
}
function vortex(cv, mx, my) {
  for (let i = 0; i < 3; i++) {
    const y = my - 24 - i * 17, rx = 26 - i * 6
    cv.path(`M${f(mx - rx)} ${f(y)}A${f(rx)} ${f(rx * 0.32)} 0 1 0 ${f(mx + rx * 0.7)} ${f(y - rx * 0.22)}`, `fill="none" stroke="${C.jade3}" stroke-opacity="${0.85 - i * 0.15}" stroke-width="${2.6 - i * 0.4}" stroke-linecap="round"`, [[mx - rx, y - rx * 0.35], [mx + rx, y + rx * 0.35]])
  }
}

// ── 灵田：梯田式田垄 + 发光灵草 + 小茅亭 ──
function lingtian() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 104, 84, 4)
  // 田埂底座
  box(cv, { x: 0, y: 0, z: 0, w: 104, d: 84, h: 5, t: C.grass2, l: C.wood1, r: C.wood0 })
  // 四块田
  const plots = [[6, 6], [56, 6], [6, 46], [56, 46]]
  plots.forEach(([x, y], k) => {
    const b = { x, y, z: 5, w: 42, d: 32, h: 3, t: k % 2 ? '#6b5236' : '#5d4731', l: C.wood1, r: C.wood0 }
    box(cv, b)
    // 田垄 + 灵苗
    for (let r = 0; r < 4; r++) {
      const yy = y + 5 + r * 7.5
      const a = iso(x + 3, yy, 8), c = iso(x + 39, yy, 8)
      cv.path(`M${f(a[0])} ${f(a[1])}L${f(c[0])} ${f(c[1])}`, `stroke="#3e2d1f" stroke-width="2.2" stroke-linecap="round"`)
      for (let s = 0; s < 5; s++) {
        const [sx, sy] = iso(x + 6 + s * 7.5, yy, 8)
        const glowy = (r + s + k) % 3 === 0
        cv.path(`M${f(sx)} ${f(sy)}q-5 -3 -5 -8q4 1 5 6q1 -6 5 -7q0 5 -5 9z`, `fill="${glowy ? C.jade3 : C.grass3}" stroke="${C.grass0}" stroke-width=".9"`, [[sx - 5, sy - 9]])
        if (glowy) cv.circle(sx, sy - 9, 1.6, `fill="${C.jade4}"`)
      }
    }
  })
  // 茅亭
  const t = { x: 84, y: 60, z: 5, w: 14, d: 14, h: 16 }
  for (const [px, py] of [[84, 60], [98, 60], [84, 74], [98, 74]]) box(cv, { x: px - 1, y: py - 1, z: 5, w: 2.5, d: 2.5, h: 16, t: C.wood2, l: C.wood2, r: C.wood1 })
  roof(cv, { ...t, z: 21, h: 14, o: 6, lift: 3, ridge: 1, colors: [C.paper0, '#a8905f', '#8a744a', C.paper1] })
  // 篱笆
  for (let i = 0; i < 9; i++) { const [a, b] = iso(0, 10 + i * 9, 0); cv.path(`M${f(a)} ${f(b)}v-10`, `stroke="${C.line}" stroke-width="3.2" stroke-linecap="round"`); cv.path(`M${f(a)} ${f(b)}v-10`, `stroke="${C.wood3}" stroke-width="1.6" stroke-linecap="round"`) }
  return cv
}

// ── 矿脉：嶙峋山体 + 木框矿洞 + 灵晶簇 ──
function kuangmai() {
  const cv = new Canvas()
  cv.def(glow('ore', C.gold3, 0.8))
  cv.ellipse(10, 62, 84, 15, `fill="#0b1219" fill-opacity=".24"`)
  const [bx0, by0] = iso(50, 40, 0)
  crag(cv, bx0 + 4, by0 + 14, 150, [[-30, -86], [10, -64], [44, -46]], 'kmRock')
  pine(cv, 24, 34, 0.7)
  // 矿洞
  const [ex, ey] = iso(34, 80, 0)
  cv.path(`M${f(ex - 14)} ${f(ey + 2)}L${f(ex - 12)} ${f(ey - 24)}Q${f(ex)} ${f(ey - 32)} ${f(ex + 12)} ${f(ey - 24)}L${f(ex + 14)} ${f(ey + 2)}Z`, `fill="${C.ink}" ${STROKE}`, [[ex - 14, ey - 32]])
  cv.ellipse(ex, ey - 6, 10, 8, `fill="url(#ore)"`)
  cv.path(`M${f(ex - 16)} ${f(ey + 3)}v-28M${f(ex + 16)} ${f(ey + 3)}v-28M${f(ex - 19)} ${f(ey - 25)}h38`, `stroke="${C.line}" stroke-width="5" stroke-linecap="round"`)
  cv.path(`M${f(ex - 16)} ${f(ey + 3)}v-28M${f(ex + 16)} ${f(ey + 3)}v-28M${f(ex - 19)} ${f(ey - 25)}h38`, `stroke="${C.wood2}" stroke-width="2.6" stroke-linecap="round"`)
  // 灵晶簇
  const crystal = (cx, cy, s, col = [C.gold3, C.gold2, C.gold1]) => {
    cv.circle(cx, cy - 8 * s, 14 * s, `fill="url(#ore)"`)
    for (const [dx, h, w, k] of [[-5, 14, 4, 2], [0, 22, 5, 0], [6, 16, 4, 1]]) {
      cv.path(`M${f(cx + (dx - w) * s)} ${f(cy)}L${f(cx + (dx - w * 0.7) * s)} ${f(cy - h * 0.7 * s)}L${f(cx + dx * s)} ${f(cy - h * s)}L${f(cx + (dx + w * 0.7) * s)} ${f(cy - h * 0.7 * s)}L${f(cx + (dx + w) * s)} ${f(cy)}Z`, `fill="${col[k]}" ${STROKE}`, [[cx + (dx - w) * s, cy - h * s]])
      cv.path(`M${f(cx + dx * s)} ${f(cy - h * s)}L${f(cx + dx * s)} ${f(cy)}`, `stroke="${C.gold4}" stroke-opacity=".7" stroke-width="1"`)
    }
  }
  crystal(8, 50, 1.5)
  crystal(58, 54, 1.1, [C.jade3, C.jade2, C.jade1])
  crystal(18, 4, 1)
  crystal(-16, -12, 0.8, [C.jade3, C.jade2, C.jade1])
  // 矿车
  box(cv, { x: 14, y: 84, z: 0, w: 14, d: 10, h: 8, t: C.gold2, l: C.wood2, r: C.wood1 })
  return cv
}

// ── 演武场：方形石台 + 兵器架 + 木人桩 + 旗 ──
function yanwu() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 110, 90)
  const b = plinth(cv, 0, 0, 110, 90, 8)
  void b
  // 台面方砖
  for (let i = 1; i < 6; i++) {
    const a = iso(i * 110 / 6, 0, 8), c = iso(i * 110 / 6, 90, 8)
    cv.path(`M${f(a[0])} ${f(a[1])}L${f(c[0])} ${f(c[1])}`, `stroke="${C.stone1}" stroke-opacity=".5" stroke-width="1"`)
  }
  for (let i = 1; i < 5; i++) {
    const a = iso(0, i * 90 / 5, 8), c = iso(110, i * 90 / 5, 8)
    cv.path(`M${f(a[0])} ${f(a[1])}L${f(c[0])} ${f(c[1])}`, `stroke="${C.stone1}" stroke-opacity=".5" stroke-width="1"`)
  }
  // 中央阵圆
  const pts = isoEllipse(55, 45, 8, 24)
  cv.path('M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z', `fill="${C.red1}" fill-opacity=".22" stroke="${C.red2}" stroke-width="2"`)
  const pts2 = isoEllipse(55, 45, 8, 16)
  cv.path('M' + pts2.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z', `fill="none" stroke="${C.red2}" stroke-opacity=".6" stroke-width="1.2"`)
  // 后排兵器架
  box(cv, { x: 8, y: 4, z: 8, w: 40, d: 5, h: 3, t: C.wood2, l: C.wood1, r: C.wood0 })
  for (let i = 0; i < 5; i++) {
    const [wx, wy] = iso(12 + i * 8, 6, 11)
    cv.path(`M${f(wx)} ${f(wy)}L${f(wx)} ${f(wy - 30)}`, `stroke="${C.line}" stroke-width="3" stroke-linecap="round"`, [[wx, wy - 36]])
    cv.path(`M${f(wx)} ${f(wy)}L${f(wx)} ${f(wy - 30)}`, `stroke="${C.wood3}" stroke-width="1.4"`)
    cv.path(i % 2 ? `M${f(wx - 3)} ${f(wy - 30)}l3 -7 3 7z` : `M${f(wx - 4)} ${f(wy - 28)}q4 -10 4 -10q2 6 4 10z`, `fill="${C.stone4}" ${STROKE}`)
  }
  box(cv, { x: 8, y: 4, z: 30, w: 40, d: 3, h: 3, t: C.wood2, l: C.wood1, r: C.wood0 })
  // 木人桩
  for (const [x, y] of [[80, 30], [88, 62]]) {
    box(cv, { x: x - 3, y: y - 3, z: 8, w: 6, d: 6, h: 28, t: C.wood3, l: C.wood2, r: C.wood1 })
    const [ax, ay] = iso(x, y, 26)
    cv.path(`M${f(ax - 10)} ${f(ay)}h20M${f(ax - 8)} ${f(ay + 7)}h16`, `stroke="${C.line}" stroke-width="4.2" stroke-linecap="round"`)
    cv.path(`M${f(ax - 10)} ${f(ay)}h20M${f(ax - 8)} ${f(ay + 7)}h16`, `stroke="${C.wood3}" stroke-width="2.2" stroke-linecap="round"`)
  }
  banner(cv, 4, 86, 8, 46)
  banner(cv, 106, 4, 8, 46, C.jade1)
  return cv
}

// ── 洞府三档：山洞 → 洞前亭 → 山庄 ──
function mound(cv, s, tier) {
  crag(cv, 0, 30 * s, 150 * s, tier === 3 ? [[-36 * s, -104 * s], [8 * s, -128 * s], [46 * s, -84 * s]] : [[-30 * s, -96 * s], [14 * s, -116 * s], [48 * s, -70 * s]], 'dfRock')
  return (x, y, z) => iso(x * s, y * s, z * s)
}
function moonGate(cv, x, y, r, glowId) {
  cv.circle(x, y, r + 4, `fill="${C.stone4}" ${STROKE}`)
  cv.circle(x, y, r, `fill="${C.ink}" ${STROKE}`)
  cv.circle(x, y + 2, r * 0.8, `fill="url(#${glowId})"`)
  cv.path(`M${f(x - r - 4)} ${f(y + r * 0.5)}h${f(r * 2 + 8)}v${f(r * 0.6)}h${f(-(r * 2 + 8))}z`, `fill="${C.stone3}" ${STROKE}`)
}
function dongfu(tier) {
  const cv = new Canvas()
  cv.def(glow('cave', C.jade2, 0.9))
  cv.def(lin('fall', [[0, C.jade4, 0.95], [1, C.blue3, 0.55]]))
  const s = tier === 1 ? 1 : 1.1
  // 屏幕坐标 → 等距地面坐标，方便在山体前「落」物件
  const at = (sx, sy) => [(sx / 0.866 + 2 * sy) / 2, (2 * sy - sx / 0.866) / 2]
  cv.ellipse(6, 30 * s + 4, 86 * s, 16 * s, `fill="#0b1219" fill-opacity=".24"`)
  mound(cv, s, tier)
  if (tier === 3) {
    const ax = 30 * s, ay = -40 * s, bx = 38 * s, by = 26 * s
    cv.path(`M${f(ax - 4)} ${f(ay)}Q${f(ax + 6)} ${f(ay - 2)} ${f(ax + 5)} ${f(ay + 4)}L${f(bx + 8)} ${f(by)}L${f(bx - 8)} ${f(by)}Z`, `fill="url(#fall)" ${STROKE}`)
    for (const d of [-2.5, 2.5]) cv.path(`M${f(ax + d)} ${f(ay + 8)}L${f(bx + d * 2.2)} ${f(by - 4)}`, `stroke="#fff" stroke-opacity=".7" stroke-width="1.2"`)
    cv.ellipse(bx, by + 1, 18, 5.5, `fill="${C.jade4}" fill-opacity=".8" ${STROKE}`)
    // 山顶小阁 + 灵光
    const [tx, ty] = at(-30 * s, -44 * s)
    cv.circle(-30 * s, -62 * s, 34, `fill="url(#cave)"`)
    box(cv, { x: tx - 12, y: ty - 12, z: 0, w: 24, d: 24, h: 3, t: C.stone4, l: C.stone2, r: C.stone1 })
    hall(cv, { x: tx - 9, y: ty - 9, z: 3, w: 18, d: 18, h: 12, cols: 2, door: false })
    roof(cv, { x: tx - 9, y: ty - 9, z: 15, w: 18, d: 18, h: 16, o: 6, lift: 4, ridge: 1, colors: GOLD_TILE, gold: true })
  }
  const gx = -8 * s, gy = 4 * s
  moonGate(cv, gx, gy, 15 * s, 'cave')
  cv.path(`M${f(gx - 11)} ${f(gy - 29 * s)}h22v8h-22z`, `fill="${C.ink2}" ${STROKE}`)
  cv.path(`M${f(gx - 6)} ${f(gy - 25 * s)}h12`, `stroke="${C.gold2}" stroke-width="1.6"`)
  const [sx0, sy0] = at(gx, 24 * s)
  for (let i = 0; i < 3; i++) box(cv, { x: sx0 - 12 + i * 3, y: sy0 - 4 + i * 3, z: 0, w: 22 - i * 2, d: 10 - i * 3, h: 7 - i * 2.2, t: C.stone4, l: C.stone2, r: C.stone1 })
  const [px0, py0] = at(-70 * s, 30 * s)
  pine(cv, px0, py0, 0.95)
  if (tier >= 2) {
    const [px, py] = at(52 * s, 30 * s)
    box(cv, { x: px - 11, y: py - 11, z: 0, w: 22, d: 22, h: 3, t: C.stone4, l: C.stone2, r: C.stone1 })
    for (const [x, y] of [[px - 8, py - 8], [px + 8, py - 8], [px - 8, py + 8], [px + 8, py + 8]]) box(cv, { x: x - 1.2, y: y - 1.2, z: 3, w: 2.4, d: 2.4, h: 18, t: C.red1, l: C.red1, r: C.red0 })
    roof(cv, { x: px - 8, y: py - 8, z: 21, w: 16, d: 16, h: 14, o: 6, lift: 4, ridge: 1, colors: tier === 3 ? GOLD_TILE : TILE, gold: tier === 3 })
    const [bx, by] = at(-40 * s, 38 * s)
    bush(cv, bx, by, 0.8)
  }
  if (tier === 3) { const [lx, ly] = at(18 * s, 30 * s); lantern(cv, lx, ly, 16) }
  return cv
}

save('building/zongmen.svg', zongmen())
save('building/cangjing.svg', cangjing())
save('building/lianqi.svg', lianqi())
save('building/liandan.svg', liandan())
save('building/fangshi.svg', fangshi())
save('building/juling-formation.svg', juling())
save('building/lingtian.svg', lingtian())
save('building/kuangmai.svg', kuangmai())
save('building/yanwu.svg', yanwu())
save('building/dongfu.svg', dongfu(1))
save('building/dongfu-t2.svg', dongfu(2))
save('building/dongfu-t3.svg', dongfu(3))
