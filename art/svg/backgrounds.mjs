// 背景：洞府山谷（竖版，建筑按 data.ts 的百分比落点避让）+ 战区舆图
import { C, Canvas, save, f, lin, glow, pine, bush, crag, STROKE } from './lib.mjs'

let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

/** 平滑闭合曲线（Catmull-Rom → 贝塞尔） */
function smooth(pts, close = true) {
  const n = pts.length
  const p = i => pts[close ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2)
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return close ? d + 'Z' : d
}

function ridge(cv, y0, peaks, fill, extra = '') {
  // 远山剪影：一串峰顶连成平滑轮廓，底边拉到画面外
  const pts = [[-40, y0 + 200], ...peaks, [640, y0 + 200]]
  cv.path(smooth(pts, false) + `L640 ${y0 + 400}L-40 ${y0 + 400}Z`, `fill="${fill}" ${extra}`)
}

function mist(cv, x, y, w, h, o = 0.35) {
  cv.path(`M${f(x)} ${f(y)}h${f(w)}a${f(h / 2)} ${f(h / 2)} 0 0 1 0 ${f(h)}h${f(-w)}a${f(h / 2)} ${f(h / 2)} 0 0 1 0 ${f(-h)}z`, `fill="#eef4ee" fill-opacity="${o}"`)
}

function valley() {
  const cv = new Canvas()
  const W = 600, H = 1200
  cv.def(lin('sky', [[0, '#16283a'], [0.45, '#35606a'], [0.8, '#c9b48a'], [1, '#e9d3a2']]))
  cv.def(lin('far', [[0, '#7fa9a6'], [1, '#b9cdbf']]))
  cv.def(lin('mid', [[0, C.jade2], [0.5, '#3f8a82'], [1, '#6f9c8a']]))
  cv.def(lin('near', [[0, C.jade1], [0.6, C.blue1], [1, '#35584f']]))
  cv.def(lin('ground', [[0, '#6f9a6a'], [0.25, '#557f55'], [0.7, '#3d6446'], [1, '#243d33']]))
  cv.def(lin('river', [[0, '#cfeee4'], [0.5, '#8fcfc0'], [1, '#5fa6a0']]))
  cv.def(glow('sun', '#fff3cf', 0.9))
  cv.def(lin('vig', [[0, '#0b1219', 0], [0.75, '#0b1219', 0], [1, '#0b1219', 0.55]]))

  cv.path(`M0 0H${W}V${H}H0Z`, 'fill="url(#sky)"')
  cv.circle(440, 250, 110, 'fill="url(#sun)"')
  cv.circle(440, 250, 34, 'fill="#fff6dc" fill-opacity=".9"')
  // 飞鸟
  for (const [x, y, s] of [[150, 170, 1], [178, 186, 0.8], [204, 162, 0.7]]) cv.path(`M${x} ${y}q${6 * s} ${-5 * s} ${12 * s} 0q${6 * s} ${-5 * s} ${12 * s} 0`, `fill="none" stroke="${C.ink2}" stroke-width="1.6" stroke-linecap="round"`)

  // 远山三层，由淡到浓
  ridge(cv, 250, [[20, 300], [80, 230], [130, 280], [190, 200], [250, 270], [300, 240], [360, 290], [420, 210], [500, 280], [560, 230], [620, 290]], 'url(#far)', 'fill-opacity=".85"')
  mist(cv, 40, 300, 220, 22, 0.45); mist(cv, 330, 320, 240, 20, 0.4)
  ridge(cv, 300, [[-10, 330], [40, 250], [90, 320], [150, 290], [210, 350], [270, 310], [330, 360], [400, 300], [450, 250], [510, 320], [610, 270]], 'url(#mid)')
  // 中景瀑布
  cv.path('M292 316q8 -4 16 0L318 420h-32z', `fill="#e7f6f0" fill-opacity=".85"`)
  cv.path('M298 320L296 416M306 320L310 416', `stroke="#fff" stroke-opacity=".7" stroke-width="1.4"`)
  mist(cv, 250, 400, 120, 20, 0.55)
  // 近山两侧夹峙：用青绿山石，把山谷「框」起来
  crag(cv, 30, 470, 220, [[-60, -250], [-10, -190], [50, -130]], 'bgL')
  crag(cv, 580, 460, 240, [[-60, -120], [0, -210], [60, -280]], 'bgR')
  mist(cv, -40, 420, 260, 26, 0.5); mist(cv, 380, 430, 280, 24, 0.5)

  // 山谷地面
  cv.path(`M0 430C120 400 220 420 300 412C390 404 500 420 ${W} 432V${H}H0Z`, 'fill="url(#ground)"')
  // 远处梯田纹理
  for (let i = 0; i < 6; i++) {
    const y = 440 + i * 14
    cv.path(`M${40 + i * 6} ${y}C150 ${y - 8} 220 ${y + 6} 260 ${y - 2}M${350 - i * 4} ${y + 2}C420 ${y - 6} 500 ${y + 6} ${570 - i * 5} ${y - 2}`, `fill="none" stroke="#b9d98f" stroke-opacity="${0.35 - i * 0.04}" stroke-width="1.4"`)
  }

  // 河：从瀑布下流出，绕开建筑落点，从左侧流出画面
  const riverL = [[292, 420], [360, 500], [352, 590], [250, 660], [160, 780], [70, 850], [-20, 880]]
  const riverR = [[312, 420], [396, 506], [388, 610], [282, 690], [196, 810], [104, 890], [-20, 930]]
  const rp = [...riverL, ...riverR.slice().reverse()]
  cv.path(smooth(rp, true), `fill="url(#river)" stroke="#2c5a58" stroke-width="2"`)
  for (const [x, y, w] of [[330, 520, 26], [320, 610, 30], [230, 720, 34], [130, 830, 30], [60, 885, 26]]) cv.path(`M${x - w / 2} ${y}q${w / 4} -4 ${w / 2} 0t${w / 2} 0`, `fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"`)
  // 石板路：从画面底部中轴通向洞府，再分叉到两侧建筑排
  const road = `M300 1210C296 1100 310 990 300 890C292 850 300 820 300 800`
  cv.path(road, `fill="none" stroke="#2a3a30" stroke-width="36" stroke-linecap="round" stroke-opacity=".35"`)
  cv.path(road, `fill="none" stroke="#c9b996" stroke-width="28" stroke-linecap="round"`)
  cv.path(road, `fill="none" stroke="#a8966f" stroke-width="28" stroke-dasharray="3 16" stroke-linecap="butt"`)
  for (const d of ['M300 960C240 970 190 990 150 1010', 'M300 960C360 970 410 990 450 1010', 'M300 720C250 720 190 740 140 760', 'M300 740C360 730 420 740 470 770']) {
    cv.path(d, `fill="none" stroke="#c9b996" stroke-opacity=".75" stroke-width="16" stroke-linecap="round"`)
  }
  // 小拱桥
  cv.path('M262 690q18 -22 40 -4', `fill="none" stroke="${C.line}" stroke-width="9" stroke-linecap="round"`)
  cv.path('M262 690q18 -22 40 -4', `fill="none" stroke="${C.red2}" stroke-width="5" stroke-linecap="round"`)

  // 草丛点簇（避开建筑中心）
  seed = 11
  for (let i = 0; i < 140; i++) {
    const x = rnd() * W, y = 460 + rnd() * 740
    const nearCol = [[0.21, 0.6], [0.79, 0.61], [0.5, 0.66], [0.22, 0.8], [0.78, 0.81], [0.5, 0.87], [0.23, 0.99], [0.77, 1], [0.2, 0.42], [0.8, 0.44]].some(([bx, by]) => Math.abs(x - bx * W) < 60 && y < by * H && y > by * H - 110)
    if (nearCol) continue
    cv.path(`M${f(x)} ${f(y)}l-3 -7m3 7l0 -9m0 9l4 -7`, `fill="none" stroke="${rnd() > 0.5 ? '#9cc57a' : '#2f4f3a'}" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"`)
  }
  // 边缘松与灌木：只放在建筑落点之间的空档
  const trees = [[26, 520, 1.1], [576, 540, 1.2], [18, 700, 1.3], [585, 700, 1.3], [210, 520, 0.8], [400, 470, 0.7], [470, 900, 0.9], [590, 930, 1.3], [12, 1060, 1.4], [396, 1180, 1.1]]
  for (const [x, y, s] of trees) {
    const g = new Canvas(); pine(g, 0, 0, s)
    cv.add(`<g transform="translate(${x} ${y})">${g.parts.join('')}</g>`)
  }
  for (const [x, y, s] of [[380, 560, 0.9], [224, 620, 0.9], [420, 860, 1], [180, 900, 0.9], [560, 1140, 1.1], [240, 1180, 1]]) {
    const g = new Canvas(); bush(g, 0, 0, s)
    cv.add(`<g transform="translate(${x} ${y})">${g.parts.join('')}</g>`)
  }
  // 石灯与散石
  for (const [x, y] of [[270, 820], [330, 820]]) {
    cv.path(`M${x - 4} ${y}h8v-14h-8z`, `fill="${C.stone2}" ${STROKE}`)
    cv.path(`M${x - 7} ${y - 14}h14l-3 -8h-8z`, `fill="${C.stone3}" ${STROKE}`)
    cv.circle(x, y - 18, 2.6, `fill="${C.fire3}"`)
  }
  cv.path(`M0 0H${W}V${H}H0Z`, 'fill="url(#vig)"')
  return cv.toString(0, [0, 0, W, H])
}

// ── 战区舆图：墨色底 + 等高线 + 山形符号 + 河流 + 林点，像一张摊开的军事舆图 ──
function warmap() {
  const cv = new Canvas()
  const S = 1024
  cv.def(`<radialGradient id="land" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#34524e"/><stop offset=".6" stop-color="#253c3d"/><stop offset="1" stop-color="#15232a"/></radialGradient>`)
  cv.def(`<pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#d8b168" stroke-opacity=".08" stroke-width="1"/></pattern>`)
  cv.path(`M0 0H${S}V${S}H0Z`, 'fill="url(#land)"')
  cv.path(`M0 0H${S}V${S}H0Z`, 'fill="url(#grid)"')
  // 等高线：几组同心不规则环
  seed = 23
  const hills = [[210, 250, 150], [790, 230, 170], [180, 760, 140], [820, 790, 160], [520, 520, 110], [520, 130, 90]]
  for (const [hx, hy, r] of hills) {
    const offs = Array.from({ length: 10 }, () => 0.75 + rnd() * 0.5)
    for (let k = 5; k >= 1; k--) {
      const rr = r * k / 5
      const pts = offs.map((o, i) => { const a = i / offs.length * Math.PI * 2; return [hx + Math.cos(a) * rr * o, hy + Math.sin(a) * rr * o * 0.8] })
      cv.path(smooth(pts), `fill="${k === 1 ? '#4a7a6c' : 'none'}" fill-opacity=".35" stroke="#8fd9c8" stroke-opacity="${0.08 + (5 - k) * 0.03}" stroke-width="1.4"`)
    }
  }
  // 山形符号（舆图画法：一笔三峰）
  const mountain = (x, y, s) => {
    cv.path(`M${x - 22 * s} ${y}L${x - 8 * s} ${y - 20 * s}L${x} ${y - 10 * s}L${x + 10 * s} ${y - 28 * s}L${x + 26 * s} ${y}Z`, `fill="#1b2e30" stroke="#8fd9c8" stroke-opacity=".55" stroke-width="1.6" stroke-linejoin="round"`)
    cv.path(`M${x + 10 * s} ${y - 28 * s}L${x + 16 * s} ${y}M${x - 8 * s} ${y - 20 * s}L${x - 4 * s} ${y}`, `stroke="#8fd9c8" stroke-opacity=".3" stroke-width="1.2"`)
  }
  for (const [x, y, s] of [[170, 230, 1.6], [240, 270, 1.2], [790, 210, 1.8], [860, 260, 1.1], [730, 250, 1], [160, 760, 1.5], [220, 790, 1], [820, 780, 1.7], [880, 820, 1.1], [520, 110, 1.2], [60, 480, 1], [960, 520, 1.1]]) mountain(x, y, s)
  // 河流
  const river = 'M-20 420C120 440 240 400 360 470C470 535 560 520 640 470C760 400 880 460 1044 430'
  cv.path(river, `fill="none" stroke="#0e1a20" stroke-width="30" stroke-linecap="round" stroke-opacity=".6"`)
  cv.path(river, `fill="none" stroke="#5fa6a0" stroke-width="16" stroke-linecap="round" stroke-opacity=".75"`)
  cv.path(river, `fill="none" stroke="#cfeee4" stroke-width="2" stroke-dasharray="10 18" stroke-opacity=".5"`)
  const trib = 'M520 1044C510 900 560 780 520 640C505 590 540 540 560 515'
  cv.path(trib, `fill="none" stroke="#5fa6a0" stroke-width="9" stroke-linecap="round" stroke-opacity=".6"`)
  // 林点
  for (let i = 0; i < 260; i++) {
    const cx = [300, 700, 380, 660, 120, 900][i % 6] + (rnd() - 0.5) * 160, cy = [640, 640, 300, 330, 580, 600][i % 6] + (rnd() - 0.5) * 120
    cv.circle(cx, cy, 2 + rnd() * 2.5, `fill="#6f9c6a" fill-opacity="${0.25 + rnd() * 0.3}"`)
  }
  // 驿道（虚线）
  for (const d of ['M200 300C300 420 420 500 520 520', 'M800 280C700 400 620 480 520 520', 'M200 740C300 640 420 560 520 520', 'M820 780C720 660 620 580 520 520', 'M520 150C520 280 520 400 520 520']) {
    cv.path(d, `fill="none" stroke="#d8b168" stroke-opacity=".32" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"`)
  }
  // 纸边与四角描金
  cv.path(`M0 0H${S}V${S}H0Z`, `fill="none" stroke="#d8b168" stroke-opacity=".35" stroke-width="10"`)
  cv.path(`M18 18H${S - 18}V${S - 18}H18Z`, `fill="none" stroke="#d8b168" stroke-opacity=".25" stroke-width="2"`)
  for (const [x, y, sx, sy] of [[18, 18, 1, 1], [S - 18, 18, -1, 1], [18, S - 18, 1, -1], [S - 18, S - 18, -1, -1]]) {
    cv.path(`M${x} ${y + sy * 60}V${y}H${x + sx * 60}M${x + sx * 12} ${y + sy * 36}V${y + sy * 12}H${x + sx * 36}`, `fill="none" stroke="#d8b168" stroke-opacity=".6" stroke-width="3"`)
  }
  cv.def(`<radialGradient id="vg" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#0b1219" stop-opacity="0"/><stop offset="1" stop-color="#0b1219" stop-opacity=".7"/></radialGradient>`)
  cv.path(`M0 0H${S}V${S}H0Z`, 'fill="url(#vg)"')
  return cv.toString(0, [0, 0, S, S])
}

save('bg/main-valley.svg', valley())
save('bg/warfront-map.svg', warmap())
