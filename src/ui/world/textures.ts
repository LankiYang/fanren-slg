import * as THREE from 'three'

/** 程序化云团：多枚柔和圆斑叠成的积云，底部淡出（无硬边，适合 3D 里任意角度观看） */
export function cloudTexture(seed = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128
  const g = c.getContext('2d')!
  let s = seed * 9301 + 49297
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  for (let i = 0; i < 14; i++) {
    const x = 40 + r() * 176, y = 50 + r() * 34, rad = 22 + r() * 30
    const grd = g.createRadialGradient(x, y - rad * 0.2, 0, x, y, rad)
    grd.addColorStop(0, 'rgba(255,253,245,0.95)'); grd.addColorStop(0.55, 'rgba(240,244,238,0.6)'); grd.addColorStop(1, 'rgba(230,238,234,0)')
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill()
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
