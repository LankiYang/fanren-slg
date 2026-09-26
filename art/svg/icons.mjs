// 资源图标 / 道具 / 底部页签图标（精细版）：固定 64 画布；刻面 + 渐变 + 高光 + 纹饰，小尺寸仍保留清晰外轮廓。
import { C, Canvas, save, dk, lt } from './lib.mjs'

const L = `stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`
const T = `stroke="${C.line}" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round"`
const icon = draw => { const cv = new Canvas(); draw(cv); return cv.toString(0, [0, 0, 64, 64]) }
const V = (cv, c, k = 0.3) => cv.grad([[0, lt(c, k)], [0.55, c], [1, dk(c, k)]])
const sparkle = (cv, x, y, r, c = '#fff') => cv.path(`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`, `fill="${c}"`)

// ── 资源 ──
save('icon/lingshi.svg', icon(cv => {
  cv.circle(32, 34, 30, `fill="${cv.rad(C.jade3, 0.6)}"`)
  cv.path('M32 5L50 19L46 48L32 59L18 48L14 19Z', `fill="${C.blue2}" ${L}`)
  cv.path('M32 5L40 21L32 59L24 21Z', `fill="${cv.grad([[0, '#fff'], [0.5, C.jade4], [1, C.blue3]])}"`)
  cv.path('M14 19L24 21L18 48Z', `fill="${cv.grad([[0, C.blue3], [1, C.blue1]])}"`)
  cv.path('M50 19L40 21L46 48Z', `fill="${cv.grad([[0, C.blue2], [1, C.blue0]])}"`)
  cv.path('M18 48L32 59L24 21ZM46 48L32 59L40 21Z', `fill="#000" fill-opacity=".12"`)
  cv.path('M32 5L24 21H40ZM24 21L32 59M40 21L32 59M14 19L24 21M50 19L40 21', `fill="none" stroke="${C.line}" stroke-opacity=".45" stroke-width=".7"`)
  cv.path('M32 5L50 19L46 48L32 59L18 48L14 19Z', `fill="none" ${L}`)
  cv.path('M27 12l-3 6M22 26l-2 14', `stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-opacity=".85"`)
  cv.path('M30 30q2 4 0 10q4 -3 6 -2', `fill="none" stroke="${C.jade2}" stroke-opacity=".6" stroke-width=".8"`)
  sparkle(cv, 50, 10, 4.4); sparkle(cv, 12, 46, 3, C.jade4)
}))
save('icon/lingqi.svg', icon(cv => {
  cv.circle(32, 32, 31, `fill="${cv.rad(C.jade2, 0.55)}"`)
  const swirl = (d, w, c) => cv.path(d, `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"`)
  const a = 'M9 38C7 22 21 9 36 11C48 13 55 25 47 34C41 40 30 36 32 29C33 25 38 25 39 28'
  const b = 'M55 26C57 42 43 55 28 53C16 51 9 39 17 30C23 24 34 28 32 35C31 39 26 39 25 36'
  for (const d of [a, b]) swirl(d, 8.4, C.line)
  swirl(a, 6, cv.grad([[0, C.jade4], [1, C.jade2]], 'h')); swirl(b, 6, cv.grad([[0, C.jade1], [1, C.jade3]], 'h'))
  swirl(a, 1.2, '#fff'); swirl(b, 0.8, C.jade4)
  for (const [x, y, r] of [[12, 14, 2.6], [52, 50, 2.2], [50, 12, 1.6], [14, 52, 1.4]]) sparkle(cv, x, y, r * 1.6, C.jade4)
}))
save('icon/lingyao.svg', icon(cv => {
  cv.circle(32, 34, 28, `fill="${cv.rad(C.grass4, 0.35)}"`)
  // 参根
  cv.path('M31 44C28 50 26 56 22 60M33 44C35 51 39 56 44 59M32 44C32 52 31 57 32 62', `fill="none" stroke="${C.line}" stroke-width="3.4" stroke-linecap="round"`)
  cv.path('M31 44C28 50 26 56 22 60M33 44C35 51 39 56 44 59M32 44C32 52 31 57 32 62', `fill="none" stroke="${C.paper0}" stroke-width="1.8" stroke-linecap="round"`)
  cv.path('M26 36Q32 48 38 36Q38 46 32 48Q26 46 26 36Z', `fill="${V(cv, C.paper1)}" ${T}`)
  cv.path('M32 40C31 32 33 26 32 20', `fill="none" stroke="${C.grass1}" stroke-width="2" stroke-linecap="round"`)
  // 叶
  const leaf = (d, c, vein) => { cv.path(d, `fill="${V(cv, c, 0.25)}" ${L}`); cv.path(vein, `fill="none" stroke="${C.grass4}" stroke-width=".8" stroke-opacity=".85"`) }
  leaf('M32 30C20 32 10 24 8 12C20 10 30 18 32 30Z', C.grass3, 'M10 13Q22 18 30 29M16 14l2 5M22 17l1 5')
  leaf('M32 30C44 32 54 24 56 12C44 10 34 18 32 30Z', C.grass2, 'M54 13Q42 18 34 29M48 14l-2 5M42 17l-1 5')
  leaf('M32 26C24 20 24 8 32 2C40 8 40 20 32 26Z', C.jade2, 'M32 4V24M29 10l3 4 3 -4')
  for (const [x, y] of [[23, 36], [41, 36], [36, 30]]) { cv.circle(x, y, 3.6, `fill="${cv.grad([[0, C.red3], [1, C.red0]])}" ${T}`); cv.circle(x - 1, y - 1.2, 1, 'fill="#fff" fill-opacity=".85"') }
  sparkle(cv, 50, 44, 3.4, C.gold4)
}))
save('icon/kuanglingcai.svg', icon(cv => {
  cv.circle(32, 36, 29, `fill="${cv.rad(C.fire2, 0.55)}"`)
  cv.path('M9 44L15 21L34 11L53 19L57 42L40 57L19 55Z', `fill="${C.stone1}" ${L}`)
  cv.path('M15 21L34 11L53 19L36 30Z', `fill="${cv.grad([[0, C.stone4], [1, C.stone2]])}"`)
  cv.path('M9 44L15 21L36 30L40 57L19 55Z', `fill="${cv.grad([[0, C.stone2], [1, C.stone1]])}"`)
  cv.path('M36 30L53 19L57 42L40 57Z', `fill="${cv.grad([[0, C.stone1], [1, C.stone0]])}"`)
  cv.path('M15 21L36 30L53 19M36 30L40 57', `fill="none" stroke="${C.line}" stroke-opacity=".45" stroke-width=".8"`)
  cv.path('M9 44L15 21L34 11L53 19L57 42L40 57L19 55Z', `fill="none" ${L}`)
  // 灵矿脉（发光裂纹）
  const vein = 'M18 30L27 36L23 47M36 30L43 40L51 38M29 19L38 23M27 36L33 42'
  cv.path(vein, `fill="none" stroke="${C.fire1}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"`)
  cv.path(vein, `fill="none" stroke="${C.fire3}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"`)
  cv.path(vein, `fill="none" stroke="#fff" stroke-width=".5" stroke-linecap="round"`)
  // 晶芽
  cv.path('M44 22l3 -9 3 9z', `fill="${cv.grad([[0, '#fff'], [1, C.gold2]])}" ${T}`)
  cv.path('M20 22l2 -6 2 6z', `fill="${cv.grad([[0, '#fff'], [1, C.gold2]])}" ${T}`)
  cv.path('M20 14l3 -3', `stroke="#fff" stroke-width="1" stroke-linecap="round"`)
  sparkle(cv, 52, 10, 3.6, C.gold4)
}))

// ── 丹药：青玉莲纹浅碟 + 丹丸（丹纹 + 云气）──
function pill(name, c0, c1, c2) {
  save(`item/${name}.svg`, icon(cv => {
    cv.circle(32, 30, 26, `fill="${cv.rad(c1, 0.65)}"`)
    cv.ellipse(32, 47, 27, 9.4, `fill="${C.jade0}" ${L}`)
    cv.path('M5 45Q32 66 59 45', `fill="${cv.grad([[0, C.jade2], [1, C.jade0]])}" ${L}`)
    for (let i = 0; i < 7; i++) { const x = 12 + i * 6.6; cv.path(`M${x} ${50 + Math.sin(i / 6 * Math.PI) * 3}q3 -4 6 0`, `fill="none" stroke="${C.jade3}" stroke-opacity=".7" stroke-width=".8"`) }
    cv.ellipse(32, 45, 23, 6.6, `fill="${cv.grad([[0, C.jade1], [1, C.jade0]])}"`)
    cv.ellipse(32, 45, 23, 6.6, `fill="none" stroke="${C.gold2}" stroke-width=".8"`)
    cv.ellipse(32, 44.6, 12, 3, 'fill="#000" fill-opacity=".3"')
    cv.circle(32, 32, 13.5, `fill="${cv.grad([[0, lt(c1, 0.35)], [0.6, c1], [1, c0]])}" ${L}`)
    cv.path('M20 36a13 13 0 0 0 22 5a13 13 0 0 1 -22 -5z', `fill="${c0}" fill-opacity=".6"`)
    cv.path('M26 31q3 -5 7 -1t7 -1M24 36q4 -3 8 0t8 0', `fill="none" stroke="${c2}" stroke-width="1.1" stroke-linecap="round"`)
    cv.circle(32, 32, 13.5, `fill="none" stroke="${C.gold3}" stroke-opacity=".5" stroke-width=".6"`)
    cv.ellipse(26.5, 26, 3.4, 2.2, 'fill="#fff" fill-opacity=".8"')
    cv.circle(37, 24, 1, 'fill="#fff" fill-opacity=".7"')
    for (const [x, y] of [[14, 20], [50, 16], [52, 30]]) sparkle(cv, x, y, 3, lt(c1, 0.6))
  }))
}
pill('pill-qi', C.jade1, C.jade2, C.jade4)
pill('pill-body', C.red0, C.red2, C.gold3)
pill('pill-mind', C.purple0, C.purple2, C.purple3)

save('item/scroll.svg', icon(cv => {
  cv.path('M13 14H51V50H13Z', `fill="${cv.grad([[0, C.paper2], [1, C.paper0]])}" ${L}`)
  cv.path('M15 16H49V48H15Z', `fill="none" stroke="${C.gold1}" stroke-width=".8"`)
  for (let i = 0; i < 5; i++) { const x = 21 + i * 5; for (let k = 0; k < 4; k++) cv.path(`M${x} ${20 + k * 6}v${3 + (k + i) % 3}`, `stroke="${C.ink2}" stroke-width="1.6" stroke-linecap="round" stroke-opacity=".8"`) }
  cv.path('M40 40h6v6h-6z', `fill="${C.red2}" ${T}`)
  cv.path('M41.4 41.6h3.2M43 41.6v3.2M41.4 44.6h3.2', `stroke="${C.paper2}" stroke-width=".6"`)
  for (const y of [10, 52]) {
    cv.path(`M8 ${y}H56`, `stroke="${C.line}" stroke-width="8.6" stroke-linecap="round"`)
    cv.path(`M8 ${y}H56`, `stroke="${cv.grad([[0, C.wood3], [0.5, C.wood2], [1, C.wood0]])}" stroke-width="6" stroke-linecap="round"`)
    cv.path(`M9 ${y - 1.4}H55`, `stroke="#fff" stroke-opacity=".3" stroke-width="1"`)
    for (const x of [5, 59]) { cv.circle(x, y, 3.8, `fill="${V(cv, C.gold2)}" ${L}`); cv.circle(x, y, 1.2, `fill="${C.gold0}"`) }
  }
  cv.path('M20 52q-2 6 -6 8M24 52q0 6 -2 9', `fill="none" stroke="${C.red2}" stroke-width="1.4" stroke-linecap="round"`)
}))

save('item/artifact-sword.svg', icon(cv => {
  cv.circle(34, 30, 29, `fill="${cv.rad(C.jade2, 0.5)}"`)
  for (let i = 0; i < 3; i++) cv.path(`M${50 - i * 8} ${8 + i * 8}l-${10 + i * 4} ${10 + i * 4}`, `stroke="${C.jade3}" stroke-opacity="${0.5 - i * 0.12}" stroke-width="1.2" stroke-linecap="round"`)
  cv.path('M55 7L59 5L57 9L24 42L20 38Z', `fill="${cv.grad([[0, '#fff'], [0.4, C.jade4], [1, C.jade2]], 'h')}" ${L}`)
  cv.path('M57 7L22 40', `stroke="${C.jade1}" stroke-width=".7"`)
  cv.path('M54 9L23 39', `stroke="#fff" stroke-width=".8" stroke-opacity=".9"`)
  for (const [x, y] of [[44, 21], [38, 27]]) cv.path(`M${x - 1.4} ${y}l1.4 -1.4 1.4 1.4 -1.4 1.4z`, `fill="${C.gold3}"`)
  cv.path('M15 33L29 47', `stroke="${C.line}" stroke-width="7" stroke-linecap="round"`)
  cv.path('M15 33L29 47', `stroke="${cv.grad([[0, C.gold3], [1, C.gold0]])}" stroke-width="4.4" stroke-linecap="round"`)
  cv.circle(22, 40, 2.4, `fill="${C.jade2}" ${T}`)
  cv.path('M20 42L10 52', `stroke="${C.line}" stroke-width="6" stroke-linecap="round"`)
  cv.path('M20 42L10 52', `stroke="${C.wood1}" stroke-width="3.6" stroke-linecap="round"`)
  cv.path('M18.4 43.6l-2 2M15.6 46.4l-2 2M12.8 49.2l-1.4 1.4', `stroke="${C.gold2}" stroke-width="1"`)
  cv.circle(9, 53, 3, `fill="${V(cv, C.gold2)}" ${T}`)
  cv.path('M9 56q-2 4 -6 6M9 56q2 4 0 7M9 56q-.5 4 -3 7', `fill="none" stroke="${C.red2}" stroke-width="1.6" stroke-linecap="round"`)
}))

save('item/artifact-shield.svg', icon(cv => {
  const oct = r => Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2 + Math.PI / 8; return [32 + Math.cos(a) * r, 32 + Math.sin(a) * r] })
  cv.circle(32, 32, 31, `fill="${cv.rad(C.gold3, 0.45)}"`)
  cv.poly(oct(29), cv.grad([[0, C.gold3], [0.5, C.gold1], [1, C.gold0]]), L)
  cv.poly(oct(26), 'none', `stroke="${C.gold4}" stroke-opacity=".6" stroke-width=".7"`)
  cv.poly(oct(21.5), cv.grad([[0, C.wood2], [1, C.wood0]]), T)
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = 32 + Math.cos(a) * 16.8, y = 32 + Math.sin(a) * 16.8
    const deg = a * 180 / Math.PI + 90, br = i % 3
    cv.add(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(0)})"><path d="M-4 -2h${br === 0 ? 8 : 3}${br === 0 ? '' : 'M1 -2h3'}M-4 .6h${br === 1 ? 3 : 8}${br === 1 ? 'M1 .6h3' : ''}M-4 3.2h${br === 2 ? 3 : 8}${br === 2 ? 'M1 3.2h3' : ''}" stroke="${C.gold3}" stroke-width="1.3"/></g>`)
  }
  cv.circle(32, 32, 11.5, `fill="${C.blue0}" ${T}`)
  cv.path('M32 20.5a11.5 11.5 0 0 1 0 23a5.75 5.75 0 0 1 0 -11.5a5.75 5.75 0 0 0 0 -11.5z', `fill="${C.paper2}"`)
  cv.circle(32, 26.25, 1.9, `fill="${C.blue0}"`); cv.circle(32, 37.75, 1.9, `fill="${C.paper2}"`)
  cv.circle(32, 32, 11.5, `fill="none" stroke="${C.gold3}" stroke-width=".8"`)
  for (const [x, y] of oct(27.5)) cv.circle(x, y, 1, `fill="${C.gold4}" stroke="${C.line}" stroke-width=".3"`)
  cv.path('M14 13l6 3', `stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-opacity=".7"`)
}))

save('item/artifact-rope.svg', icon(cv => {
  cv.circle(32, 32, 30, `fill="${cv.rad(C.gold3, 0.5)}"`)
  for (const [r, w] of [[22, 7], [15, 6]]) {
    cv.circle(32, 32, r, `fill="none" stroke="${C.line}" stroke-width="${w + 2.4}"`)
    cv.circle(32, 32, r, `fill="none" stroke="${C.gold1}" stroke-width="${w}"`)
    cv.circle(32, 32, r, `fill="none" stroke="${C.gold3}" stroke-width="${w * 0.45}" stroke-dasharray="2.4 2.4"`)
    cv.circle(32, 32, r, `fill="none" stroke="${C.gold0}" stroke-width="${w * 0.2}" stroke-dasharray="2.4 2.4" stroke-dashoffset="2.4"`)
  }
  cv.path('M46 46l10 10', `stroke="${C.line}" stroke-width="7" stroke-linecap="round"`)
  cv.path('M46 46l10 10', `stroke="${C.gold2}" stroke-width="4.4" stroke-linecap="round"`)
  cv.path('M47 47l9 9', `stroke="${C.gold0}" stroke-width="1.4" stroke-dasharray="2 2"`)
  cv.circle(32, 32, 6, `fill="${cv.rad(C.gold4, 0.7)}"`)
  for (const [x, y, r] of [[10, 18, -20], [53, 15, 18]]) cv.add(`<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-5 -9h10v18h-10z" fill="${C.paper2}" ${T}/><path d="M-4 -8h8v16h-8z" fill="none" stroke="${C.red1}" stroke-width=".5"/><path d="M0 -6v12M-2.4 -3h4.8M-2.4 1h4.8" stroke="${C.red1}" stroke-width="1" stroke-linecap="round"/></g>`)
  sparkle(cv, 52, 38, 3, '#fff')
}))

// ── 底部页签（鎏金剪影 + 刻线，激活态由 CSS 提亮）──
const tab = (name, draw) => save(`ui/${name}.svg`, icon(cv => draw(cv)))
const Gf = cv => cv.grad([[0, C.gold4], [0.45, C.gold2], [1, C.gold0]])
const G = cv => `fill="${Gf(cv)}" stroke="${C.gold0}" stroke-width="1.4" stroke-linejoin="round"`
const GD = `fill="${dk(C.gold0, 0.2)}"`
const LINE = `stroke="${C.gold0}" stroke-width="1" stroke-linecap="round"`
tab('tab-home', cv => {
  cv.path('M4 27Q20 25 32 10Q44 25 60 27L55 31H9Z', G(cv))
  cv.path('M10 27Q22 25 32 15Q42 25 54 27', `fill="none" ${LINE}`)
  cv.path('M12 31H52V57H12Z', G(cv))
  for (const x of [16, 48]) cv.path(`M${x} 33V57`, `stroke="${C.gold0}" stroke-width="2"`)
  cv.path('M32 36a10 10 0 0 1 10 10V57H22V46a10 10 0 0 1 10 -10z', GD)
  cv.path('M32 40a6 6 0 0 1 6 6', `fill="none" stroke="${C.gold3}" stroke-width=".8"`)
  cv.path('M6 58H58', `stroke="${C.gold0}" stroke-width="3" stroke-linecap="round"`)
  cv.circle(32, 8, 2, G(cv))
})
tab('tab-army', cv => {
  for (const s of [1, -1]) cv.add(`<g transform="translate(32 32) scale(${s} 1)"><path d="M-21 -23L-17 -25L14 9L10 13Z" ${G(cv)}/><path d="M-18 -22L12 11" ${LINE}/><path d="M5 7L16 18M7 18L18 7" stroke="${C.gold0}" stroke-width="4.4" stroke-linecap="round"/><path d="M16 18l7 7" stroke="${C.gold2}" stroke-width="5" stroke-linecap="round"/><path d="M16 18l7 7" stroke="${C.gold0}" stroke-width="1" stroke-dasharray="1.4 1.4"/><circle cx="24" cy="26" r="2.4" fill="${C.red2}" stroke="${C.gold0}" stroke-width=".8"/></g>`)
})
tab('tab-stage', cv => {
  cv.path('M6 58V38H58V58Z', G(cv))
  for (const y of [44, 50]) cv.path(`M6 ${y}H58`, `stroke="${C.gold0}" stroke-width=".7" stroke-opacity=".7"`)
  cv.path('M24 58V48a8 8 0 0 1 16 0V58Z', GD)
  cv.path('M6 38V34H12V38M18 38V34H24V38M40 38V34H46V38M52 38V34H58V38', G(cv))
  cv.path('M15 30Q26 28 32 19Q38 28 49 30L46 34H18Z', G(cv))
  cv.path('M21 34H43V38H21Z', GD)
  cv.path('M46 22V3', `stroke="${C.gold0}" stroke-width="2.6" stroke-linecap="round"`)
  cv.path('M47 4L61 8.4L47 15Z', `fill="${cv.grad([[0, C.red3], [1, C.red1]])}" stroke="${C.gold0}" stroke-width="1.2" stroke-linejoin="round"`)
})
tab('tab-sect', cv => {
  cv.path('M10 20Q24 18 32 7Q40 18 54 20L50 24H14Z', G(cv))
  cv.path('M18 24H46V30H18Z', GD)
  cv.path('M26 25.4h12v3.4h-12z', `fill="${C.gold3}"`)
  cv.path('M3 37Q20 35 32 26Q44 35 61 37L56 41H8Z', G(cv))
  cv.path('M9 37Q22 35 32 29Q42 35 55 37', `fill="none" ${LINE}`)
  cv.path('M12 41H52V57H12Z', G(cv))
  for (const x of [18, 26, 38, 46]) cv.path(`M${x} 43V57`, `stroke="${C.gold0}" stroke-width="2.2"`)
  cv.path('M28 45H36V57H28Z', GD)
  cv.path('M8 58H56', `stroke="${C.gold0}" stroke-width="2.4" stroke-linecap="round"`)
})
tab('tab-cultivator', cv => {
  cv.circle(32, 18, 9, G(cv))
  cv.path('M24 10q8 -8 16 0', `fill="none" stroke="${C.gold0}" stroke-width="3"`)
  cv.path('M12 58Q14 34 32 30Q50 34 52 58Z', G(cv))
  cv.path('M32 30L26 58M32 30L38 58', `stroke="${C.gold0}" stroke-width="2"`)
})
