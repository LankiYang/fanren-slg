// 凡人修仙 SLG · 精灵图裁边工具
// 抠完背景后图片四周会留下大片全透明像素，导致在 UI 里按百分比宽度渲染时主体显得很小。
// 本工具把 PNG 裁剪到「非透明像素的最小包围盒」，保留一点边距。
// 用法：node trim.cjs [文件路径...]  （无参数则处理 art/masters 下除 bg/ 外的全部 PNG）
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function decodePNG(file) {
  const buf = fs.readFileSync(file)
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9] }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    off += 12 + len
  }
  if (bitDepth !== 8) throw new Error('unsupported bitDepth ' + bitDepth)
  if (colorType !== 2 && colorType !== 6) throw new Error('unsupported colorType ' + colorType)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const channels = colorType === 6 ? 4 : 3
  const stride = width * channels
  const px = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null
    const cur = px.subarray(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prev ? prev[x] : 0
      const c = x >= channels && prev ? prev[x - channels] : 0
      let v = row[x]
      if (filter === 1) v = (v + a) & 0xff
      else if (filter === 2) v = (v + b) & 0xff
      else if (filter === 3) v = (v + Math.floor((a + b) / 2)) & 0xff
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
      }
      cur[x] = v
    }
  }
  return { width, height, channels, px }
}

function encodePNG(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    let crc = 0xffffffff
    for (const byte of td) {
      crc ^= byte
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([len, td, crcBuf])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** alpha 低于该值视为空白（抠图后的羽化边缘不算主体） */
const ALPHA_THRESHOLD = 12
/** 裁剪后四周保留的边距像素 */
const PADDING = 4

function trim(file) {
  const { width: W, height: H, channels: ch, px } = decodePNG(file)
  if (ch !== 4) throw new Error('需要带 alpha 通道的 PNG（先跑 remove-bg.cjs）')

  let minX = W, minY = H, maxX = -1, maxY = -1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[(y * W + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error('整张图都是透明的')

  minX = Math.max(0, minX - PADDING); minY = Math.max(0, minY - PADDING)
  maxX = Math.min(W - 1, maxX + PADDING); maxY = Math.min(H - 1, maxY + PADDING)

  const nw = maxX - minX + 1, nh = maxY - minY + 1
  const out = Buffer.alloc(nw * nh * 4)
  for (let y = 0; y < nh; y++) {
    px.copy(out, y * nw * 4, ((minY + y) * W + minX) * 4, ((minY + y) * W + minX + nw) * 4)
  }
  return { width: nw, height: nh, rgba: out, origW: W, origH: H }
}

// ── 入口 ──
const targets = process.argv.slice(2)
const SPRITES = path.join(__dirname, 'art/masters')
let files = []
if (targets.length > 0) {
  files = targets
} else if (fs.existsSync(SPRITES)) {
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f)
      if (fs.statSync(p).isDirectory()) {
        if (path.basename(p) === 'bg' || path.basename(p) === 'generated') continue // 背景图是整图，不裁
        walk(p)
      } else if (f.endsWith('.png')) files.push(p)
    }
  }
  walk(SPRITES)
}

for (const f of files) {
  try {
    const { width, height, rgba, origW, origH } = trim(f)
    if (width === origW && height === origH) {
      console.log(`·  ${path.basename(f)} — 无需裁剪`)
      continue
    }
    fs.writeFileSync(f, encodePNG(width, height, rgba))
    console.log(`✅ ${path.basename(f)} — ${origW}×${origH} → ${width}×${height}`)
  } catch (e) {
    console.log(`❌ ${path.basename(f)}: ${e.message}`)
  }
}
