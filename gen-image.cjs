// ═══ 凡人修仙 SLG · 通用生图工具 ═══
// 用法：
//   node gen-image.cjs "提示词"                     → 生成并保存到 art/masters/generated-<时间戳>.png
//   node gen-image.cjs "提示词" -o art/masters/xxx.png  → 指定保存路径
//   node gen-image.cjs --list                       → 显示内置素材模板（角色/兵种/怪物/场景…可直接引用）
//   node gen-image.cjs --template="角色·韩立(占位)"   → 用内置模板生成
//   node gen-image.cjs --batch batch.json           → 批量生成（json: [{prompt, out}...]）
//
// 内置角色模板只用了 README「核实状态」里标为高置信的特征（谨慎低调、非天才型），
// 不包含未核实的外貌/门派细节——原著角色目前只是内部占位符，见 fanren-slg/README.md。
//
// 生成的是有背景的图 → 之后用 node remove-bg.cjs 抠掉白底
// PNG 各阶段都在 art/masters/ 里进行，最后由 optimize-sprites.cjs 转成 src/assets/sprites/ 下的 WebP
const https = require('https')
const fs = require('fs')
const path = require('path')

// 密钥从 .env 读（.env 已在 .gitignore 里，不会进仓库），本地开发用；
// 手动解析而不引入 dotenv 依赖，反正只是一次性开发工具脚本
try {
  const envPath = path.join(__dirname, '.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  }
} catch { /* ignore */ }

const API_KEY = process.env.CLOUDSWAY_API_KEY
if (!API_KEY) {
  console.log('❌ 未设置 CLOUDSWAY_API_KEY，在项目根目录建一个 .env 文件写入：CLOUDSWAY_API_KEY=你的密钥')
  process.exit(1)
}
const API_HOST = 'genaiapi-m2.cloudsway.net'
const API_PATH = '/v1/chat/completions'
const API_MODEL = 'MaaS_Ge_3.1_flash_image_20260528'
const OUT_DIR = path.join(__dirname, 'art/masters')

// ── 统一风格后缀：所有素材保持同一种质感 ──
//
// 凡是要过 remove-bg.cjs 抠图流程的素材，背景描述必须用 WHITE_BG_STRICT，
// 不能只写 "PLAIN SOLID WHITE BACKGROUND" 就完事。
// 教训：南宫婉指引姿态那张图角落被模型加了圈若隐若现的暗角，
// 抠图脚本从四角取样算出的背景色变成了 [224,227,230] 而非纯白，
// 颜色阈值一松，浅色皮肤被判成候选背景，flood-fill 顺着头发缝隙连通到脸上，
// 脸被削掉一块——这是从生图源头就没控制干净，不是抠图算法的锅，
// 抠图算法再怎么打补丁也补不出一张它拿到的就是脏背景的图。
const WHITE_BG_STRICT = 'THE BACKGROUND MUST BE PURE FLAT SOLID WHITE, RGB 255 255 255, EXACTLY THE SAME BRIGHTNESS IN EVERY CORNER AND ALONG EVERY EDGE OF THE IMAGE. absolutely no vignette, no darkening at the corners or edges, no grey tint, no gradient, no soft shadow anywhere on the background — a completely flat uniform white canvas. All dramatic lighting and shading must be confined to the subject only, never touching the background. no ground shadow, no text.'

const STYLE_PORTRAIT = 'semi-realistic anime illustration, bust portrait, centered composition, dynamic lighting, Chinese xianxia cultivation fantasy theme, faint spiritual qi aura, simple dark gradient background, detailed cultivator robes, vibrant colors, game gacha splash art quality'
const STYLE_MONSTER = 'pixel art sprite, side view, chibi style, 64x64 pixel proportions, transparent background, game asset, Chinese xianxia fantasy theme, spirit beast, warm color palette, clean pixel edges'
const STYLE_ITEM = 'pixel art icon, centered, simple background, game item icon, Chinese xianxia cultivation theme, clean edges, vibrant colors'
const STYLE_SCENE = 'painterly game background scene, Chinese xianxia ink-wash mountain landscape, misty peaks, warm dramatic color palette, no characters, no people, wide landscape orientation, atmospheric depth'

// ── 内置素材模板（省记 prompt 的常用素材）──
// 角色模板只写高置信特征（谨慎低调、朴素、非天才型），不编造未核实的外貌细节
const TEMPLATES = {
  '角色·韩立(占位)': { style: STYLE_PORTRAIT, prompt: () => `A young male mortal-turned-cultivator, plain and humble cultivator robes, cautious and wary expression, understated presence rather than flashy, calculating eyes, low-key aura instead of overwhelming power, Chinese xianxia cultivation novel protagonist.` },
  '角色·南宫婉(占位)': { style: STYLE_PORTRAIT, prompt: () => `A young female cultivator, elegant traditional Chinese hanfu-style robes, calm and composed expression, graceful bearing, faint spiritual qi aura, Chinese xianxia cultivation novel style.` },
  '兵种·傀儡兵': { style: STYLE_PORTRAIT, prompt: () => `A puppet warrior construct, wooden and metal body covered in glowing talisman seals, heavy armored build, standing guard pose, Chinese xianxia cultivation puppet-dao aesthetic.` },
  '兵种·御兽军': { style: STYLE_PORTRAIT, prompt: () => `A cultivator riding a fierce spirit beast mount, mid-charge dynamic pose, beast with qi-infused fur and claws, rider holding a talisman weapon, Chinese xianxia cultivation theme.` },
  '兵种·符修弓阵': { style: STYLE_PORTRAIT, prompt: () => `A talisman archer cultivator, drawing a bow made of glowing spirit energy, floating talismans orbiting around, focused precise stance, Chinese xianxia cultivation theme.` },
  '怪物·结丹妖兽': { style: STYLE_MONSTER, prompt: () => `A mid-tier spirit beast monster, core-formation stage strength, scaled hide with glowing qi veins, aggressive stance, Chinese xianxia mythological beast.` },
  '场景·洞府': { style: STYLE_SCENE, prompt: () => `A cultivator's cave dwelling (dongfu) carved into a misty mountain cliff, spirit energy formations glowing at the entrance, bamboo and pine trees, tranquil secluded atmosphere, Chinese xianxia fantasy setting.` },
  '场景·秘境入口': { style: STYLE_SCENE, prompt: () => `The entrance to a mysterious secret realm (mijing), an ancient stone archway with swirling spatial energy barrier, ruins overgrown with luminescent moss, ominous yet alluring atmosphere, Chinese xianxia fantasy setting.` },
  '图标·灵石': { style: STYLE_ITEM, prompt: () => `A glowing spirit stone (lingshi) crystal, faceted gem shape, soft inner blue-white light, game currency icon.` },
}

function generateImage(prompt, outputPath) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      temperature: 1,
      model: API_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    })
    const options = {
      hostname: API_HOST, path: API_PATH, method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        try {
          const data = JSON.parse(body)
          if (data.error) return reject(new Error(JSON.stringify(data.error)))
          const images = data.choices?.[0]?.message?.images || []
          let saved = false
          for (const img of images) {
            const url = img.image_url?.url || ''
            const m = url.match(/^data:image\/\w+;base64,(.+)$/)
            if (m) {
              const buf = Buffer.from(m[1], 'base64')
              fs.mkdirSync(path.dirname(outputPath), { recursive: true })
              fs.writeFileSync(outputPath, buf)
              console.log(`  ✅ ${path.basename(outputPath)} (${(buf.length / 1024).toFixed(0)}KB)`)
              saved = true
            }
          }
          if (!saved) reject(new Error('响应中没有图片: ' + body.slice(0, 300)))
          else resolve(outputPath)
        } catch (e) { reject(new Error(e.message)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('timeout')) })
    req.write(postData)
    req.end()
  })
}

async function main() {
  const argv = process.argv.slice(2)

  // --list 显示模板
  if (argv.includes('--list')) {
    console.log('内置模板：')
    for (const k of Object.keys(TEMPLATES)) console.log(`  ${k}`)
    console.log('\n用法示例：')
    console.log('  node gen-image.cjs --template="怪物·结丹妖兽"')
    console.log('  node gen-image.cjs "自定义提示词" -o art/masters/generated/xxx.png')
    return
  }

  // 批量
  const batchIdx = argv.findIndex(a => a === '--batch')
  if (batchIdx >= 0) {
    const file = argv[batchIdx + 1]
    const tasks = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const t of tasks) {
      console.log(`生成: ${t.name ?? t.out}`)
      try { await generateImage(t.prompt, path.join(OUT_DIR, t.out)) }
      catch (e) { console.log(`  ❌ ${e.message}`) }
    }
    return
  }

  // 模板 or 直接提示词
  const tmplIdx = argv.findIndex(a => a.startsWith('--template='))
  let prompt, outPath
  if (tmplIdx >= 0) {
    const key = argv[tmplIdx].slice('--template='.length)
    const t = Object.keys(TEMPLATES).find(k => k.includes(key))
    if (!t) { console.log(`❌ 无模板匹配 "${key}"，--list 查看`); return }
    prompt = TEMPLATES[t].prompt(key) + ', ' + TEMPLATES[t].style
  } else {
    prompt = argv[0]
    if (!prompt) { console.log('用法：node gen-image.cjs "提示词" 或 --template=xxx'); return }
    // 追加统一风格（可选：如果提示词没带风格后缀）
    if (!prompt.includes(',')) prompt += ', pixel art game asset, Chinese xianxia fantasy theme'
  }

  // 输出路径
  // -o 按「项目根目录相对」解析（如 -o art/masters/x.png）；
  // 不传 -o 时落到 OUT_DIR/generated/ 下。
  // 注意：早期版本把 -o 也拼到 OUT_DIR 上，会写出 masters/art/masters/… 的嵌套路径。
  const oi = argv.findIndex(a => a === '-o')
  if (oi >= 0) {
    const given = argv[oi + 1]
    if (!given) { console.log('❌ -o 后面要跟输出路径'); return }
    outPath = path.isAbsolute(given) ? given : path.join(__dirname, given)
  } else {
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    outPath = path.join(OUT_DIR, `generated/图-${ts}.png`)
  }

  console.log(`生成: ${JSON.stringify(prompt).slice(0, 80)}…`)
  try { await generateImage(prompt, outPath) }
  catch (e) { console.log(`❌ ${e.message}`) }
}

main().catch(console.error)
