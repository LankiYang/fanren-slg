// 兵种 / 妖兽（精细版）。约定：我方兵种朝右，妖兽朝左（战斗场景里面对面）。
// 细墨线 + 渐变体积 + 鳞/毛/纹理 + 轮廓光；蛇蛟类用「分层描边管」，鳞片用图案描边。
import { C, Canvas, save, dk, lt } from './lib.mjs'

const L = `stroke="${C.line}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"`
const T = `stroke="${C.line}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round"`
const V = (cv, c, k = 0.25) => cv.grad([[0, lt(c, k)], [0.55, c], [1, dk(c, k + 0.1)]])
const H = (cv, c, k = 0.25) => cv.grad([[0, dk(c, k)], [0.45, lt(c, k * 0.6)], [1, dk(c, k + 0.1)]], 'h')

let pid = 0
/** 鳞片图案（2D）：半圆鳞错位排列 */
function scales(cv, col, size = 6) {
  const id = 'sc' + (pid++)
  const h = size * 0.66
  cv.def(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${size}" height="${h * 2}"><rect width="${size}" height="${h * 2}" fill="${col}"/><path d="M0 ${h}a${size / 2} ${size / 2} 0 0 1 ${size} 0M${-size / 2} ${h * 2}a${size / 2} ${size / 2} 0 0 1 ${size} 0M${size / 2} ${h * 2}a${size / 2} ${size / 2} 0 0 1 ${size} 0" fill="none" stroke="${dk(col, 0.45)}" stroke-width=".6"/><path d="M${size * 0.25} ${h * 0.75}q${size * 0.25} -${h * 0.3} ${size * 0.5} 0" fill="none" stroke="${lt(col, 0.45)}" stroke-width=".4"/></pattern>`)
  return `url(#${id})`
}
function tube(cv, d, w, main, bbox) {
  cv.path(d, `fill="none" stroke="${C.line}" stroke-width="${w + 2.6}" stroke-linecap="round" stroke-linejoin="round"`, bbox)
  cv.path(d, `fill="none" stroke="${dk(main, 0.25)}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`)
  cv.path(d, `fill="none" stroke="${scales(cv, main)}" stroke-width="${w * 0.82}" stroke-linecap="round" stroke-linejoin="round"`)
  cv.add(`<path d="${d}" fill="none" stroke="${lt(main, 0.55)}" stroke-opacity=".5" stroke-width="${w * 0.14}" stroke-linecap="round" transform="translate(0 ${-w * 0.26})"/>`)
}
function eye(cv, x, y, r = 3.2, col = C.fire3) {
  cv.open('a-pulse', (x * 0.13) % 3); cv.circle(x, y, r * 2.2, `fill="${cv.rad(col, 0.55)}"`); cv.close()
  cv.ellipse(x, y, r * 1.15, r, `fill="${cv.grad([[0, lt(col, 0.5)], [1, dk(col, 0.2)]])}" ${T}`)
  cv.ellipse(x, y, r * 0.3, r * 0.85, `fill="${C.line}"`)
  cv.circle(x - r * 0.35, y - r * 0.35, r * 0.25, 'fill="#fff"')
}
function shadow(cv, x, y, rx) { cv.ellipse(x, y, rx, rx * 0.15, 'fill="#000" fill-opacity=".3"') }
function out(name, cv, mirror = false) { save(name, cv.toString(4, null, mirror)) }
/** 毛簇：沿一串点画尖端向外的短毛 */
function tufts(cv, pts, col, len = 4, w = 0.8) {
  for (const [x, y, a] of pts) cv.path(`M${x} ${y}q${Math.cos(a) * len * 0.5 + 1} ${Math.sin(a) * len * 0.5} ${Math.cos(a) * len} ${Math.sin(a) * len}`, `fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"`)
}
function claws(cv, x, y, dir = -1, n = 3, col = '#f4efe0') {
  for (let i = 0; i < n; i++) cv.path(`M${x + dir * 1 + i * 3 - 3} ${y}q${dir * 2} 1 ${dir * 3} 3`, `fill="none" stroke="${C.line}" stroke-width="2" stroke-linecap="round"`, [[x - 5, y], [x + 5, y + 4]])
  for (let i = 0; i < n; i++) cv.path(`M${x + dir * 1 + i * 3 - 3} ${y}q${dir * 2} 1 ${dir * 3} 3`, `fill="none" stroke="${col}" stroke-width="1" stroke-linecap="round"`)
}

// ── 腿：大腿粗、踝细、落地一只爪 ──
function leg(cv, x, y, h, w, fill, bend = 0) {
  const ax = x + bend
  cv.path(`M${x - w} ${y}C${x - w * 1.25} ${y + h * 0.3} ${ax - w * 0.2} ${y + h * 0.42} ${ax - w * 0.5} ${y + h * 0.62}L${ax - w * 0.45} ${y + h - 6}L${ax + w * 0.45} ${y + h - 6}C${ax + w * 0.5} ${y + h * 0.72} ${x + w * 1.05} ${y + h * 0.62} ${x + w * 0.95} ${y + h * 0.42}C${x + w * 1.25} ${y + h * 0.25} ${x + w * 1.1} ${y + h * 0.08} ${x + w} ${y}Z`, `fill="${H(cv, fill, 0.2)}" ${L}`, [[x - w * 1.25, y], [x + w * 1.25, y + h]])
  cv.path(`M${ax - w * 0.9} ${y + h}C${ax - w * 0.9} ${y + h - 8} ${ax + w * 0.9} ${y + h - 8} ${ax + w * 0.9} ${y + h}Z`, `fill="${V(cv, fill, 0.15)}" ${L}`, [[ax - w, y + h]])
  cv.path(`M${x - w * 0.5} ${y + h * 0.2}q${w * 0.3} ${h * 0.25} ${w * 0.1} ${h * 0.45}`, `fill="none" stroke="${dk(fill, 0.4)}" stroke-opacity=".6" stroke-width=".7"`)
  claws(cv, ax - w * 0.3, y + h - 1, -1, 3)
}

// ── 四足兽（朝左）：狼 / 狻猊 / 星兽共用骨架 ──
function quadruped(cv, o) {
  const { body, belly, dark } = o
  shadow(cv, 84, 146, 66)
  leg(cv, 50, 104, 40, 9, dark, 2); leg(cv, 118, 104, 40, 10, dark, 2)
  if (o.tail === 'bush') {
    cv.path('M140 84C160 76 170 50 160 30C170 52 150 60 146 50C156 70 146 80 136 80Z', `fill="${V(cv, body)}" ${L}`)
    tufts(cv, [[160, 34, -1.2], [164, 44, -0.6], [158, 56, 0], [150, 66, 0.4]], lt(body, 0.4), 5)
  }
  if (o.tail === 'flame') {
    cv.path('M138 82C156 80 170 60 164 38C172 56 160 64 158 56C164 72 150 84 136 88Z', `fill="${V(cv, o.accent)}" ${L}`)
    cv.path('M146 80C156 74 162 64 162 52', `fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".8"`)
  }
  if (o.tail === 'whip') {
    cv.path('M138 84C156 88 168 76 170 60', `fill="none" stroke="${C.line}" stroke-width="7" stroke-linecap="round"`)
    cv.path('M138 84C156 88 168 76 170 60', `fill="none" stroke="${body}" stroke-width="4.6" stroke-linecap="round"`)
    cv.path('M170 62c-6 -4 -8 -12 -2 -16c0 4 4 6 6 4c2 4 0 10 -4 12z', `fill="${V(cv, o.accent)}" ${L}`, [[164, 44], [176, 64]])
  }
  // 身体
  const bodyD = 'M40 76C42 58 64 54 90 58C114 56 136 60 142 80C146 98 132 110 112 108C94 112 70 112 54 106C42 100 38 90 40 76Z'
  cv.path(bodyD, `fill="${V(cv, body, 0.2)}" ${L}`, [[38, 54], [146, 112]])
  cv.path('M54 104C70 110 94 110 112 106C124 104 132 98 136 90C120 100 90 102 60 96Z', `fill="${belly}" fill-opacity=".85"`)
  // 肌理与花纹
  cv.path('M60 72C70 80 72 92 68 102M112 66C122 74 126 86 124 98', `fill="none" stroke="${dk(body, 0.4)}" stroke-opacity=".5" stroke-width=".9"`)
  if (o.marks === 'cloud') for (const [x, y] of [[80, 72], [100, 70], [118, 80]]) cv.path(`M${x} ${y}c0 -5 7 -6 8 -1c3 -3 8 0 5 4c-3 2 -6 0 -5 -2`, `fill="none" stroke="${C.gold3}" stroke-opacity=".85" stroke-width=".9" stroke-linecap="round"`)
  if (o.marks === 'stars') { const pts = [[74, 72], [88, 80], [102, 70], [118, 78], [128, 90]]; cv.path('M' + pts.map(p => p.join(' ')).join('L'), `fill="none" stroke="${C.gold4}" stroke-opacity=".55" stroke-width=".6"`); for (const [x, y] of pts) { cv.circle(x, y, 3.6, `fill="${cv.rad(C.gold4, 0.8)}"`); cv.circle(x, y, 1.3, `fill="${C.gold4}"`) } }
  if (o.marks === 'fire') for (const [x, y] of [[82, 70], [100, 66], [116, 74]]) cv.path(`M${x} ${y + 10}c-4 -4 -2 -9 2 -12c-1 4 3 5 3 2c3 4 2 8 -1 10`, `fill="${C.fire2}" fill-opacity=".85" ${T}`, [[x - 4, y - 4], [x + 6, y + 10]])
  // 背脊毛
  tufts(cv, [[70, 58, -1.9], [80, 57, -1.8], [90, 58, -1.6], [100, 57, -1.5], [110, 58, -1.4], [122, 60, -1.2], [132, 66, -1]], lt(body, 0.45), 4.4, 0.8)
  cv.path('M44 70C52 60 70 57 90 60C110 58 130 62 138 74', `fill="none" stroke="${lt(body, 0.6)}" stroke-opacity=".55" stroke-width="1"`)
  leg(cv, 62, 100, 44, 11, body); leg(cv, 126, 98, 46, 12, body)
  if (o.spikes) for (let i = 0; i < 6; i++) {
    const x = 64 + i * 13, y = 58 - Math.sin(i / 5 * Math.PI) * 4, hh = 16 + (i % 2) * 7
    cv.path(`M${x - 5} ${y + 2}L${x - 1} ${y - hh}L${x + 5} ${y + 2}Z`, `fill="${cv.grad([[0, '#fff'], [0.3, o.spikes], [1, dk(o.spikes, 0.3)]])}" ${T}`, [[x - 5, y - hh]])
    cv.path(`M${x - 1} ${y - hh}L${x + 1.4} ${y + 1}`, `stroke="${dk(o.spikes, 0.3)}" stroke-width=".6"`)
    cv.circle(x - 1, y - hh + 3, 4, `fill="${cv.rad(o.spikes, 0.5)}"`)
  }
  if (o.mane) {
    cv.path('M58 44C70 36 80 48 76 60C86 70 80 88 66 90C60 100 44 96 42 86C30 84 30 70 38 64C34 52 46 42 58 44Z', `fill="${V(cv, o.mane, 0.25)}" ${L}`)
    // 卷毛
    for (const [x, y, r] of [[52, 50, 4], [66, 50, 4.4], [72, 64, 4.4], [70, 80, 4], [56, 88, 4.4], [44, 78, 4], [42, 64, 4]]) cv.path(`M${x - r} ${y}a${r} ${r} 0 1 1 ${r} ${r}a${r * 0.5} ${r * 0.5} 0 1 1 ${-r * 0.4} ${-r * 0.8}`, `fill="none" stroke="${dk(o.mane, 0.35)}" stroke-width=".9" stroke-linecap="round"`, [[x - r, y - r], [x + r, y + r]])
    tufts(cv, [[76, 60, -0.4], [80, 74, 0], [74, 88, 0.6], [60, 94, 1.4], [44, 92, 2.2]], lt(o.mane, 0.4), 5, 1)
  }
  const Hd = o.head ?? 'wolf'
  if (Hd === 'wolf') {
    cv.path('M52 46L58 22L66 44Z', `fill="${V(cv, body)}" ${L}`)
    cv.path('M55 42L58 28L62 42Z', `fill="${C.red3}" fill-opacity=".6"`)
    cv.path('M36 44L40 20L50 40Z', `fill="${dk(body, 0.2)}" ${L}`)
    cv.path('M60 50C58 36 42 32 32 40C24 46 12 50 6 58C8 66 20 70 32 70C44 72 60 66 60 50Z', `fill="${V(cv, body, 0.2)}" ${L}`)
    cv.path('M6 58C12 62 22 64 32 62', `fill="none" ${T}`)
    cv.path('M10 63l2.4 5 2 -5 2.4 5 2 -5 2.4 5', `fill="#fbf6ea" ${T}`)
    cv.path('M9 58l2 3', `stroke="#fbf6ea" stroke-width="1.4"`)
    cv.circle(7, 57, 2.4, `fill="${C.line}"`)
    cv.path('M42 42q6 -3 12 1', `fill="none" stroke="${dk(body, 0.4)}" stroke-width=".8"`)
    tufts(cv, [[58, 58, 0.6], [56, 64, 1], [50, 68, 1.4]], lt(body, 0.5), 4)
    eye(cv, 34, 48, 2.8, o.eye ?? C.fire3)
  } else if (Hd === 'lion') {
    cv.path('M58 50C58 34 40 30 28 36C18 40 10 48 8 58C10 70 24 76 36 74C50 72 58 64 58 50Z', `fill="${V(cv, body, 0.2)}" ${L}`)
    cv.path('M8 58C14 64 24 66 34 64', `fill="none" ${T}`)
    cv.path('M12 66l2.4 6 2 -6 2.4 6 2 -6 2.4 6', `fill="#fbf6ea" ${T}`)
    cv.path('M36 34C34 20 42 10 52 12C44 18 42 26 44 34Z', `fill="${V(cv, o.accent)}" ${L}`)
    cv.path('M42 30C40 22 44 16 50 14', `fill="none" stroke="${dk(o.accent, 0.3)}" stroke-width=".6"`)
    cv.circle(10, 55, 2.8, `fill="${C.line}"`)
    cv.path('M14 52q-6 -1 -10 2M14 54q-6 1 -9 5', `fill="none" stroke="${C.gold3}" stroke-width=".6"`)
    eye(cv, 30, 46, 3.2, o.eye ?? C.fire3)
    cv.path('M22 40l12 -3', `stroke="${C.line}" stroke-width="2" stroke-linecap="round"`)
  } else if (Hd === 'qilin') {
    cv.path('M60 50C58 36 42 32 32 38C22 44 12 48 6 58C8 66 22 70 34 70C48 70 60 64 60 50Z', `fill="${V(cv, body, 0.2)}" ${L}`)
    cv.path('M40 36C38 20 46 8 58 4C50 14 48 24 50 36Z', `fill="${cv.grad([[0, '#fff'], [0.4, o.accent], [1, dk(o.accent, 0.3)]])}" ${L}`)
    cv.path('M52 38C54 24 62 16 72 14C64 22 62 30 62 42Z', `fill="${cv.grad([[0, '#fff'], [0.4, o.accent], [1, dk(o.accent, 0.3)]])}" ${L}`)
    for (const d of ['M8 62C4 72 8 80 14 84', 'M16 66C14 74 18 80 22 82']) { cv.path(d, `fill="none" stroke="${C.line}" stroke-width="3.2" stroke-linecap="round"`); cv.path(d, `fill="none" stroke="${o.accent}" stroke-width="1.8" stroke-linecap="round"`) }
    cv.circle(8, 56, 2.2, `fill="${C.line}"`)
    cv.path('M9 62l2 4 2 -4 2 4', `fill="#fbf6ea" ${T}`)
    eye(cv, 32, 48, 3, C.jade4)
  }
}

// ── 我方：御兽军（青灵狼 + 甲胄骑手），朝右 ──
{
  const cv = new Canvas()
  cv.open('a-pulse'); cv.ellipse(84, 90, 86, 62, `fill="${cv.rad(C.jade2, 0.35)}"`); cv.close()
  quadruped(cv, { body: C.jade2, belly: C.jade4, dark: C.jade0, mane: C.jade3, tail: 'bush', head: 'wolf', marks: 'cloud', eye: C.gold3 })
  // 鞍鞯：流苏 + 金边
  cv.path('M78 60C86 52 106 52 112 60L110 72C100 77 88 77 80 72Z', `fill="${V(cv, C.red1)}" ${L}`)
  cv.path('M80 70C90 75 100 75 110 70', `fill="none" stroke="${C.gold2}" stroke-width="1.2"`)
  for (let i = 0; i < 7; i++) cv.path(`M${82 + i * 4.4} ${73 + Math.sin(i / 6 * Math.PI) * 2}v5`, `stroke="${C.gold2}" stroke-width=".7"`)
  // 骑手：甲胄 + 红缨盔
  cv.path('M86 60L92 30Q100 24 108 30L112 60Z', `fill="${V(cv, C.blue1)}" ${L}`)
  for (const y of [36, 42, 48, 54]) cv.path(`M${90 + (y - 30) * 0.12} ${y}h${18 - (y - 30) * 0.02}`, `stroke="${C.gold1}" stroke-width=".8"`)
  cv.path('M92 30Q100 26 108 30L106 34Q100 31 94 34Z', `fill="${C.gold2}" ${T}`)
  cv.path('M92 62Q88 72 84 74L92 76Q96 70 98 62Z', `fill="${C.blue0}" ${T}`)
  cv.circle(100, 18, 7.4, `fill="${V(cv, C.skin, 0.1)}" ${L}`)
  cv.path('M92 18C91 8 96 5 100 5C105 5 109 9 108 18L106 14C103 11 97 11 94 14Z', `fill="${V(cv, C.stone2)}" ${L}`)
  cv.path('M100 5V0', `stroke="${C.gold2}" stroke-width="1.4"`, [[100, -2]])
  cv.path('M100 0c-4 -2 -8 0 -10 4c4 -1 7 -1 10 -4z', `fill="${C.red2}" ${T}`, [[90, -3]])
  cv.circle(97, 19, 0.9, `fill="${C.line}"`)
  cv.path('M122 2L68 52', `stroke="${C.line}" stroke-width="3.4" stroke-linecap="round"`)
  cv.path('M122 2L68 52', `stroke="${cv.grad([[0, C.wood3], [1, C.wood1]])}" stroke-width="1.8" stroke-linecap="round"`)
  cv.path('M68 52l-9 12 13 -6z', `fill="${cv.grad([[0, '#fff'], [1, C.stone2]])}" ${T}`, [[58, 64]])
  cv.path('M74 46c-3 2 -6 6 -5 10c2 -3 5 -4 8 -5z', `fill="${C.red2}" ${T}`, [[68, 44], [78, 56]])
  cv.path('M106 58c4 2 8 2 10 0', `fill="none" stroke="${C.skin}" stroke-width="2.4" stroke-linecap="round"`)
  out('troop/yushou.svg', cv, true)
}

// ── 傀儡：木铜甲、铆钉、关节齿轮、符纹核心 ──
function puppet(cv, o) {
  const m = o.metal, d = o.metalDark, g = o.glow
  shadow(cv, 60, 152, 42)
  for (const x of [46, 70]) {
    cv.path(`M${x} 108h12v18h-12z`, `fill="${H(cv, d)}" ${L}`)
    cv.circle(x + 6, 128, 5.4, `fill="${V(cv, m)}" ${L}`)
    cv.circle(x + 6, 128, 2, `fill="${dk(m, 0.4)}"`)
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; cv.circle(x + 6 + Math.cos(a) * 4.2, 128 + Math.sin(a) * 4.2, 0.6, `fill="${lt(m, 0.4)}"`) }
    cv.path(`M${x - 2} 132h16l2 18h-20z`, `fill="${V(cv, m)}" ${L}`)
    cv.path(`M${x - 1} 140h16`, `stroke="${dk(m, 0.4)}" stroke-width=".8"`)
    for (const dx of [1, 13]) cv.circle(x + dx, 135, 0.8, `fill="${C.gold3}"`)
  }
  // 躯干：胸甲分片 + 铆钉 + 木纹
  cv.path('M36 58L84 58L80 108L40 108Z', `fill="${H(cv, m, 0.3)}" ${L}`)
  for (const y of [72, 86, 98]) cv.path(`M${38 + (y - 58) * 0.04} ${y}H${82 - (y - 58) * 0.04}`, `stroke="${dk(m, 0.45)}" stroke-width="1"`)
  for (const y of [72, 86, 98]) cv.path(`M${39 + (y - 58) * 0.04} ${y + 1}H${81 - (y - 58) * 0.04}`, `stroke="${lt(m, 0.35)}" stroke-width=".5"`)
  for (const y of [64, 78, 92, 104]) for (const x of [42, 78]) cv.circle(x, y, 0.9, `fill="${C.gold3}" stroke="${C.line}" stroke-width=".3"`)
  for (const d2 of ['M46 62q2 4 0 8', 'M72 76q2 4 0 8', 'M50 90q2 4 0 8']) cv.path(d2, `fill="none" stroke="${dk(m, 0.35)}" stroke-opacity=".6" stroke-width=".5"`)
  // 符纹核心
  cv.open('a-pulse'); cv.circle(60, 80, 12, `fill="${cv.rad(g, 0.6)}"`); cv.close()
  cv.circle(60, 80, 7, `fill="${C.ink}" ${T}`)
  cv.circle(60, 80, 5, `fill="none" stroke="${g}" stroke-width=".8"`)
  cv.path('M60 75.5v9M55.5 80h9M57 77l6 6M63 77l-6 6', `stroke="${g}" stroke-width=".7"`)
  cv.circle(60, 80, 1.8, `fill="#fff"`)
  for (const d2 of ['M60 87V104', 'M53 80H42', 'M67 80H78']) cv.path(d2, `stroke="${g}" stroke-opacity=".7" stroke-width=".8"`)
  // 肩甲
  for (const [x, s] of [[36, -1], [84, 1]]) {
    cv.path(`M${x} 56C${x + s * 14} 52 ${x + s * 18} 62 ${x + s * 16} 72L${x} 70Z`, `fill="${V(cv, m)}" ${L}`)
    cv.path(`M${x + s * 2} 62C${x + s * 10} 60 ${x + s * 14} 64 ${x + s * 14} 68`, `fill="none" stroke="${lt(m, 0.4)}" stroke-width=".7"`)
    cv.circle(x + s * 8, 60, 1.2, `fill="${C.gold3}" ${T}`)
  }
  // 头盔：护颊 + 眼缝 + 缨
  cv.path('M46 30Q46 18 60 18Q74 18 74 30L74 52L46 52Z', `fill="${H(cv, m, 0.3)}" ${L}`)
  cv.path('M46 36h28v8h-28z', `fill="${C.ink}" ${T}`)
  cv.path('M49 40h22', `stroke="${g}" stroke-width="2.6" stroke-linecap="round"`)
  cv.path('M49 40h22', `stroke="#fff" stroke-width=".8" stroke-linecap="round"`)
  cv.open('a-flicker'); cv.ellipse(60, 40, 16, 6, `fill="${cv.rad(g, 0.4)}"`); cv.close()
  cv.path('M50 46v6M70 46v6M60 46v6', `stroke="${dk(m, 0.4)}" stroke-width=".8"`)
  cv.path('M48 24Q60 20 72 24', `fill="none" stroke="${lt(m, 0.4)}" stroke-width=".8"`)
  cv.path('M60 18V8', `stroke="${C.line}" stroke-width="3" stroke-linecap="round"`)
  cv.path('M60 18V8', `stroke="${C.gold2}" stroke-width="1.6" stroke-linecap="round"`)
  cv.path('M60 9c-6 -6 -12 -4 -14 2c4 -2 8 -2 14 -2c-4 -4 -2 -8 2 -8c-2 2 -2 5 -2 8z', `fill="${V(cv, o.plume)}" ${T}`, [[46, 0], [62, 12]])
  // 右臂武器、左臂盾
  cv.path('M86 70l8 26', `stroke="${C.line}" stroke-width="11" stroke-linecap="round"`)
  cv.path('M86 70l8 26', `stroke="${d}" stroke-width="8" stroke-linecap="round"`)
  cv.path('M86 70l8 26', `stroke="${lt(d, 0.3)}" stroke-width="1.6" stroke-linecap="round" transform="translate(-2 0)"`)
  cv.circle(95, 98, 6, `fill="${V(cv, m)}" ${L}`)
  o.weapon(cv)
  cv.path('M34 70l-8 24', `stroke="${C.line}" stroke-width="11" stroke-linecap="round"`)
  cv.path('M34 70l-8 24', `stroke="${d}" stroke-width="8" stroke-linecap="round"`)
  o.shield?.(cv)
}
{
  const cv = new Canvas()
  puppet(cv, {
    metal: C.wood2, metalDark: C.wood1, glow: C.jade3, plume: C.red2,
    weapon: cv => {
      cv.path('M96 98L120 46', `stroke="${C.line}" stroke-width="5.4" stroke-linecap="round"`)
      cv.path('M96 98L120 46', `stroke="${cv.grad([[0, '#fff'], [0.5, C.stone3], [1, C.stone1]], 'h')}" stroke-width="3.4" stroke-linecap="round"`)
      cv.path('M98 94L119 48', `stroke="#fff" stroke-opacity=".7" stroke-width=".6"`)
      cv.path('M89 91l14 7', `stroke="${C.line}" stroke-width="5" stroke-linecap="round"`)
      cv.path('M89 91l14 7', `stroke="${C.gold2}" stroke-width="3" stroke-linecap="round"`)
      cv.path('M94 102c-2 4 -1 8 -4 10', `fill="none" stroke="${C.red2}" stroke-width="1.2"`)
    },
    shield: cv => {
      cv.circle(22, 96, 20, `fill="${V(cv, C.gold1)}" ${L}`)
      cv.circle(22, 96, 15, `fill="${H(cv, C.wood1)}" ${T}`)
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; cv.circle(22 + Math.cos(a) * 17.5, 96 + Math.sin(a) * 17.5, 0.9, `fill="${C.gold3}" stroke="${C.line}" stroke-width=".3"`) }
      cv.path('M22 83a13 13 0 0 1 0 26a6.5 6.5 0 0 1 0 -13a6.5 6.5 0 0 0 0 -13z', `fill="${C.gold2}" fill-opacity=".85"`)
      cv.circle(22, 89.5, 1.6, `fill="${C.wood1}"`); cv.circle(22, 102.5, 1.6, `fill="${C.gold2}"`)
      cv.path('M10 84q6 -6 14 -6', `fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"`)
    },
  })
  out('troop/kuilei.svg', cv)
}
{
  const cv = new Canvas()
  cv.open('a-pulse'); cv.ellipse(60, 90, 74, 76, `fill="${cv.rad(C.red2, 0.4)}"`); cv.close()
  puppet(cv, {
    metal: C.gold1, metalDark: C.gold0, glow: C.fire2, plume: C.red1,
    weapon: cv => {
      cv.path('M96 100L112 26', `stroke="${C.line}" stroke-width="6" stroke-linecap="round"`)
      cv.path('M96 100L112 26', `stroke="${H(cv, C.wood2)}" stroke-width="3.6" stroke-linecap="round"`)
      cv.path('M98 14h28v22h-28z', `fill="${H(cv, C.stone2, 0.3)}" ${L}`)
      cv.path('M98 22h28M98 28h28', `stroke="${C.fire2}" stroke-width="1.2"`)
      for (const x of [104, 112, 120]) cv.circle(x, 25, 1.1, `fill="${C.fire3}"`)
      cv.path('M100 16h24', `stroke="#fff" stroke-opacity=".5" stroke-width=".8"`)
    },
    shield: cv => {
      cv.path('M12 68h26v46l-13 9 -13 -9z', `fill="${V(cv, C.red1)}" ${L}`)
      cv.path('M15 71h20v41l-10 7 -10 -7z', `fill="none" stroke="${C.gold2}" stroke-width="1"`)
      cv.path('M25 76v38M17 90h16', `stroke="${C.gold3}" stroke-width="1.8"`)
      cv.circle(25, 90, 3.4, `fill="${C.gold2}" ${T}`)
    },
  })
  for (const [x, y] of [[38, 60], [80, 104], [96, 60]]) cv.path(`M${x} ${y}l3 -4 1 5 4 -3`, `fill="none" stroke="${C.fire3}" stroke-width=".9" stroke-linecap="round"`)
  out('monster/ch7-warpuppet.svg', cv, true)
}

// ── 青牛谷 · 妖蟒 ──
{
  const cv = new Canvas()
  shadow(cv, 84, 150, 62)
  tube(cv, 'M140 140C170 130 160 108 120 110C80 112 50 124 60 138C70 150 120 150 140 140', 16, C.grass2, [[40, 100], [170, 152]])
  tube(cv, 'M120 110C150 98 140 76 110 80C84 84 70 70 60 56C52 44 48 36 40 34', 18, C.grass2, [[30, 30], [150, 112]])
  cv.path('M126 110C140 104 142 92 132 86', `fill="none" stroke="${C.gold3}" stroke-opacity=".7" stroke-width="3" stroke-dasharray="3 5" stroke-linecap="round"`)
  // 头：扁三角吻、鳞甲头盖、角
  cv.path('M46 36C42 20 26 16 14 22C6 26 1 33 3 40C14 46 32 47 46 36Z', `fill="${V(cv, C.grass2, 0.25)}" ${L}`)
  cv.path('M44 34C36 26 26 24 16 28', `fill="none" stroke="${C.grass4}" stroke-opacity=".6" stroke-width="1"`)
  cv.path('M3 40C14 43 30 43 42 38', `fill="none" ${T}`)
  cv.path('M8 41l2 4 2 -4M16 42l2 4 2 -4', `fill="#fbf6ea" ${T}`)
  cv.path('M4 38c-4 1 -6 3 -8 5m8 -5c-4 0 -7 -1 -9 -3', `fill="none" stroke="${C.red2}" stroke-width="1.2" stroke-linecap="round"`, [[-6, 34], [4, 44]])
  cv.path('M26 20l6 -9 3 10z', `fill="${V(cv, C.gold2)}" ${T}`)
  cv.path('M36 22l5 -6 2 8z', `fill="${V(cv, C.gold2)}" ${T}`)
  cv.circle(9, 31, 0.9, `fill="${C.line}"`)
  eye(cv, 22, 29, 2.8, C.gold3)
  out('monster/ch1-serpent.svg', cv)
}

// ── 乱星海 · 海蛟 ──
{
  const cv = new Canvas()
  const body = 'M170 110C150 70 120 120 96 96C74 74 60 50 40 44'
  for (let i = 0; i < 7; i++) { const t = i / 6; const x = 162 - t * 116, y = 94 - Math.sin(t * Math.PI) * 18 - t * 28; cv.path(`M${x - 8} ${y}C${x - 6} ${y - 10} ${x - 4} ${y - 16} ${x - 1} ${y - 22}C${x + 1} ${y - 14} ${x + 4} ${y - 8} ${x + 7} ${y - 2}Z`, `fill="${cv.grad([[0, C.jade4], [1, C.jade1]])}" ${T}`, [[x - 8, y - 24]]); cv.path(`M${x - 1} ${y - 20}L${x - 1} ${y - 2}`, `stroke="${C.jade0}" stroke-width=".5"`) }
  tube(cv, body, 20, C.blue2, [[30, 40], [176, 116]])
  cv.path('M160 100C146 82 124 106 100 90C80 74 66 56 48 50', `fill="none" stroke="${C.paper1}" stroke-opacity=".5" stroke-width="3" stroke-dasharray="2 4" stroke-linecap="round"`)
  // 头：龙首 + 鬃 + 须 + 角
  cv.path('M34 26C36 12 46 6 58 6C48 14 46 20 46 28Z', `fill="${V(cv, C.gold2)}" ${L}`)
  cv.path('M52 44C46 26 24 22 10 32C2 38 0 46 4 52C18 56 40 56 52 44Z', `fill="${V(cv, C.blue2, 0.25)}" ${L}`)
  for (const [x, y] of [[52, 40], [54, 48], [50, 54]]) cv.path(`M${x} ${y}c6 -2 10 0 12 4c-5 -1 -8 0 -12 -4z`, `fill="${C.jade2}" ${T}`, [[x, y - 2], [x + 12, y + 4]])
  cv.path('M20 30C28 26 38 26 46 32', `fill="none" stroke="${C.blue3}" stroke-opacity=".7" stroke-width="1"`)
  for (const d of ['M8 50C0 60 4 72 14 76', 'M16 54C12 62 16 70 24 72']) { cv.path(d, `fill="none" stroke="${C.line}" stroke-width="3" stroke-linecap="round"`); cv.path(d, `fill="none" stroke="${C.gold3}" stroke-width="1.6" stroke-linecap="round"`) }
  cv.path('M6 50l2.4 5 2 -5 2.4 5 2 -5', `fill="#fbf6ea" ${T}`)
  cv.circle(6, 42, 1, `fill="${C.line}"`)
  eye(cv, 26, 38, 3.2, C.gold3)
  // 浪：层叠浪花 + 浪尖卷
  cv.path('M16 152C32 124 56 140 70 122C80 138 100 118 116 130C128 114 150 126 178 112L182 158H14Z', `fill="${cv.grad([[0, C.blue2], [1, C.blue0]])}" ${L}`, [[14, 112], [182, 158]])
  for (const [x, y] of [[40, 132], [96, 128], [146, 122]]) {
    cv.path(`M${x - 12} ${y + 4}C${x - 8} ${y - 6} ${x + 4} ${y - 8} ${x + 8} ${y}c-3 -3 -8 -2 -8 2`, `fill="none" stroke="${C.jade4}" stroke-width="1.6" stroke-linecap="round"`, [[x - 12, y - 8]])
    for (let k = 0; k < 4; k++) cv.circle(x - 10 + k * 5, y - 6 - (k % 2) * 3, 1, `fill="#fff" fill-opacity=".8"`)
  }
  cv.path('M20 146C50 140 90 142 180 136', `fill="none" stroke="${C.blue3}" stroke-opacity=".5" stroke-width="1"`)
  out('monster/ch2-leviathan.svg', cv)
}

// ── 落霞涧 · 赤焰雕 ──
{
  const cv = new Canvas()
  cv.open('a-pulse'); cv.ellipse(88, 80, 90, 74, `fill="${cv.rad(C.fire2, 0.5)}"`); cv.close()
  const feather = (d, c) => cv.path(d, `fill="${V(cv, c, 0.25)}" ${L}`)
  // 远翼
  feather('M96 70C110 40 140 16 170 10C160 24 166 30 150 40C164 40 160 50 144 56C154 60 146 70 120 80Z', C.fire0)
  for (const d of ['M104 64C120 44 140 28 160 18', 'M110 70C126 56 142 46 156 42', 'M114 76C126 68 138 62 146 58']) cv.path(d, `fill="none" stroke="${C.fire2}" stroke-opacity=".7" stroke-width=".8"`)
  // 尾羽：三支带翎眼的长羽
  for (const [d, ex, ey] of [['M104 100C124 118 148 140 178 146C166 152 150 148 140 140', 172, 146], ['M102 104C118 126 132 150 152 164C140 164 128 156 122 146', 148, 160], ['M100 102C124 112 152 118 184 118C174 126 158 128 142 124', 178, 120]]) {
    cv.path(d + 'C130 132 116 120 100 106Z', `fill="${V(cv, C.fire1)}" ${L}`)
    cv.circle(ex, ey, 4, `fill="${C.gold3}" ${T}`); cv.circle(ex, ey, 2, `fill="${C.fire0}"`); cv.circle(ex, ey, 0.8, `fill="${C.jade3}"`)
  }
  // 身体：羽鳞
  cv.path('M50 72C60 56 90 58 106 72C118 84 112 104 94 108C74 112 54 100 50 72Z', `fill="${V(cv, C.fire1)}" ${L}`)
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) { const x = 62 + k * 9 + r * 3, y = 76 + r * 8; cv.path(`M${x - 4} ${y}q4 5 8 0`, `fill="none" stroke="${C.fire3}" stroke-opacity=".7" stroke-width=".8"`) }
  // 近翼：分层飞羽
  feather('M70 70C60 36 70 10 96 0C92 14 100 16 92 28C104 22 108 30 98 40C110 38 110 50 96 56C104 60 96 70 84 76Z', C.fire2)
  for (const d of ['M76 64C70 44 76 22 92 6', 'M82 66C80 50 88 34 100 26', 'M86 70C88 58 96 48 104 44']) cv.path(d, `fill="none" stroke="${C.fire0}" stroke-opacity=".6" stroke-width=".8"`)
  cv.path('M74 58C70 40 76 20 90 8', `fill="none" stroke="${C.gold4}" stroke-opacity=".7" stroke-width="1"`)
  // 头 + 冠羽 + 喙
  cv.path('M58 66C50 50 34 48 26 56C22 60 14 62 8 66C16 70 24 72 30 74C42 80 56 78 58 66Z', `fill="${V(cv, C.fire1)}" ${L}`)
  cv.path('M8 66L22 61L24 70Z', `fill="${V(cv, C.gold2)}" ${T}`)
  cv.path('M8 66L22 66', `stroke="${C.line}" stroke-width=".6"`)
  for (const [d, c] of [['M34 52C28 36 34 26 44 22C40 32 42 40 46 48Z', C.fire3], ['M42 50C40 38 48 30 56 30C52 38 52 44 54 52Z', C.gold3], ['M28 56C22 44 24 34 30 30C30 40 32 48 34 54Z', C.fire2]]) cv.path(d, `fill="${V(cv, c)}" ${T}`)
  eye(cv, 32, 60, 2.6, C.gold4)
  cv.path('M74 108l-4 12M88 108l2 12', `stroke="${C.line}" stroke-width="3" stroke-linecap="round"`)
  claws(cv, 70, 120, -1); claws(cv, 90, 120, -1)
  out('monster/ch3-firebird.svg', cv)
}

// ── 太岳山脉 · 镇山巨猿（正面）──
{
  const cv = new Canvas()
  const fur = C.wood1, furL = C.wood2
  shadow(cv, 80, 152, 64)
  cv.open('a-pulse'); cv.ellipse(80, 80, 60, 60, `fill="${cv.rad(C.gold3, 0.25)}"`); cv.close()
  cv.path('M52 112C44 126 44 140 46 150H72L74 120Z', `fill="${H(cv, fur)}" ${L}`)
  cv.path('M108 112C116 126 116 140 114 150H88L86 120Z', `fill="${H(cv, fur)}" ${L}`)
  cv.path('M44 56C24 64 16 96 20 132L40 134C40 106 46 86 56 74Z', `fill="${H(cv, fur)}" ${L}`)
  cv.path('M116 56C136 64 144 96 140 132L120 134C120 106 114 86 104 74Z', `fill="${H(cv, fur)}" ${L}`)
  tufts(cv, [[22, 90, 3.1], [21, 104, 3.1], [22, 118, 3.1], [138, 90, 0], [139, 104, 0], [138, 118, 0], [46, 130, 3.1], [114, 130, 0]], dk(fur, 0.3), 4, 1)
  // 石护肩
  for (const [x, s] of [[40, -1], [120, 1]]) cv.path(`M${x - s * 8} 50C${x + s * 6} 44 ${x + s * 18} 52 ${x + s * 18} 66L${x - s * 4} 68Z`, `fill="${V(cv, C.stone2)}" ${L}`, [[x - 10, 44], [x + 20, 68]])
  for (const [x, s] of [[40, -1], [120, 1]]) cv.path(`M${x} 52l${s * 6} 6 ${s * 4} -2`, `fill="none" stroke="${C.gold3}" stroke-width="1"`)
  for (const x of [30, 130]) {
    cv.path(`M${x - 16} 146C${x - 18} 124 ${x + 18} 124 ${x + 16} 146Z`, `fill="${V(cv, furL)}" ${L}`, [[x - 18, 122], [x + 18, 148]])
    cv.path(`M${x - 8} 146v-8M${x} 146v-9M${x + 8} 146v-8`, `stroke="${C.line}" stroke-width="1"`)
    cv.path(`M${x - 12} 132q12 -6 24 0`, `fill="none" stroke="${lt(furL, 0.4)}" stroke-width=".8"`)
  }
  // 躯干 + 胸甲皮 + 符纹
  cv.path('M40 60C50 40 110 40 120 60C126 86 116 118 80 122C44 118 34 86 40 60Z', `fill="${V(cv, furL)}" ${L}`)
  tufts(cv, [[42, 70, 3.4], [40, 84, 3.2], [44, 100, 2.8], [118, 70, -0.2], [120, 84, 0], [116, 100, 0.4]], dk(furL, 0.3), 4.4, 1)
  cv.path('M58 66C66 60 94 60 102 66C104 86 96 106 80 108C64 106 56 86 58 66Z', `fill="${V(cv, C.wood3)}" ${T}`)
  for (const y of [74, 84, 94]) cv.path(`M${62 + (y - 74) * 0.2} ${y}q${18 - (y - 74) * 0.2} 4 ${36 - (y - 74) * 0.4} 0`, `fill="none" stroke="${dk(C.wood3, 0.3)}" stroke-width=".7"`)
  cv.circle(80, 84, 16, `fill="${cv.rad(C.gold3, 0.45)}"`)
  cv.path('M66 76h28M80 70v32M70 92h20M72 70l-4 -4M88 70l4 -4', `stroke="${C.gold3}" stroke-width="2" stroke-linecap="round"`)
  cv.path('M66 76h28M80 70v32M70 92h20', `stroke="#fff" stroke-opacity=".6" stroke-width=".6" stroke-linecap="round"`)
  // 头
  cv.path('M60 44C58 26 70 16 80 16C90 16 102 26 100 44C100 56 92 62 80 62C68 62 60 56 60 44Z', `fill="${V(cv, fur)}" ${L}`)
  tufts(cv, [[66, 20, -2], [74, 16, -1.7], [86, 16, -1.4], [94, 20, -1.1]], dk(fur, 0.3), 4.4, 1)
  cv.path('M66 42C66 34 94 34 94 42C96 54 88 58 80 58C72 58 64 54 66 42Z', `fill="${V(cv, C.wood3)}" ${T}`)
  cv.path('M64 34Q80 30 96 34', `fill="none" stroke="${C.line}" stroke-width="3.4" stroke-linecap="round"`)
  eye(cv, 72, 40, 2.4, C.gold3); eye(cv, 88, 40, 2.4, C.gold3)
  cv.path('M77 46q3 2 6 0', `fill="none" stroke="${C.line}" stroke-width=".8"`)
  cv.path('M72 52q8 4 16 0', `fill="none" ${T}`)
  cv.path('M73 52l2 4 2 -4M83 52l2 4 2 -4', `fill="#fbf6ea" ${T}`)
  out('monster/ch4-ape.svg', cv)
}

// ── 万毒岭 · 九首毒蟒（画三首）──
{
  const cv = new Canvas()
  cv.open('a-pulse'); cv.ellipse(90, 132, 84, 32, `fill="${cv.rad(C.grass4, 0.4)}"`); cv.close()
  shadow(cv, 90, 152, 66)
  const necks = ['M100 136C96 100 70 90 50 72C40 62 36 52 32 44', 'M110 132C112 96 104 70 96 48C92 38 94 28 96 20', 'M120 136C136 104 150 90 160 70C164 60 164 52 162 46']
  const heads = [[32, 44, 1], [96, 20, 1], [162, 46, -1]]
  for (const d of necks) tube(cv, d, 14, C.purple1, [[30, 18], [166, 140]])
  cv.path('M50 150C50 120 90 110 110 112C140 112 170 124 170 150Z', `fill="${scales(cv, C.purple1, 8)}" ${L}`)
  cv.path('M50 150C50 120 90 110 110 112C140 112 170 124 170 150Z', `fill="${cv.grad([[0, '#fff', 0.15], [1, '#000', 0.3]])}"`)
  for (const [x, y, dir] of heads) {
    cv.add(`<g transform="translate(${x} ${y}) scale(${dir} 1)">
      <path d="M-2 -10c-4 -8 -2 -14 4 -16c-1 5 1 9 4 12z" fill="${C.grass3}" ${T}/>
      <path d="M8 4C6 -10 -8 -14 -20 -8C-26 -4 -30 2 -28 6C-18 10 -2 12 8 4Z" fill="${C.purple2}" ${L}/>
      <path d="M-24 -2C-16 -8 -4 -8 4 -2" fill="none" stroke="${C.purple3}" stroke-opacity=".7" stroke-width=".8"/>
      <path d="M-28 6C-20 8 -8 8 4 4" fill="none" ${T}/>
      <path d="M-26 6l1.6 5 1.6 -5M-18 7l1.6 5 1.6 -5" fill="#fbf6ea" ${T}/>
      <circle cx="-12" cy="-3" r="6" fill="${C.grass4}" fill-opacity=".3"/><ellipse cx="-12" cy="-3" rx="3" ry="2.6" fill="${C.grass4}" ${T}/><ellipse cx="-12" cy="-3" rx=".8" ry="2.2" fill="${C.line}"/>
      <path d="M-25 12q-1 5 1 8" fill="none" stroke="${C.grass4}" stroke-width="1.6" stroke-linecap="round"/><circle cx="-24" cy="22" r="1.4" fill="${C.grass4}"/></g>`, [[x - 32, y - 28], [x + 32, y + 24]])
  }
  for (const [x, y] of [[60, 146], [130, 146], [96, 140]]) { cv.open('a-pulse', x * 0.02); cv.circle(x, y, 4, `fill="${cv.rad(C.grass4, 0.7)}"`); cv.circle(x, y, 1.4, `fill="${C.grass4}"`); cv.close() }
  out('monster/ch5-hydra.svg', cv)
}

// ── 幽冥谷 · 化形阴尸（悬浮鬼影）──
{
  const cv = new Canvas()
  cv.open('a-pulse'); cv.ellipse(70, 80, 72, 84, `fill="${cv.rad(C.jade3, 0.45)}"`); cv.close()
  // 背后幽魂
  for (const [x, y, s] of [[24, 60, 1], [116, 56, -1]]) cv.path(`M${x} ${y}c${s * 6} -8 ${s * 14} -6 ${s * 14} 4c0 8 ${s * -4} 18 ${s * -10} 26c${s * 2} -8 ${s * -4} -14 ${s * -4} -30z`, `fill="${C.jade3}" fill-opacity=".25"`, [[x - 14, y - 8], [x + 14, y + 30]])
  const robeD = 'M44 44C30 70 24 110 16 150L30 138L38 156L50 140L62 158L74 142L86 156L96 138L112 150C104 110 98 70 84 44Z'
  cv.path(robeD, `fill="${cv.grad([[0, '#58706a'], [0.6, '#2c3d3b'], [1, '#1c2a2a', 0.3]])}" ${L}`, [[16, 44], [112, 158]])
  for (const d of ['M52 56C46 90 40 120 34 148', 'M64 60C62 100 62 130 62 156', 'M76 56C82 90 88 120 92 148']) cv.path(d, `fill="none" stroke="#0e1718" stroke-opacity=".5" stroke-width="1"`)
  for (const d of ['M48 60C42 94 36 124 28 146', 'M70 58C72 96 74 126 76 150']) cv.path(d, `fill="none" stroke="${C.jade3}" stroke-opacity=".25" stroke-width=".8"`)
  // 袍上符纹残带
  cv.path('M40 96Q64 104 92 96L94 104Q64 112 38 104Z', `fill="${C.red0}" fill-opacity=".85" ${T}`)
  for (let i = 0; i < 5; i++) cv.path(`M${46 + i * 10} 100v4`, `stroke="${C.gold2}" stroke-width=".8"`)
  // 兜帽 + 面 + 额符
  cv.path('M40 50C36 20 52 6 64 6C78 6 94 20 88 50C80 56 48 56 40 50Z', `fill="${cv.grad([[0, '#58706a'], [1, '#2c3d3b']])}" ${L}`)
  cv.path('M44 44C42 26 54 14 64 14', `fill="none" stroke="${C.jade3}" stroke-opacity=".3" stroke-width=".8"`)
  cv.path('M50 46C48 30 56 22 64 22C74 22 80 30 78 46C72 50 56 50 50 46Z', `fill="${cv.grad([[0, '#9fb3a8'], [1, '#56695f']])}"`)
  cv.path('M52 44C52 36 58 32 64 32C70 32 76 36 76 44', `fill="none" stroke="#2c3d3b" stroke-width=".8"`)
  for (const x of [57, 71]) { cv.circle(x, 37, 5, `fill="${cv.rad(C.jade3, 0.7)}"`); cv.ellipse(x, 37, 2.6, 1.8, `fill="${C.ink}"`); cv.circle(x, 37, 1.1, `fill="${C.jade4}"`) }
  cv.path('M60 44q4 2 8 0', `fill="none" stroke="${C.ink}" stroke-width=".8"`)
  cv.path('M60 12h8v22l-4 3 -4 -3z', `fill="${C.gold3}" ${T}`, [[60, 12], [68, 37]])
  cv.path('M64 15v16M61.6 19h4.8M61.6 24h4.8M62 28l2 2 2 -2', `fill="none" stroke="${C.red1}" stroke-width=".8" stroke-linecap="round"`)
  // 骨手 + 锁链
  for (const [x, y, s] of [[26, 84, -1], [102, 80, 1]]) {
    cv.path(`M${x - s * 12} ${y - 14}C${x - s * 4} ${y - 8} ${x} ${y - 4} ${x} ${y}`, `fill="none" stroke="#2c3d3b" stroke-width="11" stroke-linecap="round"`, [[x - 14, y - 16], [x + 14, y + 4]])
    cv.path(`M${x - s * 12} ${y - 14}C${x - s * 4} ${y - 8} ${x} ${y - 4} ${x} ${y}`, `fill="none" stroke="#58706a" stroke-width="8" stroke-linecap="round"`)
    for (const [dx, dy] of [[8, 6], [10, 1], [9, -4], [6, -8]]) cv.path(`M${x} ${y}l${s * dx * 0.6} ${dy * 0.6}l${s * dx * 0.4} ${dy * 0.4 + 1.4}`, `fill="none" stroke="${C.stone4}" stroke-width="1.4" stroke-linecap="round"`)
  }
  for (let i = 0; i < 7; i++) cv.ellipse(20 - i * 2.4, 90 + i * 8, 2.8, 4, `fill="none" stroke="${C.stone3}" stroke-width="1.4"`)
  for (let i = 0; i < 7; i++) cv.ellipse(20 - i * 2.4, 90 + i * 8, 2.8, 4, `fill="none" stroke="${C.line}" stroke-opacity=".5" stroke-width=".4"`)
  // 鬼火
  for (const [x, y] of [[124, 40], [14, 30], [118, 120], [30, 150]]) {
    cv.open('a-float', x * 0.03)
    cv.circle(x, y, 10, `fill="${cv.rad(C.jade3, 0.6)}"`)
    cv.path(`M${x} ${y + 8}C${x - 7} ${y + 4} ${x - 4} ${y - 6} ${x} ${y - 12}C${x + 1} ${y - 6} ${x + 4} ${y - 5} ${x + 3} ${y - 9}C${x + 7} ${y - 2} ${x + 6} ${y + 5} ${x} ${y + 8}Z`, `fill="${cv.grad([[0, '#fff'], [0.4, C.jade3], [1, C.jade1]])}" ${T}`, [[x - 8, y - 12], [x + 8, y + 8]])
    cv.close()
  }
  out('monster/ch6-undead.svg', cv)
}

// ── 星落原 · 坠星天兽 ──
{
  const cv = new Canvas()
  cv.open('a-pulse'); cv.ellipse(88, 80, 92, 74, `fill="${cv.rad(C.purple2, 0.45)}"`); cv.close()
  quadruped(cv, { body: C.blue1, belly: C.purple2, dark: C.blue0, accent: C.purple3, spikes: C.purple3, tail: 'flame', head: 'qilin', marks: 'stars' })
  for (const [x, y, r] of [[20, 16, 5], [150, 20, 4], [170, 100, 3.4], [100, 8, 3], [8, 100, 2.6]]) {
    cv.open('a-flicker', x * 0.02)
    cv.circle(x, y, r * 2.6, `fill="${cv.rad(C.gold4, 0.6)}"`)
    cv.path(`M${x} ${y - r * 2}L${x + r * 0.4} ${y - r * 0.4}L${x + r * 2} ${y}L${x + r * 0.4} ${y + r * 0.4}L${x} ${y + r * 2}L${x - r * 0.4} ${y + r * 0.4}L${x - r * 2} ${y}L${x - r * 0.4} ${y - r * 0.4}Z`, `fill="${C.gold4}"`, [[x - r * 2, y - r * 2], [x + r * 2, y + r * 2]])
    cv.close()
  }
  out('monster/ch8-starbeast.svg', cv)
}

// ── 宗门合围 · 结丹期凶兽（狻猊）──
{
  const cv = new Canvas()
  cv.open('a-pulse'); cv.ellipse(88, 80, 92, 74, `fill="${cv.rad(C.fire2, 0.38)}"`); cv.close()
  quadruped(cv, { body: C.jade0, belly: C.jade1, dark: C.ink2, mane: C.gold1, accent: C.gold3, tail: 'whip', head: 'lion', marks: 'fire' })
  out('monster/jiedan-beast.svg', cv)
}
