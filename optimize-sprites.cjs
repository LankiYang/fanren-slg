// 凡人修仙 SLG · 精灵图压缩工具
// AI 生图出来是 1400×768 上下的 PNG，单张 1~2MB，但 UI 里最大的建筑也只占屏宽 32%
// （.app 封顶 480px → 约 154 CSS px），分辨率浪费了一个数量级，首屏加载扛不住。
// 本工具把 art/masters/ 下的 PNG 母版按各自用途降采样并转 WebP，输出到 src/assets/sprites/。
// 母版不参与打包，改素材时重跑本脚本即可；PNG 那条生产流水线（gen-image → remove-bg → trim）产物直接进 masters。
// 用法：node optimize-sprites.cjs
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const SRC = path.join(__dirname, 'art/masters')
const OUT = path.join(__dirname, 'src/assets/sprites')

/**
 * 各类素材的最大边长，按实际渲染尺寸 ×3（覆盖 3x DPR 屏）留的余量：
 * - building 场景里最大 32% 屏宽 ≈ 154px
 * - cultivator/troop/monster 都走 .card img.thumb，54×54
 * - icon 顶栏 20×20、消耗行 16×16，给 128 已经很宽裕
 */
const MAX_EDGE = {
  building: 512,
  cultivator: 256,
  troop: 256,
  // monster 除了卡片缩略图，还在战报/合围里放大到约 60% 屏宽（≈225px），故给 512
  monster: 512,
  icon: 128,
  // item 用在 .card img.thumb（54×54）和消耗行，与 icon 同档
  item: 128,
  // ui 是底栏 tab 图标，渲染 22×22
  ui: 96,
  // guide 是新手引导立绘，渲染最大 168px 宽，是全局最大的人物展示
  guide: 512,
}
/** 兜底：新增分类忘了配置时按建筑档处理，不至于输出一张原尺寸巨图 */
const DEFAULT_EDGE = 512

/**
 * bg 是唯一按高度限制的：横图（1376×768）用 object-fit:cover 填竖屏（375×705），
 * cover 取 max(盒宽/图宽, 盒高/图高)，绑定轴是高度不是宽度——按宽度限 1024 会把高度压到
 * 572，反而被放大 1.23× 显得发虚。母版本身只有 768 高，所以原样保住高度就是上限。
 */
const BG_MAX_HEIGHT = 768

/** 抠过底的素材边缘是羽化的，alphaQuality 拉满避免边缘出现锯齿/脏边 */
const WEBP_ALPHA = { quality: 82, alphaQuality: 100, effort: 6 }
/** 背景图无 alpha 通道，且上面盖了一层暗色渐变，质量可以再低一档 */
const WEBP_OPAQUE = { quality: 80, effort: 6 }

async function convert(rel) {
  const inFile = path.join(SRC, rel)
  const outFile = path.join(OUT, rel.replace(/\.png$/i, '.webp'))
  const kind = rel.split(path.sep)[0]
  // bg 只限高（见 BG_MAX_HEIGHT 注释），其余按最大边长等比缩
  const box = kind === 'bg'
    ? { width: null, height: BG_MAX_HEIGHT }
    : { width: MAX_EDGE[kind] ?? DEFAULT_EDGE, height: MAX_EDGE[kind] ?? DEFAULT_EDGE }

  const src = sharp(inFile)
  const meta = await src.metadata()
  const opaque = !meta.hasAlpha

  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  await src
    .resize(box.width, box.height, { fit: 'inside', withoutEnlargement: true })
    .webp(opaque ? WEBP_OPAQUE : WEBP_ALPHA)
    .toFile(outFile)

  const after = await sharp(outFile).metadata()
  return {
    outFile,
    from: `${meta.width}×${meta.height}`,
    to: `${after.width}×${after.height}`,
    beforeBytes: fs.statSync(inFile).size,
    afterBytes: fs.statSync(outFile).size,
  }
}

// ── 入口 ──
const walk = (d, base = '') =>
  fs.readdirSync(d).flatMap((f) => {
    const p = path.join(d, f)
    return fs.statSync(p).isDirectory() ? walk(p, path.join(base, f)) : [path.join(base, f)]
  })

;(async () => {
  if (!fs.existsSync(SRC)) {
    console.log(`❌ 找不到母版目录 ${SRC}`)
    process.exit(1)
  }
  const files = walk(SRC).filter((f) => /\.png$/i.test(f))
  let before = 0
  let after = 0

  for (const rel of files) {
    try {
      const r = await convert(rel)
      before += r.beforeBytes
      after += r.afterBytes
      const kb = (n) => (n / 1024).toFixed(0).padStart(5) + 'KB'
      console.log(`✅ ${rel.replace(/\\/g, '/').padEnd(34)} ${r.from.padStart(9)} → ${r.to.padStart(9)}  ${kb(r.beforeBytes)} →${kb(r.afterBytes)}`)
    } catch (e) {
      console.log(`❌ ${rel}: ${e.message}`)
    }
  }

  const mb = (n) => (n / 1048576).toFixed(2) + 'MB'
  console.log(`\n${files.length} 张：${mb(before)} → ${mb(after)}（${(100 - (after / before) * 100).toFixed(1)}% 减重）`)
})()
