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
  cv.path('M112 306q8 -4 16 0L138 420h-32z', `fill="#e7f6f0" fill-opacity=".9"`)
  for (const dx of [-8, -3, 2, 7]) cv.path(`M${120 + dx * 0.4} 310L${120 + dx} 416`, `stroke="#fff" stroke-opacity=".7" stroke-width="1" stroke-dasharray="10 4"`)
  for (const y of [350, 386]) cv.path(`M108 ${y}q14 -6 28 0`, `fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"`)
  mist(cv, 60, 400, 140, 22, 0.6)
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
  // 河：从后山左侧瀑布落下，沿左岸流出画面（与 3D 场景 homeLayout 一致，建筑都不压河道）
  const riverL = [[112, 420], [92, 520], [66, 640], [50, 760], [28, 880], [0, 1000], [-30, 1090]]
  const riverR = [[136, 420], [122, 526], [98, 648], [84, 770], [64, 892], [38, 1014], [10, 1110]]
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
  for (const [x, y, r] of [[128, 540, 6], [58, 660, 5], [96, 760, 6], [30, 900, 7]]) {
    cv.path(`M${x - r} ${y}Q${x - r} ${y - r * 0.9} ${x} ${y - r}Q${x + r} ${y - r * 0.8} ${x + r} ${y}Z`, `fill="${C.stone2}" stroke="${C.line}" stroke-opacity=".6" stroke-width=".8"`)
    cv.path(`M${x - r * 0.5} ${y - r * 0.7}q${r * 0.4} -0.3 ${r * 0.8} 0`, `fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"`)
    cv.path(`M${x - r - 3} ${y + 1}q${r + 3} 3 ${r * 2 + 6} 0`, `fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"`)
  }
  for (const [x, y] of [[140, 520], [110, 640], [96, 800], [70, 910], [16, 780]]) {
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
  cv.path('M310 1210C306 1060 316 900 312 760C310 640 318 560 324 480', `fill="none" stroke="#3a4a36" stroke-opacity=".35" stroke-width="40" stroke-linecap="round"`)
  flagstones([[310, 1200], [308, 1060], [314, 900], [312, 760], [316, 640], [324, 490]], 30, 38)
  flagstones([[310, 1040], [250, 1050], [200, 1060]], 12, 10)
  flagstones([[310, 1040], [380, 1046], [430, 1052]], 12, 10)
  flagstones([[312, 820], [250, 818], [190, 822]], 12, 10)
  flagstones([[312, 830], [380, 828], [430, 836]], 12, 10)
  flagstones([[314, 650], [260, 654], [220, 660]], 12, 8)
  flagstones([[314, 640], [380, 646], [440, 660]], 12, 8)
  // 草叶与野花（避开建筑落点）
  seed = 11
  const avoid = (x, y) => [[0.34, 0.44], [0.76, 0.7], [0.75, 0.45], [0.29, 0.55], [0.54, 0.39], [0.8, 0.56], [0.76, 0.88], [0.52, 0.52], [0.25, 0.68], [0.27, 0.88]].some(([bx, by]) => Math.abs(x - bx * W) < 64 && y < by * H + 6 && y > by * H - 120)
  for (let i = 0; i < 420; i++) {
    const x = rnd() * W, y = 450 + rnd() * 750
    if (avoid(x, y)) continue
    const c = rnd() > 0.55 ? '#a8cf82' : rnd() > 0.5 ? '#2f4f3a' : '#6f9c5c'
    cv.path(`M${f(x)} ${f(y)}q-1 -4 -3 -7m3 7q0 -5 1 -9m-1 9q2 -3 4 -6`, `fill="none" stroke="${c}" stroke-opacity=".75" stroke-width=".9" stroke-linecap="round"`)
    if (rnd() > 0.93) { const pc = [C.red3, C.gold3, '#f4efe0', C.purple3][Math.floor(rnd() * 4)]; for (let k = 0; k < 4; k++) cv.circle(x + Math.cos(k * 1.57) * 1.4, y - 8 + Math.sin(k * 1.57) * 1.4, 1.1, `fill="${pc}"`); cv.circle(x, y - 8, 0.8, `fill="${C.gold2}"`) }
  }
  // 边缘松与灌木
  for (const [x, y, sc] of [[190, 470, 0.9], [576, 540, 1.4], [585, 700, 1.5], [420, 470, 0.8], [440, 1000, 1], [590, 930, 1.5], [150, 1180, 1.6], [470, 1180, 1.2], [260, 760, 0.9]]) pineOn(x, y, sc)
  for (const [x, y, sc] of [[250, 600, 1], [400, 760, 1], [560, 1140, 1.2], [360, 1180, 1.1]]) { const g = new Canvas(); bush(g, 0, 0, sc, [C.grass1, C.grass2, C.grass3, rnd() > 0.5 ? C.red3 : undefined]); cv.embed(g, x, y) }
  // 石灯
  for (const [x, y] of [[292, 500], [356, 500]]) {
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
  // 地形与 3D 沙盘（src/ui/world/WarfrontWorld.ts）一致：北境群山护住坠星堡、迷雾关夹在两山垭口、
  // 望月灵泉临湖、赤铁矿岭为赭红岩丘、青萝药圃为梯田。坐标用地图百分比 ×10.24。
  const M = v => v * 10.24
  seed = 23
  const hills = [[34, 6, 90, false], [66, 5, 100, false], [50, 10, 80, false], [5, 48, 90, false], [33, 43, 60, false], [30, 62, 50, false], [80, 85, 60, true], [66, 88, 44, true], [76, 74, 40, true], [95, 50, 80, false]]
  for (const [hx, hy, r, red] of hills) {
    const offs = Array.from({ length: 10 }, () => 0.75 + rnd() * 0.5)
    for (let k = 5; k >= 1; k--) {
      const rr = r * k / 5
      const pts = offs.map((o, i) => { const a = i / offs.length * Math.PI * 2; return [M(hx) + Math.cos(a) * rr * o, M(hy) + Math.sin(a) * rr * o * 0.8] })
      cv.path(smooth(pts), `fill="${k === 1 ? (red ? '#8a4a36' : '#4a7a6c') : 'none'}" fill-opacity=".45" stroke="${red ? '#e7a07a' : '#8fd9c8'}" stroke-opacity="${0.1 + (5 - k) * 0.035}" stroke-width="1.4"`)
    }
  }
  const mountain = (x, y, s, red = false) => {
    const st = red ? '#e7a07a' : '#8fd9c8'
    cv.path(`M${x - 22 * s} ${y}L${x - 8 * s} ${y - 20 * s}L${x} ${y - 10 * s}L${x + 10 * s} ${y - 28 * s}L${x + 26 * s} ${y}Z`, `fill="${red ? '#3a2420' : '#1b2e30'}" stroke="${st}" stroke-opacity=".6" stroke-width="1.6" stroke-linejoin="round"`)
    cv.path(`M${x + 10 * s} ${y - 28 * s}L${x + 16 * s} ${y}M${x - 8 * s} ${y - 20 * s}L${x - 4 * s} ${y}`, `stroke="${st}" stroke-opacity=".3" stroke-width="1.2"`)
  }
  for (const [x, y, sc] of [[30, 8, 1.6], [40, 5, 1.2], [62, 6, 1.8], [72, 9, 1.2], [4, 44, 1.4], [8, 56, 1.1], [34, 42, 1.1], [31, 62, 0.9], [96, 46, 1.3], [96, 60, 1]]) mountain(M(x), M(y), sc)
  for (const [x, y, sc] of [[80, 86, 1.3], [66, 89, 1], [77, 74, 0.9]]) mountain(M(x), M(y), sc, true)
  // 药圃梯田
  for (let i = 0; i < 7; i++) cv.path(`M${M(70)} ${M(46 + i * 2)}Q${M(78)} ${M(44.5 + i * 2)} ${M(87)} ${M(46.5 + i * 2)}`, `fill="none" stroke="${i % 2 ? '#b9d98f' : '#e0d08a'}" stroke-opacity=".45" stroke-width="7"`)
  // 溪流汇入望月湖
  const stream = [[12, 4], [13, 20], [11, 36], [12, 50], [15, 63], [21, 74], [26, 81]].map(([x, y]) => [M(x), M(y)])
  cv.path(smooth(stream, false), `fill="none" stroke="#0e1a20" stroke-width="16" stroke-linecap="round" stroke-opacity=".6"`)
  cv.path(smooth(stream, false), `fill="none" stroke="#5fa6a0" stroke-width="9" stroke-linecap="round" stroke-opacity=".8"`)
  cv.circle(M(27), M(83), M(7.5), `fill="#3f8a86" fill-opacity=".85" stroke="#8fd9c8" stroke-opacity=".6" stroke-width="2"`)
  for (let i = 0; i < 4; i++) cv.path(`M${M(22 + i * 2.4)} ${M(81 + i * 1.4)}q12 -5 24 0`, `fill="none" stroke="#cfeee4" stroke-opacity=".5" stroke-width="1.6"`)
  // 林点：与 3D 松林同位置
  for (const [gx, gy, rad, n] of [[36, 24, 7, 30], [64, 24, 7, 30], [40, 66, 6, 22], [60, 64, 6, 22], [90, 36, 6, 20], [8, 84, 6, 18], [88, 96, 6, 18], [14, 96, 6, 16], [22, 30, 5, 16]]) {
    for (let i = 0; i < n; i++) cv.circle(M(gx + (rnd() - 0.5) * rad * 2), M(gy + (rnd() - 0.5) * rad * 2), 2.4 + rnd() * 2.4, `fill="#6f9c6a" fill-opacity="${f(0.3 + rnd() * 0.35)}"`)
  }
  // 我方营地
  for (const dx of [-24, 0, 24]) cv.path(`M${M(50) + dx - 9} ${M(95)}l9 -14 9 14z`, `fill="#e2d5b6" fill-opacity=".8" stroke="#d8b168" stroke-opacity=".6"`)
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

// ── 3D 场景用的公告板贴图：由 three.js 作为 Sprite 贴在地形上 ──
{
  const g = new Canvas(); pine(g, 0, 0, 1.6); save('scene/pine.svg', g.toString(2))
  const g2 = new Canvas(); pine(g2, 0, 0, 1.6, true); save('scene/pine-dark.svg', g2.toString(2))
  const g3 = new Canvas(); bush(g3, 0, 0, 1.6, [C.grass1, C.grass2, C.grass3, C.red3]); save('scene/bush.svg', g3.toString(2))
  const g4 = new Canvas(); bush(g4, 0, 0, 1.6); save('scene/bush-plain.svg', g4.toString(2))
  const g5 = new Canvas(); crane(g5, 30, 30, 2); save('scene/crane.svg', g5.toString(2))
  const g6 = new Canvas(); cloud(g6, 10, 30, 2.4, 0.95); save('scene/cloud.svg', g6.toString(2))
}
