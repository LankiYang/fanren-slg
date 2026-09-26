// 人物（精细版）：修长比例（头身约 1:5.5），交领广袖、衣褶、刺绣滚边、发丝高光、眼眸高光、玉佩流苏。
import { C, Canvas, save, dk, lt } from './lib.mjs'

const LN = (c = C.line, w = 1) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`
const L = LN(C.line, 1.1)
const T = LN(C.line, 0.7)

/**
 * o: { robe, inner, trim, sash, hair, lining, female, beard, pose:'down'|'hold'|'cast'|'point'|'bow', aura, ribbon, prop(cv), crown, pin }
 * 画布：头心约 (60,33)，脚底 y≈192
 */
export function figure(cv, o) {
  const robe = o.robe, trim = o.trim, hair = o.hair
  const robeFill = cv.grad([[0, dk(robe, 0.28)], [0.35, lt(robe, 0.12)], [0.62, robe], [1, dk(robe, 0.35)]], 'h')
  const pose = o.pose ?? 'down'
  // 光晕与地影
  if (o.aura) {
    cv.ellipse(60, 110, 62, 92, `fill="${cv.rad(o.aura, 0.42)}"`)
    for (const [x, y, r] of [[18, 70, 1.2], [104, 60, 1], [96, 140, 1.4], [22, 150, 1], [110, 100, 0.8]]) cv.circle(x, y, r, `fill="${lt(o.aura, 0.5)}" fill-opacity=".8"`)
  }
  cv.ellipse(60, 193, 34, 5.5, 'fill="#000" fill-opacity=".3"')

  // ── 后发 ──
  if (o.female) cv.path('M47 24C38 48 38 92 42 126C50 132 70 132 78 126C82 92 82 48 73 24Z', `fill="${cv.grad([[0, lt(hair, 0.12)], [1, dk(hair, 0.2)]])}" ${L}`)
  else cv.path('M49 26C46 36 46 46 49 52L71 52C74 46 74 36 71 26Z', `fill="${dk(hair, 0.1)}" ${L}`)
  if (o.female) for (const d of ['M50 40C46 70 46 100 48 124', 'M70 40C74 70 74 100 72 124', 'M60 30C58 70 60 100 60 128']) cv.path(d, `fill="none" stroke="${lt(hair, 0.3)}" stroke-opacity=".5" stroke-width=".6"`)

  // ── 披帛（身后部分）──
  if (o.ribbon) {
    cv.path('M44 62C26 72 18 104 24 132C28 150 20 166 12 176C22 170 32 156 30 136C26 110 32 84 46 72Z', `fill="${cv.grad([[0, lt(o.ribbon, 0.2)], [1, dk(o.ribbon, 0.15)]])}" ${T}`)
    cv.path('M76 62C94 72 102 104 96 132C92 150 100 166 108 176C98 170 88 156 90 136C94 110 88 84 74 72Z', `fill="${cv.grad([[0, lt(o.ribbon, 0.2)], [1, dk(o.ribbon, 0.15)]])}" ${T}`)
  }

  // ── 下裳（内层，前襟开口处可见）──
  cv.path('M47 110C45 140 41 168 36 190Q60 196 84 190C79 168 75 140 73 110Z', `fill="${cv.grad([[0, dk(o.inner, 0.1)], [0.5, lt(o.inner, 0.1)], [1, dk(o.inner, 0.18)]], 'h')}" ${L}`)
  for (const x of [52, 58, 64, 70]) cv.path(`M${x} 118C${x - 1} 150 ${x - 2} 170 ${x - 3 + (x - 60) * 0.3} 190`, `fill="none" stroke="${dk(o.inner, 0.3)}" stroke-opacity=".45" stroke-width=".6"`)
  cv.path('M36 190Q60 196 84 190', `fill="none" stroke="${o.innerTrim ?? trim}" stroke-width="2.4"`)

  // ── 鞋尖 ──
  for (const x of [51, 69]) cv.path(`M${x - 5} 193q0 -4 5 -4q5 0 5 4q-2 1 -5 .5q-3 .5 -5 -.5z`, `fill="${C.ink}" ${T}`, [[x - 5, 189], [x + 5, 194]])

  // ── 外袍 ──
  cv.path('M44 54C38 80 36 124 28 186Q40 191 53 190C55 160 57 130 58 104L62 104C63 130 65 160 67 190Q80 191 92 186C84 124 82 80 76 54C70 51 50 51 44 54Z', `fill="${robeFill}" ${L}`)
  // 衣褶：暗褶 + 亮褶
  for (const d of ['M40 116C38 140 35 162 33 184', 'M47 108C46 140 46 166 46 188', 'M73 108C74 140 74 166 74 188', 'M80 116C82 140 85 162 87 184', 'M52 70C50 84 50 96 51 104']) cv.path(d, `fill="none" stroke="${dk(robe, 0.4)}" stroke-opacity=".5" stroke-width=".8"`)
  for (const d of ['M43 120C41 144 39 164 37 184', 'M77 122C79 144 81 164 83 184']) cv.path(d, `fill="none" stroke="${lt(robe, 0.35)}" stroke-opacity=".45" stroke-width=".7"`)
  // 前襟滚边 + 下摆刺绣带
  for (const d of ['M58 104C57 130 55 160 53 190', 'M62 104C63 130 65 160 67 190']) { cv.path(d, `fill="none" stroke="${trim}" stroke-width="3"`); cv.path(d, `fill="none" stroke="${C.gold3}" stroke-opacity=".6" stroke-width=".5"`) }
  for (const d of ['M28 186Q40 191 53 190', 'M67 190Q80 191 92 186']) { cv.path(d, `fill="none" stroke="${trim}" stroke-width="4.4"`); cv.path(d, `fill="none" stroke="${C.gold2}" stroke-width=".6" stroke-dasharray="2 1.6"`) }
  for (const x of [34, 44, 76, 86]) cv.path(`M${x - 2} 187.6q2 -2.4 4 0`, `fill="none" stroke="${C.gold3}" stroke-width=".6"`)

  // ── 交领（右衽）──
  cv.path('M51 52L60 76L69 52Z', `fill="${o.collar ?? '#f7f2e6'}" ${T}`)
  cv.path('M51 52L64 94', `fill="none" stroke="${trim}" stroke-width="3.6"`)
  cv.path('M51 52L64 94', `fill="none" stroke="${C.gold3}" stroke-opacity=".55" stroke-width=".5"`)
  cv.path('M69 52L60 74', `fill="none" stroke="${trim}" stroke-width="3.6"`)
  cv.path('M69 52L60 74', `fill="none" stroke="${C.gold3}" stroke-opacity=".55" stroke-width=".5"`)

  // ── 腰封 + 结 + 垂绦 + 玉璧 ──
  cv.path('M45 92Q60 97 75 92L75.5 101Q60 106 44.5 101Z', `fill="${cv.grad([[0, lt(o.sash, 0.15)], [1, dk(o.sash, 0.2)]])}" ${T}`)
  cv.path('M45.5 95Q60 100 74.5 95', `fill="none" stroke="${C.gold2}" stroke-width=".6"`)
  cv.path('M45 99Q60 104 75 99', `fill="none" stroke="${C.gold2}" stroke-width=".6"`)
  cv.path('M64 100C60 110 62 124 58 140M66 100C68 112 66 126 70 138', `fill="none" stroke="${o.sash}" stroke-width="2.4" stroke-linecap="round"`)
  cv.path('M64 100c-3 -3 -6 -1 -4 2c-3 1 -2 5 2 3c1 3 5 3 5 -1c3 -1 2 -5 -1 -4z', `fill="${o.sash}" ${T}`, [[59, 96], [69, 104]])
  cv.circle(60, 146, 3.6, `fill="${cv.grad([[0, C.jade4], [1, C.jade1]])}" ${T}`)
  cv.circle(60, 146, 1.2, `fill="${dk(robe, 0.3)}"`)
  cv.path('M60 150v10M58.6 150l-1 9M61.4 150l1 9', `stroke="${C.red1}" stroke-width=".6"`)

  sleeves(cv, o, pose, robeFill)

  // ── 颈 + 脸 ──
  cv.path('M56 44L56 53L64 53L64 44Z', `fill="${C.skin2}"`)
  cv.path('M56 50Q60 53 64 50', `fill="none" stroke="${dk(C.skin2, 0.3)}" stroke-width=".5"`)
  if (!o.female) for (const s of [-1, 1]) cv.path(`M${60 + s * 10.4} 32q${s * 2.6} 0 ${s * 2} 4q${-s * 0.4} 2.6 ${-s * 2} 2.4`, `fill="${C.skin}" ${T}`, [[60 + s * 13, 30]])
  cv.path('M50 30C50 20 70 20 70 30C70 40 66 46 60 47C54 46 50 40 50 30Z', `fill="${cv.grad([[0, lt(C.skin, 0.15)], [1, dk(C.skin, 0.06)]])}" ${L}`)
  // 五官
  const eyeY = 35.2
  for (const s of [-1, 1]) {
    const ex = 60 + s * 4.9
    cv.path(`M${ex - 2.8} ${eyeY}Q${ex} ${eyeY - 1.9} ${ex + 2.8} ${eyeY - 0.1}`, `fill="none" stroke="${C.line}" stroke-width="1.05"`)
    cv.path(`M${ex - 2.4} ${eyeY + 0.2}Q${ex} ${eyeY + 1.6} ${ex + 2.4} ${eyeY + 0.2}Q${ex} ${eyeY - 1.2} ${ex - 2.4} ${eyeY + 0.2}Z`, `fill="#fbf6ef"`)
    cv.circle(ex + s * 0.1, eyeY + 0.25, 1.25, `fill="${cv.grad([[0, '#1c120e'], [1, '#6b4a33']])}"`)
    cv.circle(ex + s * 0.1 + 0.4, eyeY - 0.2, 0.42, 'fill="#fff"')
    if (o.female) cv.path(`M${ex + s * 2.8} ${eyeY - 0.1}l${s * 1.1} -0.9`, `stroke="${C.line}" stroke-width=".6"`)
    cv.path(`M${ex - 2.6} ${eyeY - 3.6}Q${ex} ${eyeY - (o.female ? 5 : 5.4)} ${ex + 2.8} ${eyeY - 3.9}`, `fill="none" stroke="${o.brow ?? dk(hair, 0.1)}" stroke-width="${o.female ? 0.6 : 0.95}"`)
  }
  cv.path('M60 37.6q.7 1.7 -.4 2.4', `fill="none" stroke="${dk(C.skin2, 0.2)}" stroke-width=".55"`)
  if (o.female) { cv.path('M58.3 42.4q1.7 -.8 3.4 0q-1.7 1.3 -3.4 0z', `fill="${C.red2}"`); for (const s of [-1, 1]) cv.ellipse(60 + s * 6.4, 39.6, 2.3, 1.1, `fill="${C.red3}" fill-opacity=".32"`) }
  else cv.path('M58.4 42.4q1.6 .7 3.2 0', `fill="none" stroke="${dk(C.red1, 0.1)}" stroke-width=".8"`)
  if (o.beard) {
    cv.path('M55 43Q60 46 65 43Q64 50 60 58Q56 50 55 43Z', `fill="${o.beard}" ${T}`)
    cv.path('M56.5 41.6q-2.6 1.4 -3.4 3.6M63.5 41.6q2.6 1.4 3.4 3.6', `fill="none" stroke="${o.beard}" stroke-width="1.1"`)
    for (const d of ['M58 47q1 5 2 9', 'M62 47q-1 5 -2 9']) cv.path(d, `fill="none" stroke="${lt(o.beard, 0.4)}" stroke-width=".4"`)
  }

  // ── 前发 + 发髻 ──
  const HF = `fill="${cv.grad([[0, lt(hair, 0.18)], [1, hair]])}" ${L}`
  if (o.female) {
    cv.path('M48 34C46 20 54 13 61 13C69 13 75 20 72 34C71 28 68 24 64 23C63 27 59 29 55 28C53 30 50 32 48 34Z', HF)
    for (const d of ['M48 30C45 44 46 58 43 72', 'M72 30C75 44 74 58 77 72']) { cv.path(d, `fill="none" stroke="${C.line}" stroke-width="4.6" stroke-linecap="round"`); cv.path(d, `fill="none" stroke="${hair}" stroke-width="3.2" stroke-linecap="round"`) }
    // 高髻 + 发带 + 步摇
    cv.path('M52 14C50 2 58 -2 62 -1C68 0 70 8 67 14Z', HF)
    cv.path('M54 12Q60 8 66 12', `fill="none" stroke="${o.pin ?? C.jade2}" stroke-width="1.8"`)
    cv.path('M64 6l14 -7', `stroke="${C.gold2}" stroke-width="1.2" stroke-linecap="round"`, [[78, -2]])
    cv.circle(78, -1.4, 2, `fill="${o.pin ?? C.jade3}" ${T}`)
    for (const [dx, len] of [[74, 8], [76, 11]]) { cv.path(`M${dx} 1v${len}`, `stroke="${C.gold2}" stroke-width=".4"`, [[dx, 1 + len]]); cv.circle(dx, 1 + len + 1, 1, `fill="${C.red2}"`) }
    cv.path('M52 6q-6 2 -6 10', `fill="none" stroke="${o.pin ?? C.jade2}" stroke-width="1.2"`)
    for (const d of ['M55 16Q58 20 58 26', 'M63 16Q66 19 68 24', 'M56 2Q60 -1 64 1']) cv.path(d, `fill="none" stroke="${lt(hair, 0.35)}" stroke-opacity=".6" stroke-width=".55"`)
  } else {
    cv.path('M48 32C47 18 56 14 61 14C68 14 74 20 72 32C70 26 66 22 60 23C55 22 50 26 48 32Z', HF)
    for (const d of ['M49 29C48 36 49 41 50 45', 'M71 29C72 36 71 41 70 45']) cv.path(d, `fill="none" stroke="${hair}" stroke-width="1.6"`)
    cv.circle(60, 12, 5.6, HF)
    cv.path('M55.4 13Q55 5.5 60 5Q65 5.5 64.6 13Z', `fill="${cv.grad([[0, C.gold3], [1, C.gold0]])}" ${T}`)
    cv.path('M57.5 7.4v4.6M62.5 7.4v4.6', `stroke="${C.gold0}" stroke-width=".5"`)
    cv.path('M49 10L71 7.4', `stroke="${C.line}" stroke-width="2.4" stroke-linecap="round"`)
    cv.path('M49 10L71 7.4', `stroke="${o.crown ?? C.gold3}" stroke-width="1.2" stroke-linecap="round"`)
    cv.circle(71, 7.4, 1.4, `fill="${C.jade3}" ${T}`)
    for (const d of ['M53 20Q57 17 62 18', 'M64 18Q68 19 70 24']) cv.path(d, `fill="none" stroke="${lt(hair, 0.4)}" stroke-opacity=".6" stroke-width=".55"`)
  }
  if (o.prop) o.prop(cv)
}

function sleeves(cv, o, pose, robeFill) {
  const trim = o.trim, lining = o.lining ?? o.inner, robe = o.robe
  const S = `fill="${robeFill}" ${L}`
  const fold = d => cv.path(d, `fill="none" stroke="${dk(robe, 0.4)}" stroke-opacity=".5" stroke-width=".8"`)
  const cuff = d => { cv.path(d, `fill="${lining}" ${T}`) }
  const hand = (x, y, dir = 1) => {
    cv.path(`M${x - 3} ${y - 2}q${dir * 3} -3 ${dir * 6.5} -1q${dir * 1.4} 2 0 4.2q${-dir * 2} 2.6 ${-dir * 5.4} 1.4q${-dir * 2} -1.6 ${-dir * 1.1} -4.6z`, `fill="${C.skin}" ${T}`, [[x - 4, y - 5], [x + 5, y + 4]])
    cv.path(`M${x + dir * 1} ${y - 1.4}l${dir * 2.4} .2M${x + dir * 1} ${y + 0.4}l${dir * 2.2} .3`, `stroke="${dk(C.skin2, 0.2)}" stroke-width=".4"`)
  }
  // 左袖（画面左）
  if (pose === 'bow') {
    cv.path('M45 58C34 60 22 62 12 63L11 74C24 75 36 73 48 71Z', S)
    cuff('M12 63L11 74Q8 68.5 12 63Z')
    fold('M40 62C32 64 24 65 16 66'); fold('M42 70C32 71 24 72 16 72')
    cv.path('M12 63L11 74', `stroke="${trim}" stroke-width="2.4"`)
    hand(7, 68, -1)
  } else if (pose === 'hold') {
    cv.path('M45 56C35 64 31 86 33 106C35 118 44 124 57 121L61 110C55 104 51 90 51 76Z', S)
    fold('M40 70C37 84 37 98 40 110'); fold('M46 74C44 90 46 104 52 114')
  } else {
    cv.path('M45 56C36 62 32 80 30 100C28 116 26 130 27 142Q36 148 46 143C47 128 48 112 50 96C51 84 50 70 48 60Z', S)
    cuff('M27 142Q36 148 46 143Q37 139 27 142Z')
    cv.path('M27 142Q36 148 46 143', `fill="none" stroke="${trim}" stroke-width="3"`)
    fold('M38 70C35 90 33 110 32 132'); fold('M44 80C42 100 41 118 40 138')
  }
  // 右袖
  if (pose === 'point') {
    cv.path('M75 56C86 56 98 50 108 43L113 52C104 60 92 68 76 72Z', S)
    cuff('M108 43L113 52Q113.5 46 108 43Z')
    cv.path('M108 43L113 52', `stroke="${trim}" stroke-width="3"`)
    fold('M84 58C92 56 100 52 106 48'); fold('M86 66C94 62 102 58 108 54')
    cv.path('M112 46l8 -5', `stroke="${C.line}" stroke-width="3.2" stroke-linecap="round"`, [[121, 40]])
    cv.path('M112 46l8 -5', `stroke="${C.skin}" stroke-width="2" stroke-linecap="round"`)
    cv.circle(112.6, 47.6, 3, `fill="${C.skin}" ${T}`)
  } else if (pose === 'cast' || pose === 'bow') {
    cv.path('M75 56C86 60 94 70 98 82C100 90 97 96 92 98L85 94C84 86 80 76 71 70Z', S)
    cuff('M92 98L85 94Q89 99 92 98Z')
    cv.path('M92 98L85 94', `stroke="${trim}" stroke-width="3"`)
    fold('M80 62C86 68 90 76 92 86')
    hand(pose === 'bow' ? 84 : 92, pose === 'bow' ? 92 : 93, 1)
  } else if (pose === 'hold') {
    cv.path('M75 56C85 64 89 86 87 106C85 118 76 124 63 121L59 110C65 104 69 90 69 76Z', S)
    fold('M80 70C83 84 83 98 80 110'); fold('M74 74C76 90 74 104 68 114')
    cv.path('M52 118Q60 124 68 118', `fill="none" stroke="${trim}" stroke-width="3"`)
    cv.path('M54 112q6 -4 12 0q-2 6 -6 6q-4 0 -6 -6z', `fill="${C.skin}" ${T}`)
    cv.path('M57 113.4q3 -1.6 6 0', `fill="none" stroke="${dk(C.skin2, 0.2)}" stroke-width=".4"`)
  } else {
    cv.path('M75 56C84 62 88 80 90 100C92 116 94 130 93 142Q84 148 74 143C73 128 72 112 70 96C69 84 70 70 72 60Z', S)
    cuff('M93 142Q84 148 74 143Q83 139 93 142Z')
    cv.path('M93 142Q84 148 74 143', `fill="none" stroke="${trim}" stroke-width="3"`)
    fold('M82 70C85 90 87 110 88 132'); fold('M76 80C78 100 79 118 80 138')
  }
}

function make(name, o, mirror = false) { const cv = new Canvas(); figure(cv, o); save(name, cv.toString(4, null, mirror)) }

const talisman = (cv, x, y, r, s = 1) => cv.add(`<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M-5 -11h10v22h-10z" fill="${C.gold3}" ${T}/><path d="M-4 -10h8v20h-8z" fill="none" stroke="${C.red1}" stroke-width=".5"/><path d="M0 -8v14M-2.6 -5h5.2M-2.6 -1h5.2M-2 3l2 2 2 -2" fill="none" stroke="${C.red1}" stroke-width=".9" stroke-linecap="round"/></g>`, [[x - 8 * s, y - 13 * s], [x + 8 * s, y + 13 * s]])

// 韩立（玄墨）：墨青袍、青玉滚边，掌心托一只发光小绿瓶
make('cultivator/hanli.svg', {
  robe: '#34475a', inner: '#1f2b36', lining: C.jade1, trim: C.jade1, sash: C.jade0, hair: '#141a20', pose: 'cast', aura: C.jade2,
  prop: cv => {
    cv.circle(94, 80, 14, `fill="${cv.rad(C.jade3, 0.8)}"`)
    cv.path('M90.4 84.6Q88 90 91 92.6Q94 94.4 97 92.6Q100 90 97.6 84.6Z', `fill="${cv.grad([[0, C.jade3], [1, C.jade1]], 'h')}" ${T}`)
    cv.path('M91.6 84.6h4.8v-4h-4.8z', `fill="${C.jade2}" ${T}`)
    cv.path('M91 80.6h6v-1.8h-6z', `fill="${C.wood2}" ${T}`)
    cv.path('M91.6 87q-1 3 .6 4.6', `fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".6"`)
    for (const [x, y] of [[88, 72], [100, 70], [94, 66]]) cv.circle(x, y, 0.9, `fill="${C.jade4}"`)
  },
})
// 南宫婉：素白蓝缘，指间夹符
make('cultivator/nangongwan.svg', {
  robe: '#eef0f2', inner: '#c9dcea', lining: C.blue3, trim: C.blue2, sash: C.blue1, hair: '#141a20', female: true, pose: 'cast', aura: C.blue3, pin: C.blue2, ribbon: '#bfe0ee',
  prop: cv => { cv.circle(96, 84, 12, `fill="${cv.rad(C.gold3, 0.7)}"`); talisman(cv, 97, 80, 16, 0.85) },
})
// 丹修：赭袍、黑须，捧紫金葫芦
make('cultivator/danxiu.svg', {
  robe: C.wood2, inner: C.paper1, lining: C.gold2, trim: C.gold1, sash: C.red1, hair: '#1e1a18', beard: '#1e1a18', pose: 'hold', aura: C.fire2,
  prop: cv => {
    cv.circle(60, 100, 16, `fill="${cv.rad(C.fire2, 0.6)}"`)
    cv.circle(60, 104, 8, `fill="${cv.grad([[0, C.gold3], [0.5, C.gold1], [1, C.gold0]], 'h')}" ${L}`)
    cv.circle(60, 93, 5.4, `fill="${cv.grad([[0, C.gold3], [0.5, C.gold1], [1, C.gold0]], 'h')}" ${L}`)
    cv.path('M55.6 97.6Q60 100 64.4 97.6', `fill="none" stroke="${C.red1}" stroke-width="1.6"`)
    cv.path('M57.8 88h4.4v-3h-4.4z', `fill="${C.red1}" ${T}`)
    cv.path('M62 97q4 3 2 8', `fill="none" stroke="${C.red2}" stroke-width=".8"`)
    cv.path('M56 101q-1 3 0 5', `fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".7"`)
  },
})
// 阵修：深青袍、灰白须，身前悬一面八卦阵盘
make('cultivator/zhenxiu.svg', {
  robe: C.jade0, inner: '#dfe6df', lining: C.gold2, trim: C.gold1, sash: C.gold0, hair: '#8f9497', beard: '#c9ccc8', brow: '#b9bcb8', pose: 'hold', aura: C.gold3, crown: C.jade3,
  prop: cv => {
    cv.circle(60, 102, 20, `fill="${cv.rad(C.gold3, 0.55)}"`)
    cv.circle(60, 102, 13, `fill="${cv.grad([[0, C.gold3], [1, C.gold0]])}" ${L}`)
    cv.circle(60, 102, 9.5, `fill="${C.ink2}" ${T}`)
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cv.path(`M${60 + Math.cos(a) * 10.4} ${102 + Math.sin(a) * 10.4}L${60 + Math.cos(a) * 12.4} ${102 + Math.sin(a) * 12.4}`, `stroke="${C.gold0}" stroke-width="1"`) }
    cv.path('M60 94a8 8 0 0 1 0 16a4 4 0 0 1 0 -8a4 4 0 0 0 0 -8z', `fill="${C.paper2}"`)
    cv.circle(60, 98, 1.2, `fill="${C.ink2}"`); cv.circle(60, 106, 1.2, `fill="${C.paper2}"`)
    cv.circle(60, 102, 8, `fill="none" stroke="${C.jade3}" stroke-opacity=".6" stroke-width=".5"`)
  },
})
// 引导仙子（清徽）：青白纱衣、青绿披帛
const lady = { robe: '#e6f4ef', inner: '#bfe6da', lining: C.jade3, trim: C.jade1, sash: C.jade1, hair: '#141a20', female: true, ribbon: '#a8e0cf', aura: C.jade3 }
make('guide/lady-normal.svg', { ...lady, pose: 'hold' })
make('guide/lady-point.svg', { ...lady, pose: 'point' })
// 符修弓阵：石青袍张弓，身侧飞符（朝右）
make('troop/fuxiu.svg', {
  robe: C.blue2, inner: C.paper1, lining: C.paper2, trim: C.blue0, sash: C.red2, hair: '#141a20', pose: 'bow', aura: C.blue3,
  prop: cv => {
    cv.path('M9 36Q-6 69 9 102', `fill="none" stroke="${C.line}" stroke-width="4.4" stroke-linecap="round"`, [[-6, 36], [9, 102]])
    cv.path('M9 36Q-6 69 9 102', `fill="none" stroke="${cv.grad([[0, C.wood3], [1, C.wood1]])}" stroke-width="2.6" stroke-linecap="round"`)
    cv.path('M9 36L9 102', `stroke="${C.paper2}" stroke-width=".6"`)
    for (const y of [36, 102]) cv.circle(9, y, 1.4, `fill="${C.gold2}" ${T}`)
    cv.path('M84 90L-18 69', `stroke="${C.wood2}" stroke-width="1.1"`, [[-18, 69]])
    cv.path('M-18 69l7 -3.6 -1.2 3.8 1.2 3.4z', `fill="${C.jade3}" ${T}`)
    cv.path('M-14 69l-8 0', `stroke="${C.jade3}" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"`)
    cv.path('M80 88l5 -4M80 91l5 1', `stroke="${C.red2}" stroke-width="1.2"`)
    talisman(cv, 102, 46, 14, 0.8); talisman(cv, 106, 112, -12, 0.75); talisman(cv, 24, 22, -20, 0.7)
  },
}, true)
