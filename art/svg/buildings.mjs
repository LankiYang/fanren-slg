// 洞府场景建筑（精细版）：等距视角；石基砌缝、方砖地、朱柱隔扇、彩画额枋、斗拱、筒瓦屋面、汉白玉栏杆。
import { C, Canvas, save, iso, P, unIso, box, quadL, quadR, onL, onR, archL, roof, isoEllipse, pine, bush, crag, STROKE, THIN, f, dk, lt, rnd, srand } from './lib.mjs'

const TILE = [C.tile2, C.tile1, C.tile0, C.tile3]
const GOLD_TILE = [C.gold1, C.gold0, C.wood1, C.gold3]
const THATCH = [C.paper0, '#a8905f', '#8a744a', C.paper1]

function shadow(cv, x, y, w, d, pad = 8) {
  cv.poly(P([[x - pad, y - pad * 0.2, 0], [x + w + pad * 1.6, y - pad * 0.2, 0], [x + w + pad * 1.6, y + d + pad * 1.6, 0], [x - pad, y + d + pad * 1.6, 0]]), '#0b1219', 'fill-opacity=".24"')
}

/** 须弥座石台：条石砌缝 + 方砖台面 + 上下枭混线 */
function plinth(cv, x, y, w, d, h, z = 0, top = C.stone3) {
  const b = box(cv, { x, y, z, w, d, h, t: top, l: C.stone2, r: C.stone1, tex: 'stone', texTop: 'flag' })
  if (h >= 6) {
    onL(cv, b, 0, 1, 0.82, 0.9, dk(C.stone2, 0.15), THIN)
    onR(cv, b, 0, 1, 0.82, 0.9, dk(C.stone1, 0.15), THIN)
    onL(cv, b, 0, 1, 0.08, 0.16, dk(C.stone2, 0.12), THIN)
    onR(cv, b, 0, 1, 0.08, 0.16, dk(C.stone1, 0.12), THIN)
  }
  return b
}

/** 汉白玉栏杆：沿台面前两条边（左边 y=max、右边 x=max），gaps 为左边上留给台阶的缺口 [u0,u1] */
function railing(cv, b, { gaps = [], left = true, right = true, step = 6, col = C.stone4 } = {}) {
  const z = b.z + b.h
  const post = (px, py) => {
    box(cv, { x: px - 0.8, y: py - 0.8, z, w: 1.6, d: 1.6, h: 5.2, t: col, l: col, r: dk(col, 0.2), ao: false })
    const [cx, cy] = iso(px, py, z + 5.2)
    cv.circle(cx, cy - 0.8, 1.2, `fill="${lt(col, 0.2)}" ${THIN}`)
  }
  const rail = (a, bb) => {
    for (const hz of [1.6, 4]) cv.line([iso(a[0], a[1], z + hz), iso(bb[0], bb[1], z + hz)], `stroke="${C.line}" stroke-opacity=".6" stroke-width="1.9"`)
    for (const hz of [1.6, 4]) cv.line([iso(a[0], a[1], z + hz), iso(bb[0], bb[1], z + hz)], `stroke="${col}" stroke-width="1.1"`)
  }
  if (right) {
    const n = Math.max(2, Math.round(b.d / step))
    for (let i = 0; i < n; i++) rail([b.x + b.w, b.y + b.d * i / n], [b.x + b.w, b.y + b.d * (i + 1) / n])
    for (let i = 0; i <= n; i++) post(b.x + b.w, b.y + b.d * i / n)
  }
  if (left) {
    const n = Math.max(2, Math.round(b.w / step))
    const inGap = u => gaps.some(([a, c]) => u > a && u < c)
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; if (!inGap(u)) rail([b.x + b.w * i / n, b.y + b.d], [b.x + b.w * (i + 1) / n, b.y + b.d]) }
    for (let i = 0; i <= n; i++) { const u = i / n; if (!inGap(u) || gaps.some(([a, c]) => Math.abs(u - a) < 0.02 || Math.abs(u - c) < 0.02)) post(b.x + b.w * u, b.y + b.d) }
  }
}

/** 台阶：逐级踏步 + 两侧垂带石 */
function stairs(cv, xc, yEdge, width, steps, stepH, depth, z0 = 0) {
  for (let i = 0; i < steps; i++) {
    box(cv, { x: xc - width / 2, y: yEdge, z: z0, w: width, d: depth * (steps - i), h: stepH * (i + 1), t: C.stone4, l: C.stone3, r: C.stone2, ao: false })
  }
  for (const sx of [xc - width / 2 - 1.6, xc + width / 2]) {
    const W = 1.6
    const pts = [[sx, yEdge, z0], [sx + W, yEdge, z0], [sx + W, yEdge, z0 + steps * stepH + 1], [sx, yEdge, z0 + steps * stepH + 1], [sx, yEdge + depth * steps, z0 + 1.5], [sx + W, yEdge + depth * steps, z0 + 1.5]]
    cv.poly(P([pts[0], [sx, yEdge + depth * steps, z0], pts[4], pts[3]]), C.stone3, STROKE)
    cv.poly(P([pts[3], pts[4], pts[5], pts[2]]), C.stone4, STROKE)
    cv.poly(P([[sx + W, yEdge + depth * steps, z0], pts[5], pts[2], pts[1]]), C.stone2, STROKE)
  }
}

/** 匾额：深蓝底、金边、两个金字（笔画示意） */
function plaque(cv, b, u0, u1, v0, v1, face = 'L') {
  const q = face === 'L' ? quadL(b, u0, u1, v0, v1) : quadR(b, u0, u1, v0, v1)
  cv.poly(q, C.gold1, STROKE)
  const inner = face === 'L' ? quadL(b, u0 + (u1 - u0) * 0.08, u1 - (u1 - u0) * 0.08, v0 + (v1 - v0) * 0.16, v1 - (v1 - v0) * 0.16) : quadR(b, u0 + (u1 - u0) * 0.08, u1 - (u1 - u0) * 0.08, v0 + (v1 - v0) * 0.16, v1 - (v1 - v0) * 0.16)
  cv.poly(inner, cv.grad([[0, C.blue1], [1, C.blue0]]), THIN)
  const cx = (inner[0][0] + inner[2][0]) / 2, cy = (inner[0][1] + inner[2][1]) / 2
  const dx = (inner[1][0] - inner[0][0]) * 0.22, dy = (inner[1][1] - inner[0][1]) * 0.22
  for (const s of [-1, 1]) {
    const gx = cx + dx * s, gy = cy + dy * s
    cv.path(`M${f(gx - 1.3)} ${f(gy - 1.2)}h2.6M${f(gx)} ${f(gy - 2)}v3.6M${f(gx - 1.4)} ${f(gy + 0.4)}l1.4 1.2 1.4 -1.2`, `fill="none" stroke="${C.gold3}" stroke-width=".55" stroke-linecap="round"`)
  }
}

/**
 * 殿身：灰泥墙 + 石裙墙 + 隔扇门/棂窗 + 朱柱柱础 + 彩画额枋 + 斗拱 + 檐下阴影
 */
function hall(cv, { x, y, z, w, d, h, cols = 4, door = true, wall = C.paper1, pillar = C.red1, winTex = 'lattice', doorCol = C.red1, rightWin = true, plaqueOn = false }) {
  const b = box(cv, { x, y, z, w, d, h, t: wall, l: wall, r: dk(wall, 0.14), tex: 'plaster', ao: false })
  // 石裙墙
  for (const [q, col] of [[quadL(b, 0, 1, 0, 0.13), C.stone2], [quadR(b, 0, 1, 0, 0.13), C.stone1]]) { cv.poly(q, col, THIN) }
  cv.poly(quadL(b, 0, 1, 0, 0.13), cv.pat('brickL')); cv.poly(quadR(b, 0, 1, 0, 0.13), cv.pat('brickR'))
  const rc = Math.max(2, Math.round(cols * d / w))
  const doorBay = Math.floor((cols - 1) / 2)
  const bays = (quad, n, face) => {
    for (let i = 0; i < n; i++) {
      const u0 = i / n + 0.05, u1 = (i + 1) / n - 0.05
      const isDoor = face === 'L' && door && (i === doorBay || (cols >= 5 && Math.abs(i - (cols - 1) / 2) <= 1))
      if (isDoor) {
        cv.poly(quad(u0, u1, 0.02, 0.76), dk(doorCol, 0.15), STROKE)
        cv.poly(quad(u0, u1, 0.3, 0.72), cv.pat(winTex + face))
        cv.poly(quad(u0 + 0.01, u1 - 0.01, 0.07, 0.24), lt(doorCol, 0.08), THIN)
        const leaves = 4
        for (let k = 1; k < leaves; k++) { const u = u0 + (u1 - u0) * k / leaves; cv.line([quad(u, u, 0.02, 0.76)[0], quad(u, u, 0.02, 0.76)[3]], `stroke="${C.line}" stroke-opacity=".7" stroke-width=".6"`) }
        const mid = quad((u0 + u1) / 2, (u0 + u1) / 2, 0.42, 0.42)[0]
        for (const s of [-1.2, 1.2]) cv.circle(mid[0] + s, mid[1], 0.7, `fill="${C.gold3}"`)
      } else if (face === 'L' || rightWin) {
        cv.poly(quad(u0, u1, 0.22, 0.72), C.ink2, STROKE)
        cv.poly(quad(u0 + 0.01, u1 - 0.01, 0.24, 0.7), cv.pat(winTex + face))
        cv.poly(quad(u0 - 0.01, u1 + 0.01, 0.19, 0.22), C.wood1, THIN)
      }
    }
  }
  bays((a, c, v0, v1) => quadL(b, a, c, v0, v1), cols, 'L')
  bays((a, c, v0, v1) => quadR(b, a, c, v0, v1), rc, 'R')
  // 朱柱 + 柱础
  const pil = (q, qb) => { cv.poly(q, cv.grad([[0, dk(pillar, 0.25)], [0.45, lt(pillar, 0.18)], [1, dk(pillar, 0.3)]], 'h'), STROKE); cv.poly(qb, C.stone3, THIN) }
  for (let i = 0; i <= cols; i++) { const u = i / cols, a = Math.max(0, u - 0.03), c = Math.min(1, u + 0.03); pil(quadL(b, a, c, 0.04, 1), quadL(b, a - 0.012, c + 0.012, 0, 0.05)) }
  for (let i = 0; i <= rc; i++) { const u = i / rc, a = Math.max(0, u - 0.04), c = Math.min(1, u + 0.04); pil(quadR(b, a, c, 0.04, 1), quadR(b, a - 0.015, c + 0.015, 0, 0.05)) }
  // 彩画额枋：青绿底 + 金线 + 旋子
  for (const [q, n, face] of [[quadL(b, 0, 1, 0.76, 0.88), cols, 'L'], [quadR(b, 0, 1, 0.76, 0.88), rc, 'R']]) {
    cv.poly(q, cv.grad([[0, face === 'L' ? C.blue2 : C.blue1], [1, face === 'L' ? C.jade1 : C.jade0]]), STROKE)
    cv.line([q[3], q[2]], `stroke="${C.gold2}" stroke-width=".6"`)
    cv.line([q[0], q[1]], `stroke="${C.gold2}" stroke-width=".6"`)
    for (let i = 0; i < n; i++) {
      const qq = face === 'L' ? quadL(b, (i + 0.5) / n, (i + 0.5) / n, 0.82, 0.82) : quadR(b, (i + 0.5) / n, (i + 0.5) / n, 0.82, 0.82)
      cv.ellipse(qq[0][0], qq[0][1], 2, 1.1, `fill="none" stroke="${C.gold3}" stroke-width=".5"`)
      cv.circle(qq[0][0], qq[0][1], 0.5, `fill="${C.gold3}"`)
    }
  }
  // 斗拱：青、绿相间的小斗
  for (const [face, len] of [['L', w], ['R', d]]) {
    const n = Math.max(4, Math.round(len / 3.4))
    for (let i = 0; i < n; i++) {
      const u0 = i / n + 0.12 / n, u1 = (i + 1) / n - 0.12 / n
      const q = face === 'L' ? quadL(b, u0, u1, 0.88, 1) : quadR(b, u0, u1, 0.88, 1)
      cv.poly(q, i % 2 ? C.jade1 : C.blue1, THIN)
      cv.line([q[3], q[2]], `stroke="${C.gold2}" stroke-width=".4"`)
    }
  }
  // 檐下阴影
  const sh = cv.grad([[0, '#000', 0.42], [0.35, '#000', 0]])
  cv.poly(quadL(b, 0, 1, 0, 1), sh); cv.poly(quadR(b, 0, 1, 0, 1), sh)
  if (plaqueOn) plaque(cv, b, 0.38, 0.62, 0.6, 0.74)
  return b
}

function banner(cv, x, y, z, h, col = C.red2) {
  const [bx, by] = iso(x, y, z), [tx, ty] = iso(x, y, z + h)
  box(cv, { x: x - 2, y: y - 2, z, w: 4, d: 4, h: 2.4, t: C.stone3, l: C.stone2, r: C.stone1, ao: false })
  cv.line([[bx, by], [tx, ty]], `stroke="${C.line}" stroke-width="2.6" stroke-linecap="round"`)
  cv.line([[bx, by], [tx, ty]], `stroke="${cv.grad([[0, C.wood3], [1, C.wood1]], 'h')}" stroke-width="1.4"`)
  cv.path(`M${f(tx)} ${f(ty - 1)}l-1.6 -3.4h3.2z`, `fill="${C.gold2}" ${THIN}`, [[tx, ty - 5]])
  cv.path(`M${f(tx - 1)} ${f(ty + 1)}h7`, `stroke="${C.gold1}" stroke-width="1.2"`)
  // 旗面带飘动褶皱 + 回纹镶边 + 流苏（整面随风摆）
  cv.open('a-sway', (Math.abs(tx) * 0.13) % 2.6)
  const d = `M${f(tx + 1)} ${f(ty + 2)}C${f(tx + 6)} ${f(ty + 1)} ${f(tx + 10)} ${f(ty + 4)} ${f(tx + 15)} ${f(ty + 3)}C${f(tx + 13)} ${f(ty + 12)} ${f(tx + 15)} ${f(ty + 20)} ${f(tx + 16)} ${f(ty + 27)}C${f(tx + 11)} ${f(ty + 27)} ${f(tx + 6)} ${f(ty + 24)} ${f(tx + 1)} ${f(ty + 25)}Z`
  cv.path(d, `fill="${cv.grad([[0, lt(col, 0.1)], [1, dk(col, 0.2)]], 'h')}" ${STROKE}`, [[tx, ty], [tx + 17, ty + 30]])
  cv.path(`M${f(tx + 3)} ${f(ty + 4.5)}C${f(tx + 7)} ${f(ty + 4)} ${f(tx + 10)} ${f(ty + 6)} ${f(tx + 13)} ${f(ty + 5.4)}M${f(tx + 3)} ${f(ty + 22.5)}C${f(tx + 7)} ${f(ty + 22)} ${f(tx + 10)} ${f(ty + 24)} ${f(tx + 14)} ${f(ty + 24.6)}`, `fill="none" stroke="${C.gold3}" stroke-width=".7"`)
  cv.circle(tx + 8.5, ty + 14, 3.4, `fill="none" stroke="${C.gold3}" stroke-width=".8"`)
  cv.path(`M${f(tx + 7)} ${f(ty + 12.6)}h3M${f(tx + 8.5)} ${f(ty + 11.8)}v4.4M${f(tx + 7)} ${f(ty + 15.6)}h3`, `stroke="${C.gold3}" stroke-width=".6"`)
  for (let i = 0; i < 4; i++) cv.path(`M${f(tx + 2 + i * 4.4)} ${f(ty + 25 + i * 0.6)}v3`, `stroke="${C.gold2}" stroke-width=".7"`)
  cv.close()
}

function lantern(cv, x, y, z, hang = true) {
  const [px, py] = iso(x, y, z)
  const dl = (Math.abs(px * 0.37 + py * 0.11)) % 1.7
  cv.open('a-flicker', dl); cv.circle(px, py - 4, 9, `fill="${cv.rad(C.fire2, 0.45)}"`); cv.close()
  if (hang) cv.path(`M${f(px)} ${f(py - 13)}v4`, `stroke="${C.line}" stroke-width=".8"`, [[px, py - 13]])
  cv.path(`M${f(px - 2.4)} ${f(py - 9)}h4.8v1.2h-4.8z`, `fill="${C.gold1}" ${THIN}`, [[px - 3, py - 9]])
  cv.ellipse(px, py - 4.2, 4.2, 4.8, `fill="${cv.grad([[0, C.red3], [0.5, C.red2], [1, C.red0]], 'h')}" ${STROKE}`)
  for (const dx of [-2, 0, 2]) cv.path(`M${f(px + dx)} ${f(py - 8.8)}Q${f(px + dx * 1.6)} ${f(py - 4.2)} ${f(px + dx)} ${f(py + 0.4)}`, `fill="none" stroke="${C.red0}" stroke-opacity=".5" stroke-width=".4"`)
  cv.open('a-flicker', dl); cv.ellipse(px - 1, py - 5, 1.4, 2.2, `fill="${C.fire3}" fill-opacity=".75"`); cv.close()
  cv.path(`M${f(px - 2.4)} ${f(py + 0.4)}h4.8`, `stroke="${C.gold1}" stroke-width="1"`)
  cv.path(`M${f(px)} ${f(py + 0.6)}v3.4`, `stroke="${C.red1}" stroke-width=".9"`, [[px, py + 4]])
}

/** 石灯笼：基座 + 灯柱 + 发光灯室 + 宝珠顶 */
function stoneLamp(cv, x, y, z = 0) {
  box(cv, { x: x - 2.6, y: y - 2.6, z, w: 5.2, d: 5.2, h: 1.6, t: C.stone3, l: C.stone2, r: C.stone1, ao: false, hi: false })
  box(cv, { x: x - 1, y: y - 1, z: z + 1.6, w: 2, d: 2, h: 5, t: C.stone3, l: C.stone2, r: C.stone1, ao: false, hi: false })
  const lb = box(cv, { x: x - 2.2, y: y - 2.2, z: z + 6.6, w: 4.4, d: 4.4, h: 3.6, t: C.stone3, l: C.stone2, r: C.stone1, ao: false, hi: false })
  const q = quadL(lb, 0.25, 0.75, 0.2, 0.8)
  cv.poly(q, C.fire2, THIN)
  const [cx, cy] = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]
  cv.open('a-flicker', (Math.abs(cx) * 0.21) % 1.7); cv.poly(q, C.fire3); cv.circle(cx, cy, 5, `fill="${cv.rad(C.fire2, 0.55)}"`); cv.close()
  const [ax, ay] = iso(x, y, z + 10.2), [tx, ty] = iso(x, y, z + 13.4)
  cv.path(`M${f(ax - 5)} ${f(ay + 1.2)}Q${f(ax)} ${f(ay - 1)} ${f(ax + 5)} ${f(ay + 1.2)}L${f(tx)} ${f(ty)}Z`, `fill="${cv.grad([[0, C.stone4], [1, C.stone2]], 'h')}" ${STROKE}`, [[ax - 5, ty], [ax + 5, ay + 1.2]])
  cv.circle(tx, ty - 1, 1, `fill="${C.stone3}" ${THIN}`)
}

/** 石狮（简化蹲姿） */
function lion(cv, x, y, z, dir = 1) {
  box(cv, { x: x - 3, y: y - 3, z, w: 6, d: 6, h: 3, t: C.stone3, l: C.stone2, r: C.stone1, ao: false })
  const [px, py] = iso(x, y, z + 3)
  cv.path(`M${f(px - 3.4)} ${f(py + 1)}C${f(px - 4)} ${f(py - 6)} ${f(px + 2)} ${f(py - 9)} ${f(px + 3.4)} ${f(py - 4)}L${f(px + 3.4)} ${f(py + 1.6)}Z`, `fill="${cv.grad([[0, C.stone4], [1, C.stone2]])}" ${STROKE}`, [[px - 4, py - 12], [px + 4, py + 2]])
  cv.circle(px + dir * 1, py - 8.6, 3, `fill="${C.stone3}" ${STROKE}`)
  for (let k = 0; k < 5; k++) cv.circle(px + dir * 1 + Math.cos(k * 1.3) * 2.2, py - 8.6 + Math.sin(k * 1.3) * 2.2, 0.8, `fill="${C.stone2}"`)
  cv.circle(px + dir * 2, py - 9, 0.5, `fill="${C.line}"`)
}

/** 香炉鼎：三足、双耳、腹部回纹 */
function censer(cv, px, py, s = 1, glowC = C.fire2) {
  const S = v => v * s
  cv.ellipse(px, py + S(2), S(20), S(7), 'fill="#000" fill-opacity=".25"')
  for (const dx of [-11, 0, 11]) cv.path(`M${f(px + S(dx))} ${f(py - S(4))}l${f(S(dx * 0.12))} ${f(S(8))}`, `stroke="${C.line}" stroke-width="${f(S(3.4))}" stroke-linecap="round"`, [[px + S(dx), py + S(4)]])
  for (const dx of [-11, 0, 11]) cv.path(`M${f(px + S(dx))} ${f(py - S(4))}l${f(S(dx * 0.12))} ${f(S(8))}`, `stroke="${C.gold0}" stroke-width="${f(S(1.8))}" stroke-linecap="round"`)
  cv.path(`M${f(px - S(17))} ${f(py - S(22))}Q${f(px - S(18))} ${f(py - S(2))} ${f(px)} ${f(py)}Q${f(px + S(18))} ${f(py - S(2))} ${f(px + S(17))} ${f(py - S(22))}Z`, `fill="${cv.grad([[0, C.gold0], [0.35, C.gold2], [0.6, C.gold1], [1, C.gold0]], 'h')}" ${STROKE}`, [[px - S(18), py - S(24)], [px + S(18), py]])
  // 腹部纹带：回纹 + 饕餮眼
  cv.path(`M${f(px - S(15))} ${f(py - S(15))}Q${f(px)} ${f(py - S(10))} ${f(px + S(15))} ${f(py - S(15))}M${f(px - S(13))} ${f(py - S(9))}Q${f(px)} ${f(py - S(4))} ${f(px + S(13))} ${f(py - S(9))}`, `fill="none" stroke="${C.gold0}" stroke-width="${f(S(0.9))}"`)
  for (let i = -3; i <= 3; i++) cv.path(`M${f(px + S(i * 4) - S(1.2))} ${f(py - S(12.5) + Math.abs(i) * S(0.4))}h${f(S(2.4))}v${f(S(1.6))}h${f(-S(1.4))}`, `fill="none" stroke="${C.gold3}" stroke-opacity=".8" stroke-width="${f(S(0.5))}"`)
  for (const s2 of [-1, 1]) cv.ellipse(px + s2 * S(4), py - S(6.5), S(1.6), S(1), `fill="${C.gold3}" fill-opacity=".8"`)
  cv.ellipse(px, py - S(22), S(17), S(5.6), `fill="${C.gold0}" ${STROKE}`)
  cv.ellipse(px, py - S(22.4), S(13), S(3.6), `fill="${dk(glowC, 0.3)}"`)
  cv.ellipse(px, py - S(22.6), S(9), S(2.4), `fill="${glowC}"`)
  for (const s2 of [-1, 1]) {
    cv.path(`M${f(px + s2 * S(13))} ${f(py - S(24))}q${f(s2 * S(1))} ${f(-S(9))} ${f(s2 * S(8))} ${f(-S(8))}q${f(s2 * S(1))} ${f(S(3))} ${f(-s2 * S(2))} ${f(S(6))}`, `fill="none" stroke="${C.line}" stroke-width="${f(S(3.2))}" stroke-linecap="round"`, [[px + s2 * S(22), py - S(34)]])
    cv.path(`M${f(px + s2 * S(13))} ${f(py - S(24))}q${f(s2 * S(1))} ${f(-S(9))} ${f(s2 * S(8))} ${f(-S(8))}q${f(s2 * S(1))} ${f(S(3))} ${f(-s2 * S(2))} ${f(S(6))}`, `fill="none" stroke="${C.gold2}" stroke-width="${f(S(1.6))}" stroke-linecap="round"`)
  }
  cv.path(`M${f(px - S(10))} ${f(py - S(18))}Q${f(px - S(12))} ${f(py - S(8))} ${f(px - S(6))} ${f(py - S(4))}`, `fill="none" stroke="${C.gold4}" stroke-opacity=".6" stroke-width="${f(S(1.2))}" stroke-linecap="round"`)
}

function smoke(cv, px, py, h = 40, col = C.paper2, o = 0.55) {
  // 两缕错开半周期的烟，循环上升淡出
  for (const [dl, dx] of [[0, 0], [2.1, 3]]) {
    cv.open('a-smoke', dl)
    cv.path(`M${f(px + dx)} ${f(py)}c-6 -6 -8 -12 -2 -${f(h * 0.3)}c6 -6 4 -12 -1 -${f(h * 0.25)}c-5 -5 -3 -12 3 -${f(h * 0.25)}`, `fill="none" stroke="${col}" stroke-opacity="${o}" stroke-width="3.2" stroke-linecap="round"`, [[px - 10, py - h], [px + 6, py]])
    cv.path(`M${f(px + 3 + dx)} ${f(py - 2)}c5 -5 6 -10 1 -${f(h * 0.25)}c-4 -4 -3 -9 2 -${f(h * 0.2)}`, `fill="none" stroke="${col}" stroke-opacity="${o * 0.7}" stroke-width="2" stroke-linecap="round"`)
    cv.close()
  }
}

// ── 宗门大殿 ──
function zongmen() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 130, 104)
  const p1 = plinth(cv, 0, 0, 130, 104, 7)
  const p2 = plinth(cv, 12, 8, 106, 74, 9, 7)
  banner(cv, 124, 12, 7, 46, C.red2)
  hall(cv, { x: 22, y: 16, z: 16, w: 86, d: 50, h: 32, cols: 5 })
  roof(cv, { x: 22, y: 16, z: 48, w: 86, d: 50, h: 12, o: 11, lift: 6, ridge: 0.9, colors: GOLD_TILE, gold: true })
  const up = hall(cv, { x: 36, y: 26, z: 56, w: 58, d: 30, h: 13, cols: 4, door: false, rightWin: true })
  plaque(cv, up, 0.34, 0.66, 0.1, 0.86)
  roof(cv, { x: 36, y: 26, z: 69, w: 58, d: 30, h: 24, o: 10, lift: 7, ridge: 0.5, colors: GOLD_TILE, gold: true })
  railing(cv, p2, { gaps: [[0.33, 0.67]], step: 7 })
  stairs(cv, 65, 82, 30, 4, 4, 3.4, 0)
  censer(cv, ...iso(65, 96, 7), 0.55)
  { const [sx, sy] = iso(65, 96, 7); smoke(cv, sx, sy - 13, 30, C.paper2, 0.5) }
  lion(cv, 44, 98, 7, -1); lion(cv, 86, 98, 7, 1)
  stoneLamp(cv, 16, 98, 7); stoneLamp(cv, 124, 90, 7)
  banner(cv, 6, 100, 7, 46, C.red2)
  lantern(cv, 40, 68, 34); lantern(cv, 92, 68, 34)
  void p1
  return cv
}

// ── 藏经阁：三层方阁，二三层带平座栏杆 ──
function cangjing() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 64, 64, 6)
  const p = plinth(cv, 0, 0, 64, 64, 7)
  const h1 = hall(cv, { x: 8, y: 8, z: 7, w: 48, d: 48, h: 26, cols: 3 })
  plaque(cv, h1, 0.3, 0.7, 0.62, 0.75)
  roof(cv, { x: 8, y: 8, z: 33, w: 48, d: 48, h: 8, o: 9, lift: 6, ridge: 0.95, colors: TILE })
  const deck2 = box(cv, { x: 10, y: 10, z: 38, w: 44, d: 44, h: 2, t: C.wood2, l: C.wood1, r: C.wood0, ao: false, texTop: 'plank' })
  hall(cv, { x: 14, y: 14, z: 40, w: 36, d: 36, h: 18, cols: 3, door: false, winTex: 'ice' })
  railing(cv, deck2, { step: 5.5, col: C.red1 })
  roof(cv, { x: 14, y: 14, z: 58, w: 36, d: 36, h: 7, o: 8, lift: 5, ridge: 0.95, colors: TILE })
  const deck3 = box(cv, { x: 16, y: 16, z: 62, w: 32, d: 32, h: 2, t: C.wood2, l: C.wood1, r: C.wood0, ao: false })
  hall(cv, { x: 19, y: 19, z: 64, w: 26, d: 26, h: 15, cols: 2, door: false, winTex: 'ice' })
  railing(cv, deck3, { step: 5.5, col: C.red1 })
  roof(cv, { x: 19, y: 19, z: 79, w: 26, d: 26, h: 26, o: 8, lift: 5, ridge: 1, colors: TILE })
  stairs(cv, 32, 64, 16, 3, 2.4, 2.6)
  // 石碑与松
  box(cv, { x: 58, y: 66, z: 0, w: 8, d: 3, h: 2, t: C.stone3, l: C.stone2, r: C.stone1 })
  box(cv, { x: 59, y: 66.6, z: 2, w: 6, d: 1.8, h: 14, t: C.stone3, l: C.stone3, r: C.stone1 })
  onL(cv, { x: 59, y: 66.6, z: 2, w: 6, d: 1.8, h: 14 }, 0.2, 0.8, 0.2, 0.85, 'none', `stroke="${C.line}" stroke-opacity=".35" stroke-width=".5" stroke-dasharray="1 1.2"`)
  pine(cv, -6, 60, 0.95)
  bush(cv, 70, 30, 0.7)
  void p
  return cv
}

// ── 炼器阁：青砖工坊 + 砖烟囱 + 炉膛火光 + 铁砧兵器架 ──
function lianqi() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 96, 70)
  plinth(cv, 0, 0, 96, 70, 5)
  const ch = box(cv, { x: 58, y: 10, z: 5, w: 14, d: 14, h: 72, t: C.stone2, l: dk(C.red1, 0.3), r: dk(C.red1, 0.45), tex: 'brick' })
  onL(cv, ch, 0, 1, 0.92, 1, C.stone2, THIN); onR(cv, ch, 0, 1, 0.92, 1, C.stone1, THIN)
  const [cx, cy] = iso(65, 17, 77)
  cv.open('a-pulse'); cv.ellipse(cx, cy, 16, 8, `fill="${cv.rad(C.fire2, 0.6)}"`); cv.close()
  cv.ellipse(cx, cy, 5, 2.6, `fill="${C.fire3}" fill-opacity=".8"`)
  smoke(cv, cx, cy - 2, 50, C.stone3, 0.55)
  const b = box(cv, { x: 8, y: 8, z: 5, w: 64, d: 48, h: 30, t: C.stone3, l: C.stone2, r: C.stone1, tex: 'brick' })
  onL(cv, b, 0, 1, 0.8, 1, C.wood1, STROKE); onR(cv, b, 0, 1, 0.8, 1, C.wood0, STROKE)
  cv.poly(quadL(b, 0, 1, 0.8, 1), cv.pat('plankL')); cv.poly(quadR(b, 0, 1, 0.8, 1), cv.pat('plankR'))
  for (const u of [0.02, 0.5, 0.98]) onL(cv, b, u - 0.02, u + 0.02, 0, 0.8, cv.grad([[0, C.wood0], [0.5, C.wood2], [1, C.wood0]], 'h'))
  archL(cv, b, 0.27, 0.3, 0.46, C.ink)
  const [gx, gy] = iso(8 + 64 * 0.27, 56, 10)
  cv.open('a-flicker')
  cv.ellipse(gx, gy, 24, 16, `fill="${cv.rad(C.fire2, 0.9)}"`)
  cv.path(`M${f(gx - 7)} ${f(gy + 5)}q2 -8 4 -3q1 -7 4 -2q2 -5 5 5z`, `fill="${C.fire3}"`, [[gx - 7, gy - 4]])
  cv.path(`M${f(gx - 4)} ${f(gy + 5)}q1 -4 2 -1q1 -4 3 0z`, `fill="#fff" fill-opacity=".8"`)
  cv.close()
  onL(cv, b, 0.62, 0.9, 0.34, 0.68, C.ink2); cv.poly(quadL(b, 0.63, 0.89, 0.36, 0.66), cv.pat('latticeL'))
  onR(cv, b, 0.3, 0.7, 0.3, 0.62, C.ink2); cv.poly(quadR(b, 0.31, 0.69, 0.32, 0.6), cv.pat('latticeR'))
  cv.poly(quadL(b, 0, 1, 0, 1), cv.grad([[0, '#000', 0.4], [0.3, '#000', 0]])); cv.poly(quadR(b, 0, 1, 0, 1), cv.grad([[0, '#000', 0.4], [0.3, '#000', 0]]))
  roof(cv, { x: 8, y: 8, z: 35, w: 64, d: 48, h: 16, o: 8, lift: 5, ridge: 0.6, colors: TILE })
  // 铁砧 + 锤
  box(cv, { x: 76, y: 52, z: 5, w: 8, d: 7, h: 7, t: C.wood2, l: C.wood1, r: C.wood0, tex: 'plank' })
  box(cv, { x: 73, y: 51, z: 12, w: 14, d: 9, h: 3.6, t: C.blue3, l: C.stone1, r: C.stone0 })
  const [hx, hy] = iso(82, 56, 16)
  cv.path(`M${f(hx)} ${f(hy)}l7 -9`, `stroke="${C.wood2}" stroke-width="1.6" stroke-linecap="round"`, [[hx + 8, hy - 10]])
  cv.path(`M${f(hx + 4)} ${f(hy - 11)}l6 3 -2 3 -6 -3z`, `fill="${C.stone1}" ${STROKE}`)
  cv.open('a-flicker', 0.6)
  for (let i = 0; i < 6; i++) { const a = -1.4 - i * 0.3; cv.path(`M${f(hx - 3)} ${f(hy - 3)}l${f(Math.cos(a) * (4 + i))} ${f(Math.sin(a) * (4 + i))}`, `stroke="${C.fire3}" stroke-width=".8" stroke-linecap="round"`) }
  cv.close()
  // 兵器架 + 水桶 + 矿石堆
  box(cv, { x: 88, y: 18, z: 5, w: 3, d: 26, h: 2, t: C.wood2, l: C.wood1, r: C.wood0 })
  for (let i = 0; i < 4; i++) {
    const [wx, wy] = iso(89.5, 22 + i * 6, 7)
    cv.line([[wx, wy], [wx, wy - 22]], `stroke="${C.line}" stroke-width="2"`)
    cv.line([[wx, wy], [wx, wy - 22]], `stroke="${i % 2 ? C.stone4 : C.blue3}" stroke-width="1"`)
    cv.path(`M${f(wx - 2)} ${f(wy - 6)}h4`, `stroke="${C.gold2}" stroke-width="1.2"`)
  }
  const [bx, by] = iso(14, 64, 5)
  cv.path(`M${f(bx - 5)} ${f(by - 9)}L${f(bx - 4.4)} ${f(by)}Q${f(bx)} ${f(by + 2)} ${f(bx + 4.4)} ${f(by)}L${f(bx + 5)} ${f(by - 9)}Z`, `fill="${cv.grad([[0, C.wood1], [0.5, C.wood3], [1, C.wood1]], 'h')}" ${STROKE}`, [[bx - 5, by - 10], [bx + 5, by + 2]])
  cv.ellipse(bx, by - 9, 5, 2, `fill="${C.blue2}" ${STROKE}`)
  cv.path(`M${f(bx - 4.6)} ${f(by - 3)}Q${f(bx)} ${f(by - 1)} ${f(bx + 4.6)} ${f(by - 3)}M${f(bx - 4.8)} ${f(by - 7)}Q${f(bx)} ${f(by - 5)} ${f(bx + 4.8)} ${f(by - 7)}`, `fill="none" stroke="${C.stone0}" stroke-width=".8"`)
  srand(9)
  for (let i = 0; i < 7; i++) { const [ox, oy] = iso(28 + rnd() * 10, 62 + rnd() * 6, 5); cv.path(`M${f(ox - 3)} ${f(oy)}l1 -3 3 -1 2 2 -1 2z`, `fill="${i % 3 ? C.stone1 : C.gold1}" ${THIN}`, [[ox - 3, oy - 4]]) }
  return cv
}

// ── 炼丹房：朱漆殿 + 前庭丹鼎 + 药篓 ──
function liandan() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 88, 88)
  plinth(cv, 0, 0, 88, 88, 5)
  hall(cv, { x: 6, y: 6, z: 5, w: 58, d: 40, h: 26, cols: 3, wall: C.red2, pillar: C.red0, doorCol: C.wood1, plaqueOn: true })
  roof(cv, { x: 6, y: 6, z: 31, w: 58, d: 40, h: 16, o: 8, lift: 5, ridge: 0.6, colors: TILE })
  const [dx, dy] = iso(56, 64, 5)
  censer(cv, dx, dy, 1)
  cv.open('a-pulse'); cv.ellipse(dx, dy - 26, 26, 18, `fill="${cv.rad(C.fire2, 0.5)}"`); cv.close()
  smoke(cv, dx - 3, dy - 26, 50, C.jade3, 0.7)
  smoke(cv, dx + 6, dy - 28, 34, C.paper2, 0.45)
  // 药篓、药柜、石灯
  const basket = (x, y, fill) => {
    const [bx, by] = iso(x, y, 5)
    cv.path(`M${f(bx - 5)} ${f(by - 6)}L${f(bx - 4)} ${f(by)}Q${f(bx)} ${f(by + 2)} ${f(bx + 4)} ${f(by)}L${f(bx + 5)} ${f(by - 6)}Z`, `fill="${C.gold1}" ${STROKE}`, [[bx - 5, by - 12], [bx + 5, by + 2]])
    for (let k = 0; k < 3; k++) cv.path(`M${f(bx - 4.6)} ${f(by - 4.6 + k * 1.8)}Q${f(bx)} ${f(by - 3 + k * 1.8)} ${f(bx + 4.6)} ${f(by - 4.6 + k * 1.8)}`, `fill="none" stroke="${C.gold0}" stroke-width=".6"`)
    cv.ellipse(bx, by - 6, 5, 1.8, `fill="${C.wood1}" ${THIN}`)
    for (let k = 0; k < 4; k++) cv.path(`M${f(bx - 3 + k * 2)} ${f(by - 6)}q${f(-1 + k * 0.6)} -4 ${f(0.5)} -6`, `fill="none" stroke="${fill}" stroke-width="1.4" stroke-linecap="round"`)
  }
  basket(14, 64, C.grass3); basket(22, 72, C.red3)
  box(cv, { x: 70, y: 8, z: 5, w: 12, d: 24, h: 18, t: C.wood2, l: C.wood1, r: C.wood0 })
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { onR(cv, { x: 70, y: 8, z: 5, w: 12, d: 24, h: 18 }, c / 4 + 0.03, (c + 1) / 4 - 0.03, r / 3 + 0.06, (r + 1) / 3 - 0.06, C.wood1, THIN); const q = quadR({ x: 70, y: 8, z: 5, w: 12, d: 24, h: 18 }, (c + 0.5) / 4, (c + 0.5) / 4, (r + 0.5) / 3, (r + 0.5) / 3); cv.circle(q[0][0], q[0][1], 0.5, `fill="${C.gold3}"`) }
  stoneLamp(cv, 8, 82, 5); stoneLamp(cv, 80, 44, 5)
  bush(cv, 84, 70, 0.8, [C.grass1, C.grass2, C.grass3, C.red3])
  return cv
}

// ── 坊市：两间铺面 + 条纹布篷 + 货物 + 幌子 + 灯笼串 ──
function fangshi() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 104, 76)
  plinth(cv, 0, 0, 104, 76, 4)
  const shop = (x, y, w, d, h, awning) => {
    const b = hall(cv, { x, y, z: 4, w, d, h, cols: 2, door: false, rightWin: true })
    onL(cv, b, 0.06, 0.94, 0.02, 0.56, C.ink2)
    cv.poly(quadL(b, 0.06, 0.94, 0.02, 0.56), cv.grad([[0, C.fire2, 0.35], [1, C.fire2, 0]]))
    // 柜台 + 货物
    const c = box(cv, { x: x + 3, y: y + d, z: 4, w: w - 6, d: 6, h: 8, t: C.wood3, l: C.wood2, r: C.wood1, tex: 'plank' })
    for (let i = 0; i < 4; i++) {
      const [gx, gy] = iso(x + 7 + i * (w - 12) / 3, y + d + 3, 12)
      if (i % 2 === 0) { cv.ellipse(gx, gy - 3, 2.6, 3.4, `fill="${cv.grad([[0, C.jade3], [1, C.jade1]], 'h')}" ${STROKE}`); cv.path(`M${f(gx - 1)} ${f(gy - 6.4)}h2v-1.4h-2z`, `fill="${C.wood2}" ${THIN}`, [[gx - 1, gy - 8]]) }
      else { cv.path(`M${f(gx - 3.4)} ${f(gy)}h6.8v-3.4h-6.8z`, `fill="${i === 1 ? C.blue2 : C.red2}" ${STROKE}`, [[gx - 3.4, gy - 3.4]]); cv.path(`M${f(gx - 3.4)} ${f(gy - 1.7)}h6.8`, `stroke="${C.gold3}" stroke-width=".5"`) }
    }
    void c
    // 条纹布篷（带垂边）
    const A = [x - 2, y + d, 4 + h * 0.74], B = [x + w + 2, y + d, 4 + h * 0.74], Cc = [x + w + 2, y + d + 13, 4 + h * 0.46], D = [x - 2, y + d + 13, 4 + h * 0.46]
    cv.poly(P([A, B, Cc, D]), awning, STROKE)
    const n = 8
    for (let i = 0; i < n; i += 2) cv.poly(P([[A[0] + (B[0] - A[0]) * i / n, A[1], A[2]], [A[0] + (B[0] - A[0]) * (i + 1) / n, A[1], A[2]], [D[0] + (Cc[0] - D[0]) * (i + 1) / n, D[1], D[2]], [D[0] + (Cc[0] - D[0]) * i / n, D[1], D[2]]]), C.paper2, 'fill-opacity=".75"')
    for (let i = 0; i < n; i++) {
      const a = iso(D[0] + (Cc[0] - D[0]) * i / n, D[1], D[2]), b2 = iso(D[0] + (Cc[0] - D[0]) * (i + 1) / n, D[1], D[2])
      cv.path(`M${f(a[0])} ${f(a[1])}Q${f((a[0] + b2[0]) / 2)} ${f((a[1] + b2[1]) / 2 + 3)} ${f(b2[0])} ${f(b2[1])}`, `fill="${i % 2 ? awning : C.paper2}" ${THIN}`, [a, b2])
    }
    roof(cv, { x, y, z: 4 + h, w, d, h: 12, o: 6, lift: 5, ridge: 0.5, colors: TILE })
  }
  shop(6, 4, 42, 30, 22, C.jade1)
  shop(56, 6, 40, 28, 20, C.red1)
  // 货箱、酒坛、布匹
  box(cv, { x: 46, y: 54, z: 4, w: 10, d: 10, h: 8, t: C.wood3, l: C.wood2, r: C.wood1, tex: 'plank' })
  box(cv, { x: 48, y: 56, z: 12, w: 7, d: 7, h: 5, t: C.gold3, l: C.gold2, r: C.gold1 })
  for (const [x, y] of [[62, 60], [68, 64]]) {
    const [jx, jy] = iso(x, y, 4)
    cv.path(`M${f(jx - 4)} ${f(jy - 8)}Q${f(jx - 6)} ${f(jy - 2)} ${f(jx - 3)} ${f(jy)}H${f(jx + 3)}Q${f(jx + 6)} ${f(jy - 2)} ${f(jx + 4)} ${f(jy - 8)}Z`, `fill="${cv.grad([[0, C.wood1], [0.4, C.wood3], [1, C.wood0]], 'h')}" ${STROKE}`, [[jx - 6, jy - 11], [jx + 6, jy]])
    cv.path(`M${f(jx - 3)} ${f(jy - 8)}h6v-2h-6z`, `fill="${C.red2}" ${THIN}`, [[jx - 3, jy - 10]])
    cv.path(`M${f(jx - 2)} ${f(jy - 5)}h4v3h-4z`, `fill="${C.paper2}" ${THIN}`)
  }
  // 幌子
  const [px, py] = iso(100, 50, 4), [qx, qy] = iso(100, 50, 50)
  cv.line([[px, py], [qx, qy]], `stroke="${C.line}" stroke-width="2.6"`)
  cv.line([[px, py], [qx, qy]], `stroke="${C.wood2}" stroke-width="1.3"`)
  cv.path(`M${f(qx)} ${f(qy + 2)}h-10`, `stroke="${C.wood2}" stroke-width="1.4"`)
  cv.path(`M${f(qx - 1)} ${f(qy + 3)}h-9v24l4.5 -3 4.5 3z`, `fill="${cv.grad([[0, C.paper2], [1, C.paper0]])}" ${STROKE}`, [[qx - 10, qy + 28]])
  cv.path(`M${f(qx - 5.5)} ${f(qy + 6)}v4M${f(qx - 7.5)} ${f(qy + 8)}h4M${f(qx - 5.5)} ${f(qy + 13)}v6M${f(qx - 8)} ${f(qy + 15)}h5M${f(qx - 7.6)} ${f(qy + 19)}l2 -2 2 2`, `fill="none" stroke="${C.red1}" stroke-width="1" stroke-linecap="round"`)
  cv.path(`M${f(qx - 1)} ${f(qy + 3)}h-9`, `stroke="${C.red1}" stroke-width="1.6"`)
  // 灯笼串
  const lp = [[16, 48], [30, 48], [66, 46], [82, 46]]
  const s0 = iso(8, 48, 30), s1 = iso(92, 46, 30)
  cv.path(`M${f(s0[0])} ${f(s0[1])}Q${f((s0[0] + s1[0]) / 2)} ${f((s0[1] + s1[1]) / 2 + 8)} ${f(s1[0])} ${f(s1[1])}`, `fill="none" stroke="${C.line}" stroke-opacity=".6" stroke-width=".6"`)
  for (const [x, y] of lp) lantern(cv, x, y, 26)
  return cv
}

// ── 聚灵阵：两层圆台 + 符文环 + 六根刻纹灵柱 + 灵晶 + 光柱灵旋 ──
function juling() {
  const cv = new Canvas()
  const cx = 45, cy = 45
  const disk = (r, z, h, top, side) => {
    const bot = isoEllipse(cx, cy, z, r, 72), topP = isoEllipse(cx, cy, z + h, r, 72)
    const n = bot.length, sidePts = []
    for (let i = 0; i <= n / 2; i++) sidePts.push(bot[(i + n - n / 8) % n])
    for (let i = n / 2; i >= 0; i--) sidePts.push(topP[(i + n - n / 8) % n])
    cv.poly(sidePts, cv.grad([[0, side], [0.5, lt(side, 0.15)], [1, dk(side, 0.3)]], 'h'), STROKE)
    // 侧面石缝
    for (let i = 0; i <= n / 2; i += 4) { const a = bot[(i + n - n / 8) % n], b = topP[(i + n - n / 8) % n]; cv.line([a, b], `stroke="#000" stroke-opacity=".2" stroke-width=".5"`) }
    cv.poly(topP, cv.grad([[0, lt(top, 0.1)], [1, dk(top, 0.06)]]), STROKE)
    // 顶面环形石板缝
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; cv.line([iso(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82, z + h), iso(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z + h)], `stroke="#000" stroke-opacity=".16" stroke-width=".5"`) }
    const ring = isoEllipse(cx, cy, z + h, r * 0.82, 72)
    cv.poly(ring, 'none', `stroke="#000" stroke-opacity=".18" stroke-width=".5"`)
  }
  cv.poly(isoEllipse(cx + 6, cy + 6, 0, 52), '#0b1219', 'fill-opacity=".24"')
  disk(48, 0, 6, C.stone3, C.stone1)
  disk(39, 6, 5, C.stone4, C.stone2)
  // 阵纹：三道环 + 八卦刻线 + 环上符文
  for (const [r, w, o] of [[33, 1.8, 0.95], [23, 1.2, 0.85], [12, 1, 0.8]]) cv.poly(isoEllipse(cx, cy, 11, r, 72), 'none', `stroke="${C.jade2}" stroke-opacity="${o}" stroke-width="${w}"`)
  cv.poly(isoEllipse(cx, cy, 11, 33, 72), 'none', `stroke="${C.jade4}" stroke-opacity=".5" stroke-width=".5"`)
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2
    cv.line([iso(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 11), iso(cx + Math.cos(a) * 23, cy + Math.sin(a) * 23, 11)], `stroke="${C.jade2}" stroke-opacity=".7" stroke-width=".9"`)
    for (let k = 0; k < 3; k++) {
      const aa = a + 0.12 + k * 0.1, p = iso(cx + Math.cos(aa) * 28, cy + Math.sin(aa) * 28, 11)
      cv.path(`M${f(p[0] - 1)} ${f(p[1] - 0.6)}h2M${f(p[0])} ${f(p[1] - 1.2)}v2`, `stroke="${C.jade3}" stroke-opacity=".9" stroke-width=".5"`)
    }
  }
  const [mx, my] = iso(cx, cy, 11)
  cv.open('a-pulse'); cv.ellipse(mx, my, 20, 10, `fill="${cv.rad(C.jade3, 0.7)}"`); cv.ellipse(mx, my - 20, 46, 40, `fill="${cv.rad(C.jade2, 0.45)}"`); cv.close()
  const posts = [0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2 + Math.PI / 6; return [cx + Math.cos(a) * 35, cy + Math.sin(a) * 35] }).sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]))
  const beam = () => {
    cv.open('a-pulse', 1.2)
    cv.path(`M${f(mx - 8)} ${f(my)}L${f(mx - 3)} ${f(my - 90)}L${f(mx + 3)} ${f(my - 90)}L${f(mx + 8)} ${f(my)}Z`, `fill="${cv.grad([[0, C.jade4, 0], [0.4, C.jade3, 0.55], [1, C.jade2, 0.15]])}"`, [[mx, my - 90]])
    cv.path(`M${f(mx - 1.5)} ${f(my)}L${f(mx - 0.6)} ${f(my - 86)}L${f(mx + 0.6)} ${f(my - 86)}L${f(mx + 1.5)} ${f(my)}Z`, `fill="#fff" fill-opacity=".6"`)
    cv.close()
    cv.open('a-flow')
    for (let i = 0; i < 4; i++) {
      const y = my - 22 - i * 16, rx = 28 - i * 5
      cv.path(`M${f(mx - rx)} ${f(y)}A${f(rx)} ${f(rx * 0.3)} 0 1 0 ${f(mx + rx * 0.7)} ${f(y - rx * 0.21)}`, `fill="none" stroke="${C.jade3}" stroke-opacity="${f(0.85 - i * 0.15)}" stroke-width="${f(2 - i * 0.3)}" stroke-linecap="round" stroke-dasharray="14 6"`, [[mx - rx, y - rx * 0.35], [mx + rx, y + rx * 0.35]])
      cv.path(`M${f(mx - rx * 0.9)} ${f(y + 1)}A${f(rx * 0.9)} ${f(rx * 0.27)} 0 0 0 ${f(mx + rx * 0.5)} ${f(y + rx * 0.24)}`, `fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".6"`)
    }
    cv.close()
    srand(4)
    for (let i = 0; i < 16; i++) { cv.open('a-rise', rnd() * 3.6); cv.circle(mx + (rnd() - 0.5) * 60, my - 10 - rnd() * 70, 0.6 + rnd() * 1.1, `fill="${C.jade4}" fill-opacity="${f(0.6 + rnd() * 0.4)}"`); cv.close() }
  }
  let beamDrawn = false
  for (const [px, py] of posts) {
    if (!beamDrawn && px + py > cx + cy) { beam(); beamDrawn = true }
    box(cv, { x: px - 4.5, y: py - 4.5, z: 11, w: 9, d: 9, h: 3, t: C.stone3, l: C.stone2, r: C.stone1, ao: false })
    const o = box(cv, { x: px - 3.2, y: py - 3.2, z: 14, w: 6.4, d: 6.4, h: 24, t: C.stone3, l: C.stone3, r: C.stone1, tex: 'stone' })
    for (const v of [0.25, 0.5, 0.75]) { const q = quadL(o, 0.5, 0.5, v, v)[0]; cv.path(`M${f(q[0] - 1.2)} ${f(q[1] - 1.8)}l1.2 1.8 1.2 -1.8M${f(q[0])} ${f(q[1] - 0.6)}v2`, `fill="none" stroke="${C.jade2}" stroke-width=".6"`) }
    box(cv, { x: px - 4, y: py - 4, z: 38, w: 8, d: 8, h: 2, t: C.stone3, l: C.stone2, r: C.stone1, ao: false })
    const [tx, ty] = iso(px, py, 40)
    cv.open('a-pulse', (px * 0.3) % 3); cv.circle(tx, ty - 9, 10, `fill="${cv.rad(C.jade2, 0.7)}"`); cv.close()
    cv.path(`M${f(tx)} ${f(ty - 18)}l4.6 7 -1 6 -3.6 2.4 -3.6 -2.4 -1 -6z`, `fill="${C.jade3}" ${STROKE}`, [[tx - 5, ty - 18], [tx + 5, ty - 2]])
    cv.path(`M${f(tx)} ${f(ty - 18)}l4.6 7 -1 6 -3.6 2.4z`, `fill="${C.jade2}"`)
    cv.path(`M${f(tx)} ${f(ty - 18)}v15.4M${f(tx - 4.6)} ${f(ty - 11)}l4.6 2 4.6 -2`, `fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".5"`)
  }
  return cv
}

// ── 灵田：四块田（灵草 / 灵花 / 灵稻 / 水田）+ 水渠 + 茅亭 + 篱笆 ──
function lingtian() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 108, 88, 4)
  box(cv, { x: 0, y: 0, z: 0, w: 108, d: 88, h: 5, t: C.grass2, l: C.wood1, r: C.wood0, texTop: 'flag' })
  // 十字水渠
  const water = cv.grad([[0, C.jade3], [1, C.blue2]])
  cv.poly(P([[52, 2, 5.1], [56, 2, 5.1], [56, 86, 5.1], [52, 86, 5.1]]), water, THIN)
  cv.poly(P([[2, 42, 5.1], [106, 42, 5.1], [106, 46, 5.1], [2, 46, 5.1]]), water, THIN)
  for (let i = 0; i < 6; i++) { const p = iso(54, 8 + i * 14, 5.2); cv.path(`M${f(p[0] - 1.5)} ${f(p[1])}h3`, `stroke="#fff" stroke-opacity=".6" stroke-width=".5"`) }
  const plots = [[4, 4, 'herb'], [58, 4, 'flower'], [4, 48, 'rice'], [58, 48, 'pond']]
  srand(5)
  plots.forEach(([x, y, kind]) => {
    const b = box(cv, { x, y, z: 5, w: 46, d: 36, h: 2.6, t: kind === 'pond' ? C.blue1 : '#5d4731', l: C.wood1, r: C.wood0, ao: false })
    if (kind === 'pond') {
      cv.poly(P([[x + 2, y + 2, 7.7], [x + 44, y + 2, 7.7], [x + 44, y + 34, 7.7], [x + 2, y + 34, 7.7]]), cv.grad([[0, C.jade2], [1, C.blue1]]), THIN)
      for (const [lx, ly] of [[14, 12], [30, 22], [20, 28], [36, 10]]) {
        const [px, py] = iso(x + lx, y + ly, 7.8)
        cv.ellipse(px, py, 4.4, 2.2, `fill="${C.grass2}" ${THIN}`)
        cv.path(`M${f(px)} ${f(py)}l4 -1.4`, `stroke="${C.grass0}" stroke-width=".4"`)
      }
      const [lx, ly] = iso(x + 22, y + 16, 7.8)
      cv.path(`M${f(lx)} ${f(ly)}q-4 -2 -3 -6q2 1 3 3q1 -4 3 -5q1 4 -3 8z`, `fill="${C.red3}" ${THIN}`, [[lx - 4, ly - 7]])
      cv.path(`M${f(lx)} ${f(ly - 1)}q-1 -4 0 -6q1 2 0 6z`, `fill="#fff" fill-opacity=".8"`)
      return
    }
    for (let r = 0; r < 4; r++) {
      const yy = y + 5 + r * 8.4
      cv.line([iso(x + 3, yy + 1.4, 7.6), iso(x + 43, yy + 1.4, 7.6)], `stroke="#3e2d1f" stroke-width="2.4" stroke-linecap="round"`)
      cv.line([iso(x + 3, yy + 0.6, 7.6), iso(x + 43, yy + 0.6, 7.6)], `stroke="#7a5a3c" stroke-width="1" stroke-linecap="round"`)
      for (let s = 0; s < 6; s++) {
        const [sx, sy] = iso(x + 6 + s * 6.8, yy, 7.6)
        if (kind === 'herb') {
          const glowy = (r + s) % 3 === 0
          cv.path(`M${f(sx)} ${f(sy)}q-5 -3 -5 -8q4 1 5 6q1 -6 5 -7q0 5 -5 9z`, `fill="${glowy ? C.jade3 : C.grass3}" stroke="${C.grass0}" stroke-width=".5"`, [[sx - 5, sy - 9]])
          cv.path(`M${f(sx)} ${f(sy)}v-7`, `stroke="${C.grass0}" stroke-width=".4"`)
          if (glowy) { cv.open('a-pulse', (s * 0.7 + r * 1.1) % 3); cv.circle(sx, sy - 9, 3, `fill="${cv.rad(C.jade3, 0.7)}"`); cv.circle(sx, sy - 9, 1.1, `fill="${C.jade4}"`); cv.close() }
        } else if (kind === 'flower') {
          cv.path(`M${f(sx)} ${f(sy)}q-1 -4 0 -8`, `fill="none" stroke="${C.grass1}" stroke-width=".7"`, [[sx, sy - 8]])
          cv.path(`M${f(sx)} ${f(sy - 3)}q-3 0 -3 -2q2 -1 3 2z`, `fill="${C.grass3}"`)
          const pc = [C.red3, C.purple3, C.gold3][(r + s) % 3]
          for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; cv.circle(sx + Math.cos(a) * 1.5, sy - 9 + Math.sin(a) * 1.1, 1.1, `fill="${pc}" stroke="${dk(pc, 0.4)}" stroke-width=".25"`) }
          cv.circle(sx, sy - 9, 0.7, `fill="${C.gold3}"`)
        } else {
          for (let k = -1; k <= 1; k++) cv.path(`M${f(sx)} ${f(sy)}q${f(k * 1.5)} -5 ${f(k * 3.4)} -9`, `fill="none" stroke="${C.grass3}" stroke-width=".8" stroke-linecap="round"`, [[sx + k * 3.4, sy - 9]])
          cv.path(`M${f(sx + 1)} ${f(sy - 8)}q2 1 3 4`, `fill="none" stroke="${C.gold2}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray=".8 .5"`)
        }
      }
    }
    void b
  })
  // 茅亭
  const t = { x: 88, y: 64, z: 7.6, w: 14, d: 14 }
  for (const [px, py] of [[88, 64], [102, 64], [88, 78], [102, 78]]) box(cv, { x: px - 1, y: py - 1, z: 7.6, w: 2.2, d: 2.2, h: 15, t: C.wood2, l: C.wood2, r: C.wood1, ao: false })
  roof(cv, { ...t, z: 22.6, h: 15, o: 6, lift: 2.6, ridge: 1, colors: THATCH })
  // 竹篱：竖竿 + 两道横篾
  const fence = (a, b2, n) => {
    for (const hz of [2.4, 6]) cv.line([iso(a[0], a[1], hz), iso(b2[0], b2[1], hz)], `stroke="${C.wood2}" stroke-width=".9"`)
    for (let i = 0; i <= n; i++) {
      const x = a[0] + (b2[0] - a[0]) * i / n, y = a[1] + (b2[1] - a[1]) * i / n
      const [p0, p1] = [iso(x, y, 0), iso(x, y, 8.6)]
      cv.line([p0, p1], `stroke="${C.line}" stroke-opacity=".8" stroke-width="2.2" stroke-linecap="round"`)
      cv.line([p0, p1], `stroke="${i % 2 ? C.gold2 : C.wood3}" stroke-width="1.1" stroke-linecap="round"`)
    }
  }
  fence([-2, 4], [-2, 90], 12)
  fence([4, 90], [50, 90], 7)
  return cv
}

// ── 矿脉：嶙峋山体 + 木构矿洞 + 轨道矿车 + 灵晶簇 ──
function kuangmai() {
  const cv = new Canvas()
  cv.ellipse(10, 62, 88, 16, `fill="#0b1219" fill-opacity=".24"`)
  const [bx0, by0] = iso(50, 40, 0)
  crag(cv, bx0 + 4, by0 + 14, 156, [[-30, -88], [10, -66], [46, -48]], 'kmRock', { seed: 7 })
  pine(cv, 24, 34, 0.7)
  const crystal = (cx, cy, s, col = [C.gold3, C.gold2, C.gold1]) => {
    cv.open('a-pulse', (cx * 0.07) % 3); cv.circle(cx, cy - 9 * s, 16 * s, `fill="${cv.rad(col[0], 0.6)}"`); cv.close()
    for (const [dx, h, w, k, tilt] of [[-7, 13, 3.6, 2, -3], [-2, 22, 4.6, 0, -1], [4, 17, 4, 1, 2], [9, 10, 3, 2, 4]]) {
      const x0 = cx + (dx - w) * s, x1 = cx + (dx + w) * s, tx = cx + (dx + tilt) * s, ty = cy - h * s
      cv.path(`M${f(x0)} ${f(cy)}L${f(x0 + tilt * 0.6 * s)} ${f(cy - h * 0.72 * s)}L${f(tx)} ${f(ty)}L${f(x1 + tilt * 0.6 * s)} ${f(cy - h * 0.72 * s)}L${f(x1)} ${f(cy)}Z`, `fill="${col[k]}" ${STROKE}`, [[x0, ty], [x1, cy]])
      cv.path(`M${f(tx)} ${f(ty)}L${f(cx + (dx + tilt * 0.6) * s)} ${f(cy - h * 0.72 * s)}L${f(cx + dx * s)} ${f(cy)}L${f(x1)} ${f(cy)}L${f(x1 + tilt * 0.6 * s)} ${f(cy - h * 0.72 * s)}Z`, `fill="#000" fill-opacity=".18"`)
      cv.path(`M${f(tx)} ${f(ty)}L${f(x0 + tilt * 0.6 * s + 1)} ${f(cy - h * 0.72 * s)}`, `stroke="#fff" stroke-opacity=".75" stroke-width=".6"`)
    }
    cv.path(`M${f(cx - 11 * s)} ${f(cy + 0.5)}Q${f(cx)} ${f(cy - 2 * s)} ${f(cx + 13 * s)} ${f(cy + 0.5)}`, `fill="none" stroke="${C.stone1}" stroke-width="${f(2 * s)}" stroke-linecap="round"`)
  }
  crystal(22, 4, 1)
  crystal(-18, -14, 0.8, [C.jade3, C.jade2, C.jade1])
  // 矿洞：石门框 + 木梁 + 灯
  const [ex, ey] = iso(34, 80, 0)
  cv.path(`M${f(ex - 17)} ${f(ey + 2)}L${f(ex - 15)} ${f(ey - 26)}Q${f(ex)} ${f(ey - 36)} ${f(ex + 15)} ${f(ey - 26)}L${f(ex + 17)} ${f(ey + 2)}Z`, `fill="${C.stone2}" ${STROKE}`, [[ex - 17, ey - 36]])
  cv.path(`M${f(ex - 13)} ${f(ey + 2)}L${f(ex - 12)} ${f(ey - 22)}Q${f(ex)} ${f(ey - 30)} ${f(ex + 12)} ${f(ey - 22)}L${f(ex + 13)} ${f(ey + 2)}Z`, `fill="${cv.grad([[0, '#05080b'], [1, C.ink2]])}" ${STROKE}`)
  cv.open('a-flicker'); cv.ellipse(ex, ey - 6, 11, 9, `fill="${cv.rad(C.gold3, 0.7)}"`); cv.close()
  for (const [x0, x1] of [[-14, -14], [14, 14]]) { cv.line([[ex + x0, ey + 3], [ex + x1, ey - 24]], `stroke="${C.line}" stroke-width="4.6" stroke-linecap="round"`); cv.line([[ex + x0, ey + 3], [ex + x1, ey - 24]], `stroke="${cv.grad([[0, C.wood1], [0.5, C.wood3], [1, C.wood1]], 'h')}" stroke-width="2.8" stroke-linecap="round"`) }
  cv.line([[ex - 18, ey - 25], [ex + 18, ey - 25]], `stroke="${C.line}" stroke-width="5" stroke-linecap="round"`)
  cv.line([[ex - 18, ey - 25], [ex + 18, ey - 25]], `stroke="${C.wood2}" stroke-width="3" stroke-linecap="round"`)
  for (let i = 0; i < 4; i++) cv.circle(ex - 12 + i * 8, ey - 25, 0.7, `fill="${C.line}"`)
  lantern(cv, ...unIso(ex + 17, ey - 22), 0)
  // 轨道 + 矿车
  for (let i = 0; i < 6; i++) { const a = iso(26 + i * 0.1, 82 + i * 4, 0), b2 = iso(40 + i * 0.1, 82 + i * 4, 0); cv.line([a, b2], `stroke="${C.wood1}" stroke-width="1.6"`) }
  for (const dx of [28, 38]) cv.line([iso(dx, 80, 0.4), iso(dx, 104, 0.4)], `stroke="${C.stone1}" stroke-width="1"`)
  const cart = box(cv, { x: 26, y: 90, z: 1.6, w: 14, d: 10, h: 7, t: C.wood3, l: C.wood2, r: C.wood1, tex: 'plank' })
  for (const [u, face] of [[0.2, 'L'], [0.8, 'L']]) { const q = quadL(cart, u, u, 0, 0)[0]; cv.circle(q[0], q[1], 2, `fill="${C.stone1}" ${STROKE}`); void face }
  srand(12)
  for (let i = 0; i < 8; i++) { const [ox, oy] = iso(28 + rnd() * 10, 91 + rnd() * 7, 8.6); cv.path(`M${f(ox - 2.4)} ${f(oy)}l.8 -2.6 2.4 -.8 1.6 1.6 -.8 1.8z`, `fill="${i % 2 ? C.gold2 : C.jade2}" ${THIN}`, [[ox - 3, oy - 4]]) }
  // 鹤嘴锄
  const [kx, ky] = iso(46, 86, 0)
  cv.path(`M${f(kx)} ${f(ky)}l8 -16`, `stroke="${C.wood2}" stroke-width="1.6" stroke-linecap="round"`, [[kx + 8, ky - 16]])
  cv.path(`M${f(kx + 3)} ${f(ky - 17)}q5 0 9 3`, `fill="none" stroke="${C.stone1}" stroke-width="2" stroke-linecap="round"`, [[kx + 12, ky - 17]])
  crystal(8, 50, 1.5)
  crystal(60, 54, 1.1, [C.jade3, C.jade2, C.jade1])
  return cv
}

// ── 演武场：石台 + 方砖 + 阵圆 + 兵器架 + 木人桩 + 战鼓 + 旗 ──
function yanwu() {
  const cv = new Canvas()
  shadow(cv, 0, 0, 112, 92)
  const b = plinth(cv, 0, 0, 112, 92, 8, 0, C.stone3)
  const pts = isoEllipse(56, 46, 8, 26, 72)
  cv.poly(pts, cv.rad(C.red2, 0.3), `stroke="${C.red2}" stroke-width="1.6"`)
  cv.poly(isoEllipse(56, 46, 8, 20, 72), 'none', `stroke="${C.red2}" stroke-opacity=".6" stroke-width=".7"`)
  cv.poly(isoEllipse(56, 46, 8, 8, 48), 'none', `stroke="${C.red2}" stroke-opacity=".8" stroke-width=".9"`)
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cv.line([iso(56 + Math.cos(a) * 20, 46 + Math.sin(a) * 20, 8), iso(56 + Math.cos(a) * 26, 46 + Math.sin(a) * 26, 8)], `stroke="${C.red2}" stroke-opacity=".7" stroke-width=".7"`) }
  // 兵器架
  const rack = box(cv, { x: 8, y: 4, z: 8, w: 44, d: 5, h: 3, t: C.wood2, l: C.wood1, r: C.wood0 })
  void rack
  const weapons = ['spear', 'halberd', 'sword', 'spear', 'glaive', 'sword']
  weapons.forEach((kind, i) => {
    const [wx, wy] = iso(12 + i * 7.4, 6, 11)
    cv.line([[wx, wy], [wx, wy - 32]], `stroke="${C.line}" stroke-width="2.4" stroke-linecap="round"`)
    cv.line([[wx, wy], [wx, wy - 32]], `stroke="${kind === 'sword' ? C.stone4 : C.wood3}" stroke-width="1.1"`)
    if (kind === 'spear') { cv.path(`M${f(wx - 2)} ${f(wy - 31)}L${f(wx)} ${f(wy - 39)}L${f(wx + 2)} ${f(wy - 31)}Z`, `fill="${C.stone4}" ${STROKE}`, [[wx, wy - 39]]); cv.path(`M${f(wx - 1.6)} ${f(wy - 30)}q1.6 3 3.2 0`, `fill="${C.red2}"`) }
    if (kind === 'halberd') cv.path(`M${f(wx)} ${f(wy - 38)}v8M${f(wx)} ${f(wy - 33)}q5 -2 5 3q-2 -1 -5 1`, `fill="${C.stone4}" ${STROKE}`, [[wx + 5, wy - 38]])
    if (kind === 'glaive') cv.path(`M${f(wx)} ${f(wy - 30)}q5 -6 1 -12q-3 6 -1 12z`, `fill="${C.stone4}" ${STROKE}`, [[wx + 5, wy - 42]])
    if (kind === 'sword') cv.path(`M${f(wx - 2.4)} ${f(wy - 8)}h4.8`, `stroke="${C.gold2}" stroke-width="1.4"`)
  })
  box(cv, { x: 8, y: 4, z: 32, w: 44, d: 3, h: 2.4, t: C.wood2, l: C.wood1, r: C.wood0, ao: false })
  // 木人桩
  for (const [x, y] of [[82, 26], [92, 58]]) {
    box(cv, { x: x - 4, y: y - 4, z: 8, w: 8, d: 8, h: 2, t: C.stone3, l: C.stone2, r: C.stone1, ao: false })
    box(cv, { x: x - 2.6, y: y - 2.6, z: 10, w: 5.2, d: 5.2, h: 28, t: C.wood3, l: C.wood2, r: C.wood1, tex: 'plank' })
    for (const [hz, len] of [[30, 10], [24, 8], [16, 6]]) {
      const [ax, ay] = iso(x, y + 2.6, hz)
      cv.line([[ax - 1, ay], [ax - len, ay + 2]], `stroke="${C.line}" stroke-width="3" stroke-linecap="round"`)
      cv.line([[ax - 1, ay], [ax - len, ay + 2]], `stroke="${C.wood3}" stroke-width="1.6" stroke-linecap="round"`)
    }
  }
  // 战鼓
  const [gx, gy] = iso(20, 72, 8)
  for (const dx of [-8, 8]) cv.line([[gx + dx, gy], [gx + dx * 0.6, gy - 16]], `stroke="${C.wood1}" stroke-width="1.6"`)
  cv.ellipse(gx, gy - 14, 9, 9.6, `fill="${cv.grad([[0, C.red1], [0.5, C.red2], [1, C.red0]], 'h')}" ${STROKE}`)
  cv.ellipse(gx - 2, gy - 14, 6, 8, `fill="${C.paper1}" ${STROKE}`)
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; cv.circle(gx - 2 + Math.cos(a) * 6.8, gy - 14 + Math.sin(a) * 8.8, 0.6, `fill="${C.gold3}"`) }
  cv.circle(gx - 2, gy - 14, 2.4, `fill="none" stroke="${C.red1}" stroke-width=".7"`)
  railing(cv, b, { gaps: [[0.4, 0.6]], step: 8 })
  stairs(cv, 56, 92, 20, 3, 2.6, 2.4)
  banner(cv, 4, 88, 8, 48)
  banner(cv, 108, 4, 8, 48, C.jade1)
  return cv
}

// ── 洞府三档 ──
function moonGate(cv, x, y, r) {
  cv.circle(x, y, r + 5, `fill="${cv.grad([[0, C.stone4], [1, C.stone2]])}" ${STROKE}`)
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; cv.line([[x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5)]], `stroke="#000" stroke-opacity=".2" stroke-width=".5"`) }
  cv.circle(x, y, r, `fill="${cv.grad([[0, '#05080b'], [1, C.ink2]])}" ${STROKE}`)
  cv.open('a-pulse'); cv.circle(x, y + 2, r * 0.85, `fill="${cv.rad(C.jade2, 0.85)}"`); cv.close()
  // 洞内石阶 + 灵光
  for (let i = 0; i < 3; i++) cv.path(`M${f(x - r * 0.5 + i * 2)} ${f(y + r * 0.3 - i * 3)}h${f(r - i * 4)}`, `stroke="${C.jade3}" stroke-opacity="${f(0.6 - i * 0.15)}" stroke-width="1"`)
  cv.path(`M${f(x - r - 5)} ${f(y + r * 0.5)}h${f(r * 2 + 10)}v${f(r * 0.6)}h${f(-(r * 2 + 10))}z`, `fill="${cv.grad([[0, C.stone3], [1, C.stone1]])}" ${STROKE}`)
  // 门两侧楹联
  for (const s of [-1, 1]) {
    cv.path(`M${f(x + s * (r + 8) - 2.4)} ${f(y - r)}h4.8v${f(r * 1.4)}h-4.8z`, `fill="${C.red1}" ${STROKE}`, [[x + s * (r + 8) - 3, y - r]])
    for (let k = 0; k < 4; k++) cv.path(`M${f(x + s * (r + 8) - 1)} ${f(y - r + 3 + k * 4.6)}h2`, `stroke="${C.gold3}" stroke-width=".8"`)
  }
}
function dongfu(tier) {
  const cv = new Canvas()
  const s = tier === 1 ? 1 : 1.1
  cv.ellipse(6, 30 * s + 4, 90 * s, 17 * s, `fill="#0b1219" fill-opacity=".24"`)
  crag(cv, 0, 30 * s, 156 * s, tier === 3 ? [[-36 * s, -104 * s], [8 * s, -128 * s], [46 * s, -84 * s]] : [[-30 * s, -96 * s], [14 * s, -116 * s], [48 * s, -70 * s]], 'dfRock', { seed: tier + 20 })
  if (tier === 3) {
    const ax = 30 * s, ay = -40 * s, bx = 38 * s, by = 26 * s
    cv.path(`M${f(ax - 4)} ${f(ay)}Q${f(ax + 6)} ${f(ay - 2)} ${f(ax + 5)} ${f(ay + 4)}L${f(bx + 8)} ${f(by)}L${f(bx - 8)} ${f(by)}Z`, `fill="${cv.grad([[0, C.jade4, 0.95], [1, C.blue3, 0.6]])}" ${STROKE}`)
    cv.open('a-flow')
    for (const d of [-3, -1, 1.5, 3.5]) cv.line([[ax + d * 0.8, ay + 6], [bx + d * 2, by - 4]], `stroke="#fff" stroke-opacity="${d > 0 ? 0.75 : 0.5}" stroke-width=".8" stroke-dasharray="7 3"`)
    cv.close()
    cv.ellipse(bx, by + 1, 18, 5.5, `fill="${C.jade4}" fill-opacity=".8" ${STROKE}`)
    for (const [dx, r] of [[-8, 3], [0, 4], [8, 3]]) cv.circle(bx + dx, by - 2, r, `fill="#fff" fill-opacity=".55"`)
    const [tx, ty] = unIso(-30 * s, -44 * s)
    cv.open('a-pulse', 1); cv.circle(-30 * s, -62 * s, 38, `fill="${cv.rad(C.jade2, 0.6)}"`); cv.close()
    const deck = box(cv, { x: tx - 13, y: ty - 13, z: 0, w: 26, d: 26, h: 3, t: C.stone4, l: C.stone2, r: C.stone1, texTop: 'flag' })
    hall(cv, { x: tx - 9, y: ty - 9, z: 3, w: 18, d: 18, h: 13, cols: 2, door: true })
    railing(cv, deck, { step: 5, col: C.red1, gaps: [[0.35, 0.65]] })
    roof(cv, { x: tx - 9, y: ty - 9, z: 16, w: 18, d: 18, h: 16, o: 6, lift: 4, ridge: 1, colors: GOLD_TILE, gold: true })
  }
  const gx = -8 * s, gy = 4 * s
  moonGate(cv, gx, gy, 15 * s)
  // 门额
  cv.path(`M${f(gx - 13)} ${f(gy - 30 * s)}h26v9h-26z`, `fill="${C.gold1}" ${STROKE}`, [[gx - 13, gy - 30 * s]])
  cv.path(`M${f(gx - 11.5)} ${f(gy - 28.6 * s)}h23v6.2h-23z`, `fill="${cv.grad([[0, C.blue1], [1, C.blue0]])}"`, [[gx - 11, gy - 28 * s]])
  for (const dx of [-5, 0, 5]) cv.path(`M${f(gx + dx - 1.4)} ${f(gy - 26.6 * s)}h2.8M${f(gx + dx)} ${f(gy - 27.6 * s)}v3.6`, `stroke="${C.gold3}" stroke-width=".6"`)
  const [sx0, sy0] = unIso(gx, 24 * s)
  for (let i = 0; i < 4; i++) box(cv, { x: sx0 - 13 + i * 2.6, y: sy0 - 4 + i * 2.6, z: 0, w: 24 - i * 2, d: 10 - i * 2.4, h: 8 - i * 2, t: C.stone4, l: C.stone3, r: C.stone2, ao: false })
  const [lx0, ly0] = unIso(gx - 24 * s, 28 * s), [lx1, ly1] = unIso(gx + 22 * s, 28 * s)
  stoneLamp(cv, lx0, ly0); stoneLamp(cv, lx1, ly1)
  const [px0, py0] = unIso(-70 * s, 30 * s)
  pine(cv, px0, py0, 1)
  if (tier >= 2) {
    const [px, py] = unIso(54 * s, 30 * s)
    const deck = box(cv, { x: px - 12, y: py - 12, z: 0, w: 24, d: 24, h: 3.4, t: C.stone4, l: C.stone2, r: C.stone1, tex: 'stone', texTop: 'flag' })
    for (const [x, y] of [[px - 8, py - 8], [px + 8, py - 8], [px - 8, py + 8], [px + 8, py + 8]]) box(cv, { x: x - 1.3, y: y - 1.3, z: 3.4, w: 2.6, d: 2.6, h: 19, t: C.red1, l: C.red2, r: C.red0, ao: false })
    // 挂落 + 美人靠
    const q = { x: px - 8, y: py - 8, z: 3.4, w: 16, d: 16, h: 19 }
    onL(cv, q, 0.08, 0.92, 0.86, 0.94, C.red1, THIN); onR(cv, q, 0.08, 0.92, 0.86, 0.94, C.red0, THIN)
    cv.poly(quadL(q, 0.08, 0.92, 0.86, 0.94), cv.pat('latticeL'))
    railing(cv, deck, { step: 4, col: C.red1, gaps: [[0.3, 0.7]] })
    roof(cv, { x: px - 8, y: py - 8, z: 22.4, w: 16, d: 16, h: 15, o: 6, lift: 4, ridge: 1, colors: tier === 3 ? GOLD_TILE : TILE, gold: tier === 3 })
    const [bx, by] = unIso(-44 * s, 40 * s)
    bush(cv, bx, by, 0.85, [C.grass1, C.grass2, C.grass3, C.red3])
  }
  if (tier === 3) { const [lx, ly] = unIso(22 * s, 32 * s); lantern(cv, lx, ly, 18) }
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
