// 兵种 / 妖兽。约定：我方兵种朝右，妖兽朝左（战斗场景里面对面）。
// 蛇、蛟类用「分层描边管」画身体：墨线粗描 → 主色 → 鳞纹虚线，小尺寸下依旧饱满。
import { C, Canvas, save, glow, lin } from './lib.mjs'

const L = `stroke="${C.line}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`
const T = `stroke="${C.line}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`

function tube(cv, d, w, main, scale, bbox) {
  cv.path(d, `fill="none" stroke="${C.line}" stroke-width="${w + 4.4}" stroke-linecap="round" stroke-linejoin="round"`, bbox)
  cv.path(d, `fill="none" stroke="${main}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`)
  cv.path(d, `fill="none" stroke="${scale}" stroke-width="${w * 0.55}" stroke-dasharray="2.5 5" stroke-linecap="round" stroke-opacity=".8"`)
}
function eye(cv, x, y, r = 3.4, col = C.fire3) {
  cv.circle(x, y, r + 3, `fill="${col}" fill-opacity=".35"`)
  cv.circle(x, y, r, `fill="${col}" ${T}`)
  cv.path(`M${x} ${y - r + 1}v${2 * r - 2}`, `stroke="${C.line}" stroke-width="1.4" stroke-linecap="round"`)
}
function shadow(cv, x, y, rx) { cv.ellipse(x, y, rx, rx * 0.16, 'fill="#000" fill-opacity=".28"') }
function out(name, cv, mirror = false) { save(name, cv.toString(4, null, mirror)) }

// ── 腿：锥形腿 + 爪 ──
function leg(cv, x, y, h, w, fill, bend = 0) {
  // 大腿粗、脚踝细，落地一只圆爪
  const ax = x + bend
  cv.path(`M${x - w} ${y}C${x - w * 1.1} ${y + h * 0.35} ${ax - w * 0.5} ${y + h * 0.6} ${ax - w * 0.45} ${y + h - 6}L${ax + w * 0.45} ${y + h - 6}C${ax + w * 0.6} ${y + h * 0.55} ${x + w * 1.1} ${y + h * 0.3} ${x + w} ${y}Z`, `fill="${fill}" ${L}`, [[x - w * 1.1, y], [x + w * 1.1, y + h]])
  cv.path(`M${ax - w * 0.9} ${y + h}C${ax - w * 0.9} ${y + h - 8} ${ax + w * 0.9} ${y + h - 8} ${ax + w * 0.9} ${y + h}Z`, `fill="${fill}" ${L}`, [[ax - w, y + h]])
  cv.path(`M${ax - w * 0.3} ${y + h}v-3M${ax + w * 0.3} ${y + h}v-3`, `stroke="${C.line}" stroke-width="1.2"`)
}

// ── 四足兽（朝左）：狼 / 狻猊 / 星兽共用骨架 ──
function quadruped(cv, o) {
  const { body, belly, dark } = o
  shadow(cv, 84, 146, 64)
  // 远侧腿（暗）
  leg(cv, 50, 104, 40, 9, dark, 2); leg(cv, 118, 104, 40, 10, dark, 2)
  // 尾
  if (o.tail === 'bush') cv.path('M140 84C160 76 170 50 160 30C170 52 150 60 146 50C156 70 146 80 136 80Z', `fill="${body}" ${L}`)
  if (o.tail === 'flame') cv.path('M138 82C156 80 170 60 164 38C172 56 160 64 158 56C164 72 150 84 136 88Z', `fill="${o.accent}" ${L}`)
  if (o.tail === 'whip') cv.path('M138 84C156 88 168 76 170 60', `fill="none" stroke="${C.line}" stroke-width="8" stroke-linecap="round"`), cv.path('M138 84C156 88 168 76 170 60', `fill="none" stroke="${body}" stroke-width="4" stroke-linecap="round"`), cv.path('M170 60l-8 -10 12 -2 4 10z', `fill="${o.accent}" ${L}`)
  // 身体
  cv.path('M40 76C42 58 64 54 90 58C114 56 136 60 142 80C146 98 132 110 112 108C94 112 70 112 54 106C42 100 38 90 40 76Z', `fill="${body}" ${L}`, [[38, 54], [146, 112]])
  cv.path('M54 104C70 110 94 110 112 106C124 104 132 98 136 90C120 100 90 102 60 96Z', `fill="${belly}" fill-opacity=".85"`)
  // 近侧腿
  leg(cv, 62, 100, 44, 11, body); leg(cv, 126, 98, 46, 12, body)
  if (o.spikes) for (let i = 0; i < 5; i++) { const x = 66 + i * 14, y = 58 - Math.sin(i / 4 * Math.PI) * 4; cv.path(`M${x - 6} ${y + 2}L${x} ${y - 16 - (i % 2) * 6}L${x + 6} ${y + 2}Z`, `fill="${o.spikes}" ${T}`); cv.path(`M${x} ${y - 14 - (i % 2) * 6}L${x} ${y}`, `stroke="#fff" stroke-opacity=".6" stroke-width="1"`) }
  // 鬃
  if (o.mane) cv.path('M58 44C70 36 80 48 76 60C86 70 80 88 66 90C60 100 44 96 42 86C30 84 30 70 38 64C34 52 46 42 58 44Z', `fill="${o.mane}" ${L}`)
  // 头
  const H = o.head ?? 'wolf'
  if (H === 'wolf') {
    cv.path('M52 46L58 24L66 44Z', `fill="${body}" ${L}`)
    cv.path('M36 44L40 22L50 40Z', `fill="${dark}" ${L}`)
    cv.path('M60 50C58 36 42 32 32 40C24 46 12 50 6 58C8 66 20 70 32 70C44 72 60 66 60 50Z', `fill="${body}" ${L}`)
    cv.path('M6 58C12 62 22 64 32 62', `fill="none" ${T}`)
    cv.path('M10 64l4 5 3 -5 3 5 3 -5', `fill="#fff" ${T}`)
    cv.circle(7, 57, 2.6, `fill="${C.line}"`)
    eye(cv, 34, 48, 3)
  } else if (H === 'lion') {
    cv.path('M58 50C58 34 40 30 28 36C18 40 10 48 8 58C10 70 24 76 36 74C50 72 58 64 58 50Z', `fill="${body}" ${L}`)
    cv.path('M8 58C14 64 24 66 34 64', `fill="none" ${T}`)
    cv.path('M12 66l3 6 3 -6 3 6 3 -6', `fill="#fff" ${T}`)
    cv.path('M36 34C34 22 42 14 50 16C44 20 42 28 44 34Z', `fill="${o.accent}" ${L}`)
    cv.circle(10, 55, 3, `fill="${C.line}"`)
    eye(cv, 30, 46, 3.4)
    cv.path('M24 40l10 -2', `stroke="${C.line}" stroke-width="2.4" stroke-linecap="round"`)
  } else if (H === 'qilin') {
    cv.path('M60 50C58 36 42 32 32 38C22 44 12 48 6 58C8 66 22 70 34 70C48 70 60 64 60 50Z', `fill="${body}" ${L}`)
    cv.path('M40 36C38 20 46 8 58 4C50 14 48 24 50 36Z', `fill="${o.accent}" ${L}`)
    cv.path('M52 38C54 24 62 16 72 14C64 22 62 30 62 42Z', `fill="${o.accent}" ${L}`)
    cv.path('M8 62C4 72 8 80 14 84M16 66C14 74 18 80 22 82', `fill="none" stroke="${o.accent}" stroke-width="2.4" stroke-linecap="round"`)
    cv.circle(8, 56, 2.4, `fill="${C.line}"`)
    eye(cv, 32, 48, 3.2, C.jade4)
  }
}

// ── 我方：御兽军（青灵狼 + 骑手），朝右 ──
{
  const cv = new Canvas()
  cv.def(glow('g', C.jade2, 0.4))
  cv.ellipse(84, 90, 84, 60, 'fill="url(#g)"')
  quadruped(cv, { body: C.jade2, belly: C.jade4, dark: C.jade0, mane: C.jade3, tail: 'bush', head: 'wolf' })
  // 鞍与骑手
  cv.path('M80 58C86 52 104 52 110 58L108 68C100 72 88 72 82 68Z', `fill="${C.red1}" ${L}`)
  cv.path('M84 58L100 20L110 58Z', `fill="${C.blue1}" ${L}`)
  cv.path('M92 38Q100 32 108 38', `fill="none" stroke="${C.gold2}" stroke-width="2.4"`)
  cv.circle(100, 18, 9, `fill="${C.skin}" ${L}`)
  cv.path('M91 18C90 8 96 6 100 6C106 6 110 10 109 18C104 12 96 12 91 18Z', `fill="${C.ink}" ${L}`)
  cv.circle(100, 5, 4, `fill="${C.ink}" ${L}`)
  cv.circle(96, 19, 1.4, `fill="${C.line}"`)
  cv.path('M118 4L70 50', `stroke="${C.line}" stroke-width="4.4" stroke-linecap="round"`)
  cv.path('M118 4L70 50', `stroke="${C.wood3}" stroke-width="2.2" stroke-linecap="round"`)
  cv.path('M70 50l-10 12 14 -6z', `fill="${C.stone4}" ${T}`)
  cv.path('M76 44l-4 8 6 -2z', `fill="${C.red2}"`)
  out('troop/yushou.svg', cv, true)
}

// ── 傀儡（我方傀儡兵朝右；天南废墟战傀更大更凶，朝左）──
function puppet(cv, o) {
  const m = o.metal, d = o.metalDark, g = o.glow
  shadow(cv, 60, 152, 40)
  // 腿
  for (const x of [46, 70]) {
    cv.path(`M${x} 108h12v18h-12z`, `fill="${d}" ${L}`)
    cv.circle(x + 6, 128, 5, `fill="${m}" ${L}`)
    cv.path(`M${x - 2} 132h16l2 18h-20z`, `fill="${m}" ${L}`)
  }
  // 躯干
  cv.path('M36 58L84 58L80 108L40 108Z', `fill="${m}" ${L}`)
  cv.path('M60 58L84 58L80 108L60 108Z', `fill="${d}" fill-opacity=".6"`)
  cv.path('M44 70h32M42 84h36M42 98h36', `stroke="${C.line}" stroke-width="1.4" stroke-opacity=".6"`)
  cv.circle(60, 80, 7, `fill="${C.ink}" ${T}`)
  cv.circle(60, 80, 4, `fill="${g}"`)
  // 肩甲
  for (const [x, s] of [[36, -1], [84, 1]]) cv.path(`M${x} 56C${x + s * 14} 52 ${x + s * 18} 62 ${x + s * 16} 72L${x} 70Z`, `fill="${m}" ${L}`)
  // 头：方盔 + 发光眼缝
  cv.path('M46 30Q46 20 60 20Q74 20 74 30L74 52L46 52Z', `fill="${m}" ${L}`)
  cv.path('M46 36h28v8h-28z', `fill="${C.ink}" ${T}`)
  cv.path('M50 40h20', `stroke="${g}" stroke-width="3" stroke-linecap="round"`)
  cv.path('M60 20V8', `stroke="${C.line}" stroke-width="3.6" stroke-linecap="round"`)
  cv.path('M60 8l-6 -4h12z', `fill="${o.plume}" ${T}`)
  // 手臂：右臂武器、左臂盾
  cv.path('M86 70l8 26', `stroke="${C.line}" stroke-width="12" stroke-linecap="round"`)
  cv.path('M86 70l8 26', `stroke="${d}" stroke-width="8" stroke-linecap="round"`)
  cv.circle(95, 98, 6, `fill="${m}" ${L}`)
  o.weapon(cv)
  cv.path('M34 70l-8 24', `stroke="${C.line}" stroke-width="12" stroke-linecap="round"`)
  cv.path('M34 70l-8 24', `stroke="${d}" stroke-width="8" stroke-linecap="round"`)
  o.shield?.(cv)
}
{
  const cv = new Canvas()
  puppet(cv, {
    metal: C.wood2, metalDark: C.wood1, glow: C.jade3, plume: C.red2,
    weapon: cv => { cv.path('M96 98L118 50', `stroke="${C.line}" stroke-width="7" stroke-linecap="round"`); cv.path('M96 98L118 50', `stroke="${C.stone4}" stroke-width="3.6" stroke-linecap="round"`); cv.path('M90 92l14 6', `stroke="${C.gold2}" stroke-width="4" stroke-linecap="round"`) },
    shield: cv => { cv.circle(22, 96, 20, `fill="${C.gold1}" ${L}`); cv.circle(22, 96, 13, `fill="${C.wood1}" ${T}`); cv.circle(22, 96, 5, `fill="${C.gold3}" ${T}`); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cv.circle(22 + Math.cos(a) * 16.5, 96 + Math.sin(a) * 16.5, 1.4, `fill="${C.gold3}"`) } },
  })
  out('troop/kuilei.svg', cv)
}
{
  const cv = new Canvas()
  cv.def(glow('g', C.red2, 0.45))
  cv.ellipse(60, 90, 70, 72, 'fill="url(#g)"')
  puppet(cv, {
    metal: C.gold1, metalDark: C.gold0, glow: C.fire2, plume: C.red1,
    weapon: cv => {
      cv.path('M96 100L112 30', `stroke="${C.line}" stroke-width="7" stroke-linecap="round"`); cv.path('M96 100L112 30', `stroke="${C.wood2}" stroke-width="3.6" stroke-linecap="round"`)
      cv.path('M100 20h26v20h-26z', `fill="${C.stone2}" ${L}`); cv.path('M100 30h26', `stroke="${C.fire2}" stroke-width="2"`)
    },
    shield: cv => { cv.path('M14 70h22v44l-11 8 -11 -8z', `fill="${C.red1}" ${L}`); cv.path('M25 76v36M17 90h16', `stroke="${C.gold3}" stroke-width="2"`) },
  })
  out('monster/ch7-warpuppet.svg', cv, true)
}

// ── 青牛谷 · 妖蟒 ──
{
  const cv = new Canvas()
  shadow(cv, 80, 150, 60)
  tube(cv, 'M140 140C170 130 160 108 120 110C80 112 50 124 60 138C70 150 120 150 140 140', 16, C.grass2, C.grass4, [[40, 100], [170, 152]])
  tube(cv, 'M120 110C150 98 140 76 110 80C84 84 70 70 60 56C52 44 48 36 40 34', 18, C.grass2, C.grass4, [[30, 30], [150, 112]])
  // 头
  cv.path('M44 36C40 22 26 18 14 24C6 28 2 34 4 40C14 44 30 46 44 36Z', `fill="${C.grass2}" ${L}`)
  cv.path('M4 40C14 42 28 42 40 38', `fill="none" ${T}`)
  cv.path('M6 38l-6 4m6 -4l-6 0', `stroke="${C.red2}" stroke-width="2" stroke-linecap="round"`)
  cv.path('M24 22l6 -6 2 8z', `fill="${C.grass3}" ${T}`)
  eye(cv, 22, 29, 3)
  out('monster/ch1-serpent.svg', cv)
}

// ── 乱星海 · 海蛟 ──
{
  const cv = new Canvas()
  cv.def(lin('wave', [[0, C.blue2], [1, C.blue0]]))
  const body = 'M170 110C150 70 120 120 96 96C74 74 60 50 40 44'
  for (let i = 0; i < 6; i++) { const t = i / 5; const x = 160 - t * 110, y = 96 - Math.sin(t * Math.PI) * 18 - t * 30; cv.path(`M${x - 8} ${y}L${x - 2} ${y - 20}L${x + 6} ${y - 2}Z`, `fill="${C.jade2}" ${T}`, [[x - 8, y - 22]]) }
  tube(cv, body, 20, C.blue2, C.blue3, [[30, 40], [176, 116]])
  // 头 + 须
  cv.path('M52 44C46 26 24 22 10 32C2 38 0 46 4 52C18 56 40 56 52 44Z', `fill="${C.blue2}" ${L}`)
  cv.path('M34 26C36 14 46 8 56 8C48 14 46 20 46 28Z', `fill="${C.jade2}" ${L}`)
  cv.path('M8 50C0 60 4 72 14 76M16 54C12 62 16 70 24 72', `fill="none" stroke="${C.jade3}" stroke-width="2.4" stroke-linecap="round"`)
  cv.path('M6 50l4 5 3 -5 3 5', `fill="#fff" ${T}`)
  eye(cv, 26, 38, 3.4)
  // 浪
  cv.path('M20 150C40 120 60 140 72 124C80 140 100 120 116 132C128 118 150 130 176 116L180 156H16Z', `fill="url(#wave)" ${L}`, [[16, 116], [180, 156]])
  cv.path('M40 134q8 -8 16 0M96 132q8 -8 16 0M140 128q8 -8 16 0', `fill="none" stroke="${C.jade4}" stroke-width="2" stroke-linecap="round"`)
  out('monster/ch2-leviathan.svg', cv)
}

// ── 落霞涧 · 赤焰雕 ──
{
  const cv = new Canvas()
  cv.def(glow('g', C.fire2, 0.55))
  cv.ellipse(84, 80, 84, 70, 'fill="url(#g)"')
  const feather = (d, c) => cv.path(d, `fill="${c}" ${L}`)
  // 远翼
  feather('M96 70C110 40 140 16 170 10C160 24 166 30 150 40C164 40 160 50 144 56C154 60 146 70 120 80Z', C.fire0)
  // 尾焰
  feather('M110 96C130 112 150 140 176 150C160 150 150 146 142 140C150 156 140 158 130 146C132 160 120 156 116 140C112 130 104 116 100 104Z', C.fire1)
  cv.path('M118 116C130 128 140 138 156 146', `fill="none" stroke="${C.fire3}" stroke-width="2" stroke-linecap="round"`)
  // 身体
  cv.path('M50 72C60 56 90 58 106 72C118 84 112 104 94 108C74 112 54 100 50 72Z', `fill="${C.fire1}" ${L}`)
  cv.path('M56 84C66 96 82 102 96 100', `fill="none" stroke="${C.fire3}" stroke-width="2.2" stroke-linecap="round"`)
  // 近翼
  feather('M70 70C60 36 70 10 96 0C92 14 100 16 92 28C104 22 108 30 98 40C110 38 110 50 96 56C104 60 96 70 84 76Z', C.fire2)
  cv.path('M80 64C76 44 82 24 94 10M86 66C88 52 96 40 104 36', `fill="none" stroke="${C.fire3}" stroke-width="1.6" stroke-linecap="round"`)
  // 头 + 冠
  cv.path('M58 66C50 50 34 48 26 56C22 60 14 62 8 66C16 70 24 72 30 74C42 80 56 78 58 66Z', `fill="${C.fire1}" ${L}`)
  cv.path('M8 66L20 62L22 70Z', `fill="${C.gold2}" ${T}`)
  cv.path('M34 52C30 38 36 30 44 28C40 36 42 42 46 48ZM42 50C42 40 50 34 56 34C52 40 52 46 54 52Z', `fill="${C.fire3}" ${L}`)
  eye(cv, 32, 60, 2.8, C.gold4)
  // 爪
  cv.path('M74 108l-4 14M88 108l2 14', `stroke="${C.line}" stroke-width="3.4" stroke-linecap="round"`)
  out('monster/ch3-firebird.svg', cv)
}

// ── 太岳山脉 · 镇山巨猿（正面）──
{
  const cv = new Canvas()
  const fur = C.wood1, furL = C.wood2
  shadow(cv, 80, 152, 62)
  // 腿
  cv.path('M52 112C44 126 44 140 46 150H72L74 120Z', `fill="${fur}" ${L}`)
  cv.path('M108 112C116 126 116 140 114 150H88L86 120Z', `fill="${fur}" ${L}`)
  // 手臂（长，拳着地）
  cv.path('M44 56C24 64 16 96 20 132L40 134C40 106 46 86 56 74Z', `fill="${fur}" ${L}`)
  cv.path('M116 56C136 64 144 96 140 132L120 134C120 106 114 86 104 74Z', `fill="${fur}" ${L}`)
  for (const x of [30, 130]) {
    cv.path(`M${x - 16} ${146}C${x - 18} ${126} ${x + 18} ${126} ${x + 16} ${146}Z`, `fill="${C.wood2}" ${L}`, [[x - 18, 124], [x + 18, 148]])
    cv.path(`M${x - 8} 146v-7M${x} 146v-8M${x + 8} 146v-7`, `stroke="${C.line}" stroke-width="1.4"`)
  }
  // 躯干
  cv.path('M40 60C50 40 110 40 120 60C126 86 116 118 80 122C44 118 34 86 40 60Z', `fill="${furL}" ${L}`)
  cv.path('M58 66C66 60 94 60 102 66C104 86 96 106 80 108C64 106 56 86 58 66Z', `fill="${C.wood3}" ${T}`)
  // 符纹
  cv.path('M64 76h32M80 70v34M68 92h24', `stroke="${C.gold3}" stroke-width="2.4" stroke-linecap="round"`)
  cv.path('M46 70l-6 20M114 70l6 20', `stroke="${C.gold3}" stroke-width="2" stroke-linecap="round" stroke-opacity=".8"`)
  // 头
  cv.path('M60 44C58 26 70 16 80 16C90 16 102 26 100 44C100 56 92 62 80 62C68 62 60 56 60 44Z', `fill="${fur}" ${L}`)
  cv.path('M66 42C66 34 94 34 94 42C96 54 88 58 80 58C72 58 64 54 66 42Z', `fill="${C.wood3}" ${T}`)
  cv.path('M64 34h32', `stroke="${C.line}" stroke-width="4" stroke-linecap="round"`)
  eye(cv, 72, 40, 2.6); eye(cv, 88, 40, 2.6)
  cv.path('M72 52q8 4 16 0', `fill="none" ${T}`)
  cv.path('M74 52l2 4 2 -4M82 52l2 4 2 -4', `fill="#fff" ${T}`)
  out('monster/ch4-ape.svg', cv)
}

// ── 万毒岭 · 九首毒蟒（画三首）──
{
  const cv = new Canvas()
  cv.def(glow('g', C.grass4, 0.35))
  cv.ellipse(90, 130, 80, 30, 'fill="url(#g)"')
  shadow(cv, 90, 152, 64)
  const necks = ['M100 136C96 100 70 90 50 72C40 62 36 52 32 44', 'M110 132C112 96 104 70 96 48C92 38 94 28 96 20', 'M120 136C136 104 150 90 160 70C164 60 164 52 162 46']
  const heads = [[32, 44, 1], [96, 20, 0], [162, 46, -1]]
  for (const d of necks) tube(cv, d, 14, C.purple1, C.purple3, [[30, 18], [166, 140]])
  cv.path('M50 150C50 120 90 110 110 112C140 112 170 124 170 150Z', `fill="${C.purple1}" ${L}`)
  cv.path('M70 140C90 128 130 126 156 140', `fill="none" stroke="${C.purple3}" stroke-width="3" stroke-dasharray="3 6" stroke-linecap="round"`)
  for (const [x, y, dir] of heads) {
    const s = dir === 0 ? 1 : 1
    cv.add(`<g transform="translate(${x} ${y}) scale(${dir === -1 ? -1 : 1} 1)">
      <path d="M8 4C6 -10 -8 -14 -20 -8C-26 -4 -30 2 -28 6C-18 10 -2 12 8 4Z" fill="${C.purple2}" ${L}/>
      <path d="M-28 6C-20 8 -8 8 4 4" fill="none" ${T}/>
      <path d="M-26 6l2 5 2 -5M-18 7l2 5 2 -5" fill="#fff" ${T}/>
      <circle cx="-12" cy="-3" r="5.5" fill="${C.grass4}" fill-opacity=".35"/><circle cx="-12" cy="-3" r="2.8" fill="${C.grass4}" ${T}/>
      <path d="M-4 -10l4 -8 3 8z" fill="${C.purple3}" ${T}/></g>`, [[x - 32 * s, y - 20], [x + 32, y + 16]])
  }
  cv.path('M26 60q-2 6 0 10M92 32q-2 6 0 10', `stroke="${C.grass4}" stroke-width="2.6" stroke-linecap="round"`)
  out('monster/ch5-hydra.svg', cv)
}

// ── 幽冥谷 · 化形阴尸（悬浮鬼影）──
{
  const cv = new Canvas()
  cv.def(glow('g', C.jade3, 0.55))
  cv.def(lin('robe', [[0, '#4d6660'], [1, '#1c2a2a', 0.2]]))
  cv.ellipse(70, 80, 70, 80, 'fill="url(#g)"')
  // 袍（下摆破碎飘散）
  cv.path('M44 44C30 70 24 110 16 150L30 138L38 156L50 140L62 158L74 142L86 156L96 138L112 150C104 110 98 70 84 44Z', `fill="url(#robe)" ${L}`, [[16, 44], [112, 158]])
  cv.path('M64 60V140', `stroke="${C.jade3}" stroke-opacity=".35" stroke-width="2"`)
  // 兜帽 + 脸
  cv.path('M40 50C36 20 52 6 64 6C78 6 94 20 88 50C80 56 48 56 40 50Z', `fill="#3a504c" ${L}`)
  cv.path('M50 46C48 30 56 22 64 22C74 22 80 30 78 46C72 50 56 50 50 46Z', `fill="${C.ink}"`)
  cv.circle(57, 36, 3, `fill="${C.jade4}"`); cv.circle(71, 36, 3, `fill="${C.jade4}"`)
  cv.circle(57, 36, 7, `fill="${C.jade3}" fill-opacity=".35"`); cv.circle(71, 36, 7, `fill="${C.jade3}" fill-opacity=".35"`)
  // 骨手 + 锁链
  for (const [x, y, s] of [[26, 84, -1], [102, 80, 1]]) {
    cv.path(`M${x - s * 12} ${y - 14}C${x - s * 4} ${y - 8} ${x} ${y - 4} ${x} ${y}`, `fill="none" stroke="#3a504c" stroke-width="12" stroke-linecap="round"`)
    cv.path(`M${x} ${y}l${s * 8} 6M${x} ${y}l${s * 10} 0M${x} ${y}l${s * 8} -6`, `stroke="${C.stone4}" stroke-width="2.4" stroke-linecap="round"`)
  }
  for (let i = 0; i < 5; i++) cv.ellipse(20 - i * 3, 96 + i * 9, 3.4, 4.6, `fill="none" stroke="${C.stone2}" stroke-width="2"`)
  // 鬼火
  for (const [x, y] of [[124, 40], [14, 30], [118, 120]]) {
    cv.path(`M${x} ${y + 8}C${x - 7} ${y + 4} ${x - 4} ${y - 6} ${x} ${y - 12}C${x + 4} ${y - 6} ${x + 7} ${y + 4} ${x} ${y + 8}Z`, `fill="${C.jade3}" ${T}`, [[x - 8, y - 12], [x + 8, y + 8]])
    cv.circle(x, y + 2, 2.4, `fill="${C.jade4}"`)
  }
  out('monster/ch6-undead.svg', cv)
}

// ── 星落原 · 坠星天兽 ──
{
  const cv = new Canvas()
  cv.def(glow('g', C.purple2, 0.5))
  cv.ellipse(88, 80, 90, 70, 'fill="url(#g)"')
  quadruped(cv, { body: C.blue1, belly: C.purple2, dark: C.blue0, accent: C.purple3, spikes: C.purple3, tail: 'flame', head: 'qilin' })
  for (const [x, y, r] of [[20, 16, 5], [150, 20, 4], [170, 100, 3.4], [100, 8, 3]]) cv.path(`M${x} ${y - r * 2}L${x + r * 0.5} ${y - r * 0.5}L${x + r * 2} ${y}L${x + r * 0.5} ${y + r * 0.5}L${x} ${y + r * 2}L${x - r * 0.5} ${y + r * 0.5}L${x - r * 2} ${y}L${x - r * 0.5} ${y - r * 0.5}Z`, `fill="${C.gold4}"`, [[x - r * 2, y - r * 2], [x + r * 2, y + r * 2]])
  for (const [x, y] of [[80, 76], [100, 84], [118, 74]]) cv.circle(x, y, 2.4, `fill="${C.gold4}"`)
  out('monster/ch8-starbeast.svg', cv)
}

// ── 宗门合围 · 结丹期凶兽（狻猊）──
{
  const cv = new Canvas()
  cv.def(glow('g', C.fire2, 0.4))
  cv.ellipse(88, 80, 90, 70, 'fill="url(#g)"')
  quadruped(cv, { body: C.jade0, belly: C.jade1, dark: C.ink2, mane: C.gold1, accent: C.gold3, tail: 'whip', head: 'lion' })
  cv.path('M80 72l10 6 -4 10M104 70l8 8', `fill="none" stroke="${C.fire2}" stroke-width="2.4" stroke-linecap="round"`)
  out('monster/jiedan-beast.svg', cv)
}
