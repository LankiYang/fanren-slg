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

/** 祥云：三卷云头 + 拖尾，金线勾边 */
function cloud(cv, x, y, s = 1, o = 0.9) {
  const S = v => f(v * s)
  const d = `M${x} ${y}c${S(-4)} ${S(-10)} ${S(8)} ${S(-16)} ${S(14)} ${S(-8)}c${S(2)} ${S(-12)} ${S(20)} ${S(-12)} ${S(20)} ${S(0)}c${S(8)} ${S(-6)} ${S(18)} ${S(0)} ${S(14)} ${S(8)}h${S(40)}q${S(6)} 0 ${S(6)} ${S(4)}h${S(-100)}q${S(-4)} 0 ${S(6)} ${S(-4)}z`
  cv.path(d, `fill="#f4efe0" fill-opacity="${o}" stroke="${C.gold2}" stroke-opacity=".7" stroke-width="1"`, [[x - 6 * s, y - 20 * s], [x + 70 * s, y + 6 * s]])
  cv.path(`M${f(x + 4 * s)} ${f(y - 2 * s)}c${S(0)} ${S(-5)} ${S(6)} ${S(-7)} ${S(8)} ${S(-3)}M${f(x + 20 * s)} ${f(y - 4 * s)}c${S(1)} ${S(-6)} ${S(9)} ${S(-6)} ${S(10)} ${S(-1)}`, `fill="none" stroke="${C.gold2}" stroke-opacity=".6" stroke-width=".9"`)
}
/** 仙鹤：白身、黑翎、丹顶，展翅剪影 */
function crane(cv, x, y, s = 1, flip = 1) {
  const g = new Canvas()
  g.path('M0 0C8 -2 16 -1 24 2C18 3 10 3 0 0Z', `fill="#f7f3ea" stroke="${C.line}" stroke-width=".6"`)
  g.path('M6 0C4 -10 -2 -18 -14 -22C-6 -14 -2 -8 2 0Z', `fill="#f7f3ea" stroke="${C.line}" stroke-width=".6"`)
  g.path('M-14 -22C-8 -19 -4 -16 -2 -12L-8 -17Z', `fill="${C.line}"`)
  g.path('M12 0C14 -9 22 -16 34 -18C26 -10 20 -4 16 1Z', `fill="#f7f3ea" stroke="${C.line}" stroke-width=".6"`)
  g.path('M34 -18C28 -16 24 -12 22 -8L27 -13Z', `fill="${C.line}"`)
  g.path('M0 0Q-6 -2 -12 1', `fill="none" stroke="#f7f3ea" stroke-width="1.6" stroke-linecap="round"`)
  g.path('M0 0Q-6 -2 -12 1', `fill="none" stroke="${C.line}" stroke-width=".5"`)
  g.circle(-12, 1, 1.2, `fill="${C.red2}"`)
  g.path('M-12 1l-5 1.2', `stroke="${C.gold1}" stroke-width=".8"`)
  g.path('M24 2l10 3M24 2l10 1', `stroke="${C.line}" stroke-width=".6"`)
  cv.add(`<g transform="translate(${x} ${y}) scale(${f(s * flip)} ${f(s)})">${g.parts.join('')}</g>`, [[x - 20 * s, y - 25 * s], [x + 40 * s, y + 8 * s]])
}
/** 远景小塔（剪影） */
function farPagoda(cv, x, y, s = 1, col = '#5d8584') {
  for (let i = 0; i < 5; i++) {
    const w = (10 - i * 1.4) * s, yy = y - i * 7 * s
    cv.path(`M${f(x - w)} ${f(yy)}Q${f(x)} ${f(yy - 3 * s)} ${f(x + w)} ${f(yy)}L${f(x + w * 0.6)} ${f(yy - 2.4 * s)}H${f(x - w * 0.6)}Z`, `fill="${col}"`)
    cv.path(`M${f(x - w * 0.55)} ${f(yy - 2.4 * s)}h${f(w * 1.1)}v${f(-4.6 * s)}h${f(-w * 1.1)}z`, `fill="${col}" fill-opacity=".85"`)
  }
  cv.path(`M${f(x)} ${f(y - 35 * s)}v${f(-6 * s)}`, `stroke="${col}" stroke-width="${f(1.2 * s)}"`)
}

function valley() {
  const cv = new Canvas()
  const W = 600, H = 1200
  seed = 7
  cv.def(lin('sky', [[0, '#132433'], [0.3, '#28505c'], [0.58, '#6f9993'], [0.8, '#d9c393'], [1, '#f0dcae']]))
  cv.def(lin('far', [[0, '#8fb5ae'], [1, '#c3d3c4']]))
  cv.def(lin('far2', [[0, '#6c9d97'], [1, '#a8c2b4']]))
  cv.def(lin('mid', [[0, C.jade2], [0.5, '#3f8a82'], [1, '#6f9c8a']]))
  cv.def(lin('ground', [[0, '#7ea46f'], [0.2, '#5f8a5a'], [0.6, '#44694a'], [1, '#243d33']]))
  cv.def(lin('river', [[0, '#d8f2ea'], [0.4, '#8fcfc0'], [1, '#4f9a96']]))
  cv.def(glow('sun', '#fff3cf', 0.9))
  cv.def(lin('vig', [[0, '#0b1219', 0], [0.75, '#0b1219', 0], [1, '#0b1219', 0.55]]))

  cv.path(`M0 0H${W}V${H}H0Z`, 'fill="url(#sky)"')
  // 天光：日轮 + 日晕 + 光束
  cv.circle(440, 250, 150, 'fill="url(#sun)"')
  for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.36; cv.path(`M440 250L${f(440 + Math.cos(a) * 420)} ${f(250 + Math.sin(a) * 420)}L${f(440 + Math.cos(a + 0.08) * 420)} ${f(250 + Math.sin(a + 0.08) * 420)}Z`, `fill="#fff5d6" fill-opacity=".06"`) }
  cv.circle(440, 250, 36, 'fill="#fff6dc" fill-opacity=".95"')
  cv.circle(440, 250, 42, 'fill="none" stroke="#fff6dc" stroke-opacity=".4" stroke-width="2"')
  // 高空云带
  for (const [x, y, sc, o] of [[40, 120, 1.3, 0.55], [300, 90, 1, 0.45], [470, 170, 1.1, 0.5], [120, 230, 0.8, 0.4]]) cloud(cv, x, y, sc, o)
  crane(cv, 170, 190, 0.9); crane(cv, 215, 212, 0.65); crane(cv, 250, 176, 0.5)

  // 远山：三层，最远层带宝塔剪影与皴线
  ridge(cv, 250, [[20, 300], [80, 222], [130, 280], [190, 190], [250, 262], [300, 232], [360, 286], [420, 200], [500, 276], [560, 226], [620, 290]], 'url(#far)', 'fill-opacity=".9"')
  farPagoda(cv, 190, 198, 0.7, '#7aa19c')
  for (let i = 0; i < 40; i++) { const x = rnd() * W, y = 240 + rnd() * 70; cv.path(`M${f(x)} ${f(y)}q2 6 0 12`, `fill="none" stroke="#5e8883" stroke-opacity=".35" stroke-width=".8"`) }
  mist(cv, 20, 296, 240, 20, 0.5); mist(cv, 320, 312, 260, 20, 0.45)
  ridge(cv, 280, [[-10, 330], [30, 270], [70, 300], [120, 256], [170, 318], [230, 290], [290, 330], [350, 300], [410, 262], [470, 314], [540, 280], [610, 320]], 'url(#far2)')
  for (let i = 0; i < 18; i++) { const x = 10 + i * 34 + rnd() * 10, y = 300 + rnd() * 26; cv.path(`M${f(x)} ${f(y)}l3 -8 3 8z`, `fill="#4f7f78" fill-opacity=".6"`) }
  ridge(cv, 300, [[-10, 340], [40, 262], [90, 320], [150, 292], [210, 350], [270, 312], [330, 360], [400, 302], [450, 256], [510, 322], [610, 276]], 'url(#mid)')
  // 中景瀑布（分三叠）
  cv.path('M292 316q8 -4 16 0L318 420h-32z', `fill="#e7f6f0" fill-opacity=".9"`)
  for (const dx of [-8, -3, 2, 7]) cv.path(`M${300 + dx * 0.4} 320L${300 + dx} 416`, `stroke="#fff" stroke-opacity=".7" stroke-width="1" stroke-dasharray="10 4"`)
  for (const y of [350, 386]) cv.path(`M288 ${y}q14 -6 28 0`, `fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"`)
  mist(cv, 240, 400, 140, 22, 0.6)
  // 近山夹峙（青绿山石）
  crag(cv, 30, 470, 230, [[-60, -260], [-10, -196], [52, -132]], 'bgL', { seed: 31 })
  crag(cv, 580, 460, 250, [[-64, -124], [0, -214], [62, -290]], 'bgR', { seed: 37 })
  const pineOn = (x, y, sc, dark = false) => { const g = new Canvas(); pine(g, 0, 0, sc, dark); cv.embed(g, x, y) }
  pineOn(60, 300, 0.7, true); pineOn(530, 250, 0.8, true); pineOn(560, 330, 0.6, true); pineOn(14, 360, 0.7, true)
  mist(cv, -40, 420, 280, 26, 0.55); mist(cv, 360, 432, 300, 24, 0.55)

  // 山谷地面
  cv.path(`M0 430C120 400 220 420 300 412C390 404 500 420 ${W} 432V${H}H0Z`, 'fill="url(#ground)"')
  // 远处梯田：一层层带亮边的田埂
  for (let i = 0; i < 7; i++) {
    const y = 440 + i * 13
    for (const [x0, x1] of [[34 + i * 6, 262], [346 - i * 4, 574 - i * 5]]) {
      cv.path(`M${x0} ${y}C${x0 + 70} ${y - 8} ${x1 - 60} ${y + 6} ${x1} ${y - 2}`, `fill="none" stroke="#dbeaa8" stroke-opacity="${f(0.45 - i * 0.05)}" stroke-width="1.4"`)
      cv.path(`M${x0} ${y + 2}C${x0 + 70} ${y - 6} ${x1 - 60} ${y + 8} ${x1} ${y}`, `fill="none" stroke="#2f5a3a" stroke-opacity="${f(0.35 - i * 0.04)}" stroke-width="1"`)
    }
  }
  // 远处小村：几户青瓦
  for (const [x, y] of [[96, 452], [118, 458], [480, 448], [506, 455]]) {
    cv.path(`M${x - 8} ${y}h16v-6h-16z`, `fill="#e3dac2"`)
    cv.path(`M${x - 11} ${y - 5}Q${x} ${y - 8} ${x + 11} ${y - 5}L${x + 6} ${y - 11}H${x - 6}Z`, `fill="#3d5a62"`)
    cv.path(`M${x - 2} ${y}v-4h4v4`, `fill="#5a3d2c"`)
  }

  // 河：从瀑布下流出，绕开建筑落点，从左侧流出画面
  const riverL = [[292, 420], [360, 500], [352, 590], [250, 660], [160, 780], [70, 850], [-20, 880]]
  const riverR = [[312, 420], [396, 506], [388, 610], [282, 690], [196, 810], [104, 890], [-20, 930]]
  const rp = [...riverL, ...riverR.slice().reverse()]
  const bank = [...riverL.map(([x, y]) => [x - 5, y - 2]), ...riverR.slice().reverse().map(([x, y]) => [x + 5, y + 3])]
  cv.path(smooth(bank, true), `fill="#b9a67c" stroke="#6e5c3c" stroke-opacity=".5" stroke-width="1"`)
  cv.path(smooth(rp, true), `fill="url(#river)" stroke="#2c5a58" stroke-width="1.4"`)
  for (let i = 0; i < 26; i++) {
    const t = rnd(), k = Math.min(riverL.length - 2, Math.floor(t * (riverL.length - 1)))
    const u = t * (riverL.length - 1) - k, a = riverL[k], b2 = riverL[k + 1], c = riverR[k], d = riverR[k + 1]
    const x = (a[0] + (b2[0] - a[0]) * u) * 0.5 + (c[0] + (d[0] - c[0]) * u) * 0.5, y = (a[1] + (b2[1] - a[1]) * u) * 0.5 + (c[1] + (d[1] - c[1]) * u) * 0.5
    const w = 8 + rnd() * 16
    cv.path(`M${f(x - w / 2)} ${f(y)}q${f(w / 4)} -3 ${f(w / 2)} 0t${f(w / 2)} 0`, `fill="none" stroke="#fff" stroke-opacity="${f(0.35 + rnd() * 0.35)}" stroke-width="1.1" stroke-linecap="round"`)
  }
  // 河石与芦苇
  for (const [x, y, r] of [[372, 560, 7], [338, 640, 5], [214, 748, 6], [120, 842, 7], [300, 600, 4]]) {
    cv.path(`M${x - r} ${y}Q${x - r} ${y - r * 0.9} ${x} ${y - r}Q${x + r} ${y - r * 0.8} ${x + r} ${y}Z`, `fill="${C.stone2}" stroke="${C.line}" stroke-opacity=".6" stroke-width=".8"`)
    cv.path(`M${x - r * 0.5} ${y - r * 0.7}q${r * 0.4} -0.3 ${r * 0.8} 0`, `fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"`)
    cv.path(`M${x - r - 3} ${y + 1}q${r + 3} 3 ${r * 2 + 6} 0`, `fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"`)
  }
  for (const [x, y] of [[404, 520], [396, 630], [292, 710], [200, 830], [60, 900], [150, 776]]) {
    for (let k = 0; k < 5; k++) cv.path(`M${x + k * 2} ${y}q${-2 + k} -8 ${-1 + k * 1.5} -${14 + k * 2}`, `fill="none" stroke="${k % 2 ? '#6f8e4a' : '#a9b86a'}" stroke-width="1" stroke-linecap="round"`)
    cv.path(`M${x + 3} ${y - 16}q1 -3 0 -6`, `stroke="#8a6a3c" stroke-width="2.2" stroke-linecap="round"`)
  }
  // 石板路：中轴通向洞府 + 两侧分叉，逐块铺石
  const flagstones = (pts, width, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), k = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))), u = t * (pts.length - 1) - k
      const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u
      const offs = width > 20 ? (i % 2 ? [-9, 6] : [-5, 10]) : [0]
      for (const off of offs) {
        const rx = (width > 20 ? 8 : 6) + rnd() * 2.4, ry = 4 + rnd() * 1.4, cx = x + off + (rnd() - 0.5) * 3
        const pts = Array.from({ length: 7 }, (_, k) => { const a = k / 7 * Math.PI * 2 + rnd() * 0.4; return [cx + Math.cos(a) * rx * (0.85 + rnd() * 0.2), y + Math.sin(a) * ry * (0.85 + rnd() * 0.2)] })
        cv.path(smooth(pts, true), `fill="${rnd() > 0.5 ? '#cdbf9c' : '#bfb08a'}" stroke="#6e5c3c" stroke-opacity=".55" stroke-width=".8"`)
        cv.path(`M${f(cx - rx * 0.5)} ${f(y - ry * 0.5)}q${f(rx * 0.4)} -1 ${f(rx * 0.8)} 0`, `fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".7"`)
      }
    }
  }
  cv.path('M300 1210C296 1100 310 990 300 890C292 850 300 820 300 800', `fill="none" stroke="#3a4a36" stroke-opacity=".35" stroke-width="40" stroke-linecap="round"`)
  flagstones([[300, 1200], [298, 1100], [306, 1000], [300, 900], [298, 850], [300, 806]], 30, 30)
  flagstones([[300, 960], [240, 972], [190, 990], [150, 1008]], 12, 12)
  flagstones([[300, 960], [360, 972], [410, 990], [450, 1008]], 12, 12)
  flagstones([[292, 724], [240, 726], [190, 742], [140, 760]], 12, 12)
  flagstones([[308, 740], [360, 732], [420, 744], [470, 770]], 12, 12)
  // 拱桥：石拱 + 栏板
  cv.path('M252 700Q282 664 312 694L312 700Q282 676 252 706Z', `fill="${C.stone3}" stroke="${C.line}" stroke-opacity=".7" stroke-width="1"`)
  cv.path('M252 700Q282 664 312 694', `fill="none" stroke="${C.stone4}" stroke-width="1.2"`)
  for (let i = 0; i <= 6; i++) { const t = i / 6, x = 252 + 60 * t, y = (1 - t) * (1 - t) * 700 + 2 * (1 - t) * t * 664 + t * t * 694; cv.path(`M${f(x)} ${f(y)}v-6`, `stroke="${C.stone4}" stroke-width="1.6"`) }
  cv.path('M252 694Q282 658 312 688', `fill="none" stroke="${C.stone4}" stroke-width="1.4"`)
  cv.path('M262 702a8 6 0 0 1 16 0', `fill="${C.ink}" fill-opacity=".5"`)

  // 草叶与野花（避开建筑落点）
  seed = 11
  const avoid = (x, y) => [[0.21, 0.6], [0.79, 0.61], [0.5, 0.66], [0.22, 0.8], [0.78, 0.81], [0.5, 0.87], [0.23, 0.99], [0.77, 1], [0.2, 0.42], [0.8, 0.44]].some(([bx, by]) => Math.abs(x - bx * W) < 64 && y < by * H + 6 && y > by * H - 120)
  for (let i = 0; i < 420; i++) {
    const x = rnd() * W, y = 450 + rnd() * 750
    if (avoid(x, y)) continue
    const c = rnd() > 0.55 ? '#a8cf82' : rnd() > 0.5 ? '#2f4f3a' : '#6f9c5c'
    cv.path(`M${f(x)} ${f(y)}q-1 -4 -3 -7m3 7q0 -5 1 -9m-1 9q2 -3 4 -6`, `fill="none" stroke="${c}" stroke-opacity=".75" stroke-width=".9" stroke-linecap="round"`)
    if (rnd() > 0.93) { const pc = [C.red3, C.gold3, '#f4efe0', C.purple3][Math.floor(rnd() * 4)]; for (let k = 0; k < 4; k++) cv.circle(x + Math.cos(k * 1.57) * 1.4, y - 8 + Math.sin(k * 1.57) * 1.4, 1.1, `fill="${pc}"`); cv.circle(x, y - 8, 0.8, `fill="${C.gold2}"`) }
  }
  // 边缘松与灌木
  for (const [x, y, sc] of [[26, 520, 1.3], [576, 540, 1.4], [18, 700, 1.5], [585, 700, 1.5], [210, 520, 0.9], [400, 470, 0.8], [470, 900, 1], [590, 930, 1.5], [12, 1060, 1.6], [396, 1180, 1.2]]) pineOn(x, y, sc)
  for (const [x, y, sc] of [[380, 560, 1], [224, 620, 1], [420, 860, 1.1], [180, 900, 1], [560, 1140, 1.2], [240, 1180, 1.1], [120, 1160, 1]]) { const g = new Canvas(); bush(g, 0, 0, sc, [C.grass1, C.grass2, C.grass3, rnd() > 0.5 ? C.red3 : undefined]); cv.embed(g, x, y) }
  // 石灯
  for (const [x, y] of [[270, 822], [330, 822]]) {
    cv.path(`M${x - 6} ${y}h12v-3h-12z`, `fill="${C.stone2}" ${STROKE}`)
    cv.path(`M${x - 2.4} ${y - 3}h4.8v-11h-4.8z`, `fill="${C.stone3}" ${STROKE}`)
    cv.path(`M${x - 5} ${y - 14}h10v-8h-10z`, `fill="${C.stone3}" ${STROKE}`)
    cv.path(`M${x - 2.4} ${y - 15.5}h4.8v-5h-4.8z`, `fill="${C.fire3}"`)
    cv.circle(x, y - 18, 10, `fill="url(#sun)" fill-opacity=".7"`)
    cv.path(`M${x - 8} ${y - 22}Q${x} ${y - 26} ${x + 8} ${y - 22}L${x} ${y - 30}Z`, `fill="${C.stone3}" ${STROKE}`)
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
