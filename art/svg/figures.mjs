// 人物：修士 / 引导仙子 / 符修。统一「半 Q 版」比例（头身约 1:3.2），交领广袖，墨线描边。
import { C, Canvas, save, glow, lin } from './lib.mjs'

export const L = `stroke="${C.line}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`
const T = `stroke="${C.line}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`

/**
 * o: { robe:[亮,暗], trim, inner, sash, hair, female, longHair, beard, pose:'down'|'hold'|'point'|'cast'|'bow', prop(cv) }
 * 画布坐标：头心 (60,40)，脚底 y≈152
 */
export function figure(cv, o) {
  const [r1, r0] = o.robe
  cv.def(glow('aura', o.aura ?? C.jade2, 0.5))
  cv.ellipse(60, 153, 34, 6, 'fill="#000" fill-opacity=".28"')
  if (o.aura !== null) cv.ellipse(60, 100, 56, 64, 'fill="url(#aura)"')
  // 后发（长发垂到腰）
  if (o.longHair) cv.path('M42 38C36 70 38 96 44 112L76 112C82 96 84 70 78 38Z', `fill="${o.hair}" ${L}`)
  // 飘带（仙子）
  if (o.ribbon) {
    cv.path('M36 76C14 84 10 108 18 128C20 112 28 96 42 90Z', `fill="${o.ribbon}" ${L}`)
    cv.path('M84 76C106 84 110 108 102 128C100 112 92 96 78 90Z', `fill="${o.ribbon}" ${L}`)
  }
  // 下摆与袍身
  cv.path('M44 58C40 80 32 118 26 146Q60 154 94 146C88 118 80 80 76 58Z', `fill="${r1}" ${L}`)
  cv.path('M60 90C62 112 66 132 70 150Q84 148 94 146C88 118 82 92 78 72Z', `fill="${r0}" fill-opacity=".7"`)
  // 衣摆滚边
  cv.path('M26 146Q60 154 94 146', `fill="none" stroke="${o.trim}" stroke-width="3.4"`)
  cv.path('M26 146Q60 154 94 146', `fill="none" ${T}`)
  // 交领（右衽）
  cv.path('M50 56L60 84L70 56Z', `fill="${o.inner}" ${T}`)
  cv.path('M50 56L66 96', `fill="none" stroke="${o.trim}" stroke-width="3.2"`)
  cv.path('M70 56L60 80', `fill="none" stroke="${o.trim}" stroke-width="3.2"`)
  cv.path('M60 86L60 148', `fill="none" stroke="${o.trim}" stroke-width="2.4" stroke-opacity=".9"`)
  // 腰带 + 垂绦
  cv.path('M45 84Q60 90 75 84L76 93Q60 99 44 93Z', `fill="${o.sash}" ${T}`)
  cv.path('M64 94L60 122M66 94L70 118', `fill="none" stroke="${o.sash}" stroke-width="3" stroke-linecap="round"`)
  cv.circle(64, 124, 3.4, `fill="${C.jade3}" ${T}`)
  // 袖子与手
  sleeves(cv, o)
  // 颈 + 头
  cv.path('M55 50h10v8h-10z', `fill="${C.skin2}"`)
  cv.circle(60, 38, 17, `fill="${C.skin}" ${L}`)
  // 发型
  const H = `fill="${o.hair}" ${L}`
  if (o.female) {
    cv.path('M43 40C41 22 52 16 60 16C70 16 79 22 77 40C74 30 68 26 60 30C54 26 46 30 43 40Z', H)
    cv.circle(60, 14, 8, H)
    cv.path('M52 14C46 8 40 12 42 18M68 14C74 8 80 12 78 18', `fill="none" stroke="${o.hair}" stroke-width="5" stroke-linecap="round"`)
    cv.path('M66 10l12 -6', `stroke="${C.gold2}" stroke-width="2.2" stroke-linecap="round"`)
    cv.circle(79, 4, 2.6, `fill="${o.pin ?? C.jade3}" ${T}`)
    cv.path('M43 40C42 48 44 58 46 64M77 40C78 48 76 58 74 64', `fill="none" stroke="${o.hair}" stroke-width="4" stroke-linecap="round"`)
  } else {
    cv.path('M43 38C42 22 52 18 60 18C70 18 78 22 77 38C72 30 66 28 60 29C54 28 48 32 43 38Z', H)
    cv.circle(60, 15, 7.5, H)
    cv.path('M54 16Q53 6 60 5Q67 6 66 16Z', `fill="${o.crown ?? C.gold2}" ${T}`)
    cv.path('M57 8v6M63 8v6', `stroke="${C.gold0}" stroke-width="1.2"`)
    cv.path('M47 12L73 9', `stroke="${C.line}" stroke-width="3.6" stroke-linecap="round"`)
    cv.path('M47 12L73 9', `stroke="${C.gold3}" stroke-width="1.8" stroke-linecap="round"`)
    cv.path('M43 38C42 44 43 48 45 50M77 38C78 44 77 48 75 50', `fill="none" stroke="${o.hair}" stroke-width="3" stroke-linecap="round"`)
  }
  // 五官：细眉、杏眼、点唇 —— 小尺寸下只保留最必要的笔画
  cv.path('M50 35q4 -2 7 0M63 35q4 -2 7 0', `fill="none" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round"`)
  cv.path('M51 41q3 -2.6 6 0q-3 1.8 -6 0zM63 41q3 -2.6 6 0q-3 1.8 -6 0z', `fill="${C.line}"`)
  if (o.female) cv.path('M50 45h4M66 45h4', `stroke="${C.red3}" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"`)
  cv.path('M58 49q2 1.2 4 0', `fill="none" stroke="${C.red1}" stroke-width="1.6" stroke-linecap="round"`)
  if (o.beard) cv.path('M52 50Q60 62 68 50Q66 58 60 66Q54 58 52 50Z', `fill="${o.beard}" ${T}`)
  if (o.prop) o.prop(cv)
}

function sleeves(cv, o) {
  const [r1, r0] = o.robe
  const S = `fill="${r1}" ${L}`
  const hand = (x, y) => cv.circle(x, y, 4.6, `fill="${C.skin}" ${T}`)
  const pose = o.pose ?? 'down'
  // 左袖（画面左）
  if (pose === 'bow') {
    cv.path('M46 60C34 64 22 70 14 70L12 80C24 82 36 78 48 72Z', S)
    hand(12, 74)
  } else {
    cv.path('M46 60C36 72 30 96 28 118Q38 124 48 118C48 100 50 84 52 76Z', S)
    cv.path('M28 118Q38 124 48 118', `fill="none" stroke="${o.trim}" stroke-width="3"`)
    if (pose === 'hold') hand(52, 104)
  }
  // 右袖
  if (pose === 'point') {
    cv.path('M74 60C84 62 96 58 106 50L110 58C100 70 88 76 74 76Z', S)
    cv.path('M106 50L110 58', `stroke="${o.trim}" stroke-width="3.4"`)
    cv.path('M110 52l8 -4', `stroke="${C.line}" stroke-width="5" stroke-linecap="round"`)
    cv.path('M110 52l8 -4', `stroke="${C.skin}" stroke-width="2.8" stroke-linecap="round"`)
    cv.circle(110, 55, 4.6, `fill="${C.skin}" ${T}`)
  } else if (pose === 'cast' || pose === 'bow') {
    cv.path('M74 60C86 66 94 76 96 88Q88 94 80 90C78 82 74 76 70 72Z', S)
    cv.path('M96 88Q88 94 80 90', `stroke="${o.trim}" stroke-width="3"`)
    hand(90, 94)
  } else {
    cv.path('M74 60C84 72 90 96 92 118Q82 124 72 118C72 100 70 84 68 76Z', S)
    cv.path('M92 118Q82 124 72 118', `fill="none" stroke="${o.trim}" stroke-width="3"`)
    if (pose === 'hold') hand(68, 104)
  }
  void r0
}

function make(name, o, mirror = false) { const cv = new Canvas(); figure(cv, o); save(name, cv.toString(4, null, mirror)) }

// 韩立（玄墨）：墨青袍，掌心托一只小绿瓶
make('cultivator/hanli.svg', {
  robe: [C.ink3, C.ink], trim: C.jade1, inner: C.paper1, sash: C.jade1, hair: C.ink, pose: 'cast', aura: C.jade2,
  prop: cv => {
    cv.circle(92, 82, 12, 'fill="url(#aura)"')
    cv.path('M88 86h8l-1 -6h-6z', `fill="${C.jade2}" ${T}`)
    cv.path('M86 86Q92 96 98 86Z', `fill="${C.jade1}" ${T}`)
    cv.path('M90 80h4v-3h-4z', `fill="${C.wood2}" ${T}`)
  },
})
// 南宫婉：素白蓝边，指间夹一张符
make('cultivator/nangongwan.svg', {
  robe: [C.paper2, C.blue3], trim: C.blue2, inner: '#fff', sash: C.blue1, hair: C.ink, female: true, longHair: true, pose: 'cast', aura: C.blue3, pin: C.blue3,
  prop: cv => cv.add(`<g transform="translate(96 80) rotate(18)"><path d="M-6 -14h12v24h-12z" fill="${C.gold3}" ${T}/><path d="M0 -10v16M-3 -6h6M-3 0h6" stroke="${C.red1}" stroke-width="1.6" stroke-linecap="round"/></g>`),
})
// 丹修：赭袍、短须，手捧葫芦
make('cultivator/danxiu.svg', {
  robe: [C.wood2, C.wood0], trim: C.gold2, inner: C.paper1, sash: C.red1, hair: C.ink2, beard: C.ink2, pose: 'hold', aura: C.fire2,
  prop: cv => {
    cv.circle(60, 100, 9, `fill="${C.gold2}" ${L}`)
    cv.circle(60, 88, 6, `fill="${C.gold2}" ${L}`)
    cv.path('M57 82h6v-4h-6z', `fill="${C.red1}" ${T}`)
    cv.path('M54 92Q60 96 66 92', `fill="none" stroke="${C.red1}" stroke-width="2"`)
  },
})
// 阵修：深青袍、灰须，身前悬一面阵盘
make('cultivator/zhenxiu.svg', {
  robe: [C.jade0, C.ink], trim: C.gold1, inner: C.paper0, sash: C.gold1, hair: C.stone2, beard: C.stone3, pose: 'hold', aura: C.gold3,
  prop: cv => {
    cv.circle(60, 102, 14, `fill="${C.gold1}" ${L}`)
    cv.circle(60, 102, 9, `fill="${C.ink2}" ${T}`)
    cv.path('M60 93v18M51 102h18M54 96l12 12M66 96l-12 12', `stroke="${C.gold3}" stroke-width="1.2"`)
    cv.circle(60, 102, 3, `fill="${C.jade3}"`)
  },
})
// 引导仙子（清徽）：青白纱衣、披帛
const lady = { robe: [C.jade4, C.jade3], trim: C.jade1, inner: '#fff', sash: C.jade1, hair: C.ink, female: true, longHair: true, ribbon: C.jade3, aura: C.jade3 }
make('guide/lady-normal.svg', { ...lady, pose: 'hold', prop: cv => cv.path('M52 104Q60 110 68 104', `fill="none" stroke="${C.jade1}" stroke-width="2"`) })
make('guide/lady-point.svg', { ...lady, pose: 'point' })
// 符修弓阵：蓝袍张弓，身侧飞符
make('troop/fuxiu.svg', {
  robe: [C.blue2, C.blue0], trim: C.paper2, inner: C.paper1, sash: C.red2, hair: C.ink, pose: 'bow', aura: C.blue3,
  prop: cv => {
    cv.path('M10 40Q-2 74 10 108', `fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"`)
    cv.path('M10 40Q-2 74 10 108', `fill="none" stroke="${C.wood2}" stroke-width="2.8" stroke-linecap="round"`)
    cv.path('M10 40L10 108', `stroke="${C.paper2}" stroke-width="1"`)
    cv.path('M12 74H-14', `stroke="${C.jade3}" stroke-width="2.4" stroke-linecap="round"`)
    cv.path('M-14 74l6 -4v8z', `fill="${C.jade3}"`)
    for (const [x, y, r] of [[100, 50, 14], [104, 108, -12], [22, 28, -20]]) cv.add(`<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-5 -10h10v20h-10z" fill="${C.gold3}" ${T}/><path d="M0 -7v12M-2.5 -3h5" stroke="${C.red1}" stroke-width="1.4" stroke-linecap="round"/></g>`)
  },
}, true)
