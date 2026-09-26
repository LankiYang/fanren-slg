/** WebGL 是否可用（不可用时洞府、战区退回 2D 背景）。放在独立小文件里，避免为了探测而提前加载 three.js。 */
let cached: boolean | null = null
export function webglAvailable(): boolean {
  if (cached !== null) return cached
  try {
    const c = document.createElement('canvas')
    cached = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch { cached = false }
  return cached
}
