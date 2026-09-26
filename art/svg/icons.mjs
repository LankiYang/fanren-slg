// 资源图标 / 道具 / 底部页签图标：小尺寸也要一眼可辨，所以轮廓粗、层次少、固定 64 画布。
import { C, Canvas, save, glow, lin } from './lib.mjs'

const L = `stroke="${C.line}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`
const icon = (draw) => { const cv = new Canvas(); draw(cv); return cv.toString(0, [0, 0, 64, 64]) }

// ── 资源 ──
save('icon/lingshi.svg', icon(cv => {
  cv.def(glow('g', C.jade3, 0.7))
  cv.circle(32, 34, 28, 'fill="url(#g)"')
  cv.path('M32 6L50 20L46 48L32 58L18 48L14 20Z', `fill="${C.blue3}" ${L}`)
  cv.path('M32 6L40 22L32 58L24 22Z', `fill="${C.jade4}"`)
  cv.path('M14 20L24 22L18 48ZM50 20L40 22L46 48Z', `fill="${C.blue2}"`)
  cv.path('M24 22H40', `stroke="${C.line}" stroke-width="1.4" stroke-opacity=".5"`)
  cv.path('M32 6L50 20L46 48L32 58L18 48L14 20Z', `fill="none" ${L}`)
  cv.path('M27 14l-3 6', `stroke="#fff" stroke-width="2.6" stroke-linecap="round"`)
}))
save('icon/lingqi.svg', icon(cv => {
  cv.def(glow('g', C.jade2, 0.6))
  cv.circle(32, 32, 30, 'fill="url(#g)"')
  // 祥云卷：两股相抱的灵气
  const swirl = (d, w, c) => cv.path(d, `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"`)
  const a = 'M10 38C8 22 22 10 36 12C48 14 54 26 46 34C40 40 30 36 32 29C33 25 38 25 39 28'
  const b = 'M54 26C56 42 42 54 28 52C16 50 10 38 18 30C24 24 34 28 32 35C31 39 26 39 25 36'
  for (const d of [a, b]) swirl(d, 8, C.line)
  swirl(a, 5, C.jade3); swirl(b, 5, C.jade2)
  swirl(a, 1.4, '#fff'); 
}))
save('icon/lingyao.svg', icon(cv => {
  cv.path('M32 58C30 48 33 40 32 30', `fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"`)
  cv.path('M32 58C30 48 33 40 32 30', `fill="none" stroke="${C.grass2}" stroke-width="2.4" stroke-linecap="round"`)
  cv.path('M32 36C20 38 10 30 8 18C20 16 30 24 32 36Z', `fill="${C.grass3}" ${L}`)
  cv.path('M32 36C44 38 54 30 56 18C44 16 34 24 32 36Z', `fill="${C.grass2}" ${L}`)
  cv.path('M32 32C24 26 24 14 32 6C40 14 40 26 32 32Z', `fill="${C.jade2}" ${L}`)
  cv.path('M12 20Q22 24 30 34M52 20Q42 24 34 34M32 10V28', `fill="none" stroke="${C.grass4}" stroke-width="1.4" stroke-opacity=".8"`)
  for (const [x, y] of [[24, 48], [40, 50], [32, 44]]) cv.circle(x, y, 4.2, `fill="${C.red2}" ${L}`)
  cv.circle(23, 47, 1.3, 'fill="#fff" fill-opacity=".8"')
}))
save('icon/kuanglingcai.svg', icon(cv => {
  cv.def(glow('g', C.fire2, 0.6))
  cv.circle(32, 36, 28, 'fill="url(#g)"')
  cv.path('M10 44L16 22L34 12L52 20L56 42L40 56L20 54Z', `fill="${C.stone1}" ${L}`)
  cv.path('M16 22L34 12L52 20L36 30Z', `fill="${C.stone2}"`)
  cv.path('M36 30L52 20L56 42L40 56Z', `fill="${C.stone0}"`)
  cv.path('M10 44L16 22L34 12L52 20L56 42L40 56L20 54Z', `fill="none" ${L}`)
  cv.path('M20 30L28 36L24 46M36 30L42 40L50 38M30 20L38 24', `fill="none" stroke="${C.fire2}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`)
  cv.path('M20 30L28 36L24 46M36 30L42 40L50 38M30 20L38 24', `fill="none" stroke="${C.fire3}" stroke-width="1.2" stroke-linecap="round"`)
}))

// ── 丹药：青玉浅碟 + 丹丸 ──
function pill(name, c0, c1, c2) {
  save(`item/${name}.svg`, icon(cv => {
    cv.def(glow('g', c1, 0.75))
    cv.ellipse(32, 46, 26, 9, `fill="${C.jade0}" ${L}`)
    cv.path('M6 44Q32 64 58 44', `fill="${C.jade1}" ${L}`)
    cv.ellipse(32, 44, 22, 6.5, `fill="${C.jade0}"`)
    cv.circle(32, 30, 22, 'fill="url(#g)"')
    cv.circle(32, 32, 13, `fill="${c1}" ${L}`)
    cv.path('M22 36a13 13 0 0 0 20 4a13 13 0 0 1 -20 -4z', `fill="${c0}"`)
    cv.path('M28 30q4 -5 8 0t-6 5', `fill="none" stroke="${c2}" stroke-width="1.8" stroke-linecap="round"`)
    cv.circle(27, 26, 3, 'fill="#fff" fill-opacity=".75"')
  }))
}
pill('pill-qi', C.jade1, C.jade2, C.jade4)
pill('pill-body', C.red0, C.red2, C.gold3)
pill('pill-mind', C.purple0, C.purple2, C.purple3)

save('item/scroll.svg', icon(cv => {
  cv.path('M14 14H50V50H14Z', `fill="${C.paper1}" ${L}`)
  for (let i = 0; i < 5; i++) cv.path(`M${22 + i * 5} 20V${44 - (i % 2) * 6}`, `stroke="${C.ink3}" stroke-width="2" stroke-linecap="round" stroke-opacity=".7"`)
  cv.path('M40 38h6v6h-6z', `fill="${C.red2}"`)
  for (const y of [10, 50]) {
    cv.path(`M8 ${y}H56`, `stroke="${C.line}" stroke-width="9" stroke-linecap="round"`)
    cv.path(`M8 ${y}H56`, `stroke="${C.wood2}" stroke-width="5" stroke-linecap="round"`)
    cv.circle(6, y, 3.4, `fill="${C.gold2}" ${L}`); cv.circle(58, y, 3.4, `fill="${C.gold2}" ${L}`)
  }
}))

save('item/artifact-sword.svg', icon(cv => {
  cv.def(lin('blade', [[0, C.jade4], [1, C.jade2]], 1, 0))
  cv.def(glow('g', C.jade2, 0.55))
  cv.circle(34, 30, 28, 'fill="url(#g)"')
  cv.path('M54 8L58 6L56 10L24 42L20 38Z', `fill="url(#blade)" ${L}`)
  cv.path('M56 8L22 40', `stroke="#fff" stroke-width="1.2" stroke-opacity=".8"`)
  cv.path('M16 34L28 46', `stroke="${C.line}" stroke-width="7" stroke-linecap="round"`)
  cv.path('M16 34L28 46', `stroke="${C.gold2}" stroke-width="3.6" stroke-linecap="round"`)
  cv.path('M20 42L10 52', `stroke="${C.line}" stroke-width="6" stroke-linecap="round"`)
  cv.path('M20 42L10 52', `stroke="${C.wood1}" stroke-width="3" stroke-linecap="round"`)
  cv.circle(9, 53, 3, `fill="${C.gold2}" ${L}`)
  cv.path('M9 56q-2 4 -6 6M9 56q2 4 0 7', `fill="none" stroke="${C.red2}" stroke-width="2.2" stroke-linecap="round"`)
}))

save('item/artifact-shield.svg', icon(cv => {
  const oct = (r) => Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2 + Math.PI / 8; return [32 + Math.cos(a) * r, 32 + Math.sin(a) * r] })
  cv.poly(oct(28), C.gold1, L)
  cv.poly(oct(21), C.wood1, L)
  cv.circle(32, 32, 12, `fill="${C.blue1}" ${L}`)
  cv.path('M32 20a12 12 0 0 1 0 24a6 6 0 0 1 0 -12a6 6 0 0 0 0 -12z', `fill="${C.paper2}"`)
  cv.circle(32, 26, 2, `fill="${C.blue1}"`); cv.circle(32, 38, 2, `fill="${C.paper2}"`)
  // 八卦爻
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = 32 + Math.cos(a) * 16.5, y = 32 + Math.sin(a) * 16.5
    const deg = a * 180 / Math.PI + 90
    cv.add(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(0)})"><path d="M-4 -2h8M-4 0.6h${i % 2 ? 3 : 8}${i % 2 ? 'M1 0.6h3' : ''}M-4 3.2h8" stroke="${C.gold3}" stroke-width="1.4"/></g>`)
  }
  cv.path('M14 12l5 3', `stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-opacity=".6"`)
}))

save('item/artifact-rope.svg', icon(cv => {
  cv.def(glow('g', C.gold3, 0.55))
  cv.circle(32, 32, 30, 'fill="url(#g)"')
  for (const [r, w] of [[22, 7], [15, 6]]) {
    cv.circle(32, 32, r, `fill="none" stroke="${C.line}" stroke-width="${w + 3}"`)
    cv.circle(32, 32, r, `fill="none" stroke="${C.gold2}" stroke-width="${w}"`)
    cv.circle(32, 32, r, `fill="none" stroke="${C.gold0}" stroke-width="${w - 2}" stroke-dasharray="3 3"`)
  }
  cv.path('M46 46l10 10', `stroke="${C.line}" stroke-width="7" stroke-linecap="round"`)
  cv.path('M46 46l10 10', `stroke="${C.gold2}" stroke-width="4" stroke-linecap="round"`)
  for (const [x, y, r] of [[10, 18, -20], [52, 16, 18]]) cv.add(`<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-5 -9h10v18h-10z" fill="${C.paper2}" ${L}/><path d="M0 -5v10M-2.5 -2h5" stroke="${C.red1}" stroke-width="1.6" stroke-linecap="round"/></g>`)
}))

// ── 底部页签（金色剪影，激活态由 CSS 提亮）──
const tab = (name, draw) => save(`ui/${name}.svg`, icon(cv => { draw(cv) }))
const G = `fill="${C.gold2}" stroke="${C.gold0}" stroke-width="1.6" stroke-linejoin="round"`
const GD = `fill="${C.gold0}"`
tab('tab-home', cv => {
  // 洞府：山门 + 月洞
  cv.path('M6 26Q20 24 32 10Q44 24 58 26L54 30H10Z', G)
  cv.path('M12 30H52V56H12Z', G)
  cv.path('M32 36a10 10 0 0 1 10 10V56H22V46a10 10 0 0 1 10 -10z', GD)
  cv.path('M8 56H56', `stroke="${C.gold0}" stroke-width="3" stroke-linecap="round"`)
})
tab('tab-army', cv => {
  // 历练：交叉双剑
  for (const s of [1, -1]) {
    cv.add(`<g transform="translate(32 32) scale(${s} 1)"><path d="M-20 -22L-16 -24L14 10L10 14Z" ${G}/><path d="M6 8L16 18M8 18L18 8" stroke="${C.gold0}" stroke-width="4" stroke-linecap="round"/><path d="M16 18l6 6" stroke="${C.gold2}" stroke-width="5" stroke-linecap="round"/></g>`)
  }
})
tab('tab-stage', cv => {
  // 战区：城楼 + 令旗
  cv.path('M6 58V38H58V58Z', G)
  cv.path('M24 58V48a8 8 0 0 1 16 0V58Z', GD)
  cv.path('M6 38V34H12V38M18 38V34H24V38M40 38V34H46V38M52 38V34H58V38', G)
  cv.path('M16 30Q26 28 32 20Q38 28 48 30L45 34H19Z', G)
  cv.path('M22 34H42V38H22Z', GD)
  cv.path('M46 22V4', `stroke="${C.gold0}" stroke-width="3" stroke-linecap="round"`)
  cv.path('M47 5L60 9L47 15Z', `fill="${C.red2}" stroke="${C.gold0}" stroke-width="1.6" stroke-linejoin="round"`)
})
tab('tab-sect', cv => {
  // 宗门：重檐殿
  cv.path('M10 20Q24 18 32 8Q40 18 54 20L50 24H14Z', G)
  cv.path('M18 24H46V30H18Z', GD)
  cv.path('M4 36Q20 34 32 26Q44 34 60 36L56 40H8Z', G)
  cv.path('M12 40H52V56H12Z', G)
  for (const x of [18, 26, 38, 46]) cv.path(`M${x} 42V56`, `stroke="${C.gold0}" stroke-width="2.4"`)
  cv.path('M28 44H36V56H28Z', GD)
})
tab('tab-cultivator', cv => {
  cv.circle(32, 18, 9, G)
  cv.path('M24 10q8 -8 16 0', `fill="none" stroke="${C.gold0}" stroke-width="3"`)
  cv.path('M12 58Q14 34 32 30Q50 34 52 58Z', G)
  cv.path('M32 30L26 58M32 30L38 58', `stroke="${C.gold0}" stroke-width="2"`)
})
