import { createCanvas } from 'canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sizes = [16, 32, 48, 128]

const iconsDir = path.join(__dirname, 'public', 'icons')
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir)

for (const size of sizes) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  const radius = size * 0.18

  ctx.fillStyle = '#0d0d14'
  ctx.beginPath()
  ctx.moveTo(radius, 0)
  ctx.lineTo(size - radius, 0)
  ctx.quadraticCurveTo(size, 0, size, radius)
  ctx.lineTo(size, size - radius)
  ctx.quadraticCurveTo(size, size, size - radius, size)
  ctx.lineTo(radius, size)
  ctx.quadraticCurveTo(0, size, 0, size - radius)
  ctx.lineTo(0, radius)
  ctx.quadraticCurveTo(0, 0, radius, 0)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#00d4aa'
  ctx.lineWidth = size * 0.06
  ctx.stroke()

  ctx.fillStyle = '#00d4aa'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (size <= 16) {
    ctx.font = `bold ${size * 0.52}px monospace`
    ctx.fillText('CF', size / 2, size / 2 + size * 0.03)
  } else if (size <= 32) {
    ctx.font = `bold ${size * 0.48}px monospace`
    ctx.fillText('CF', size / 2, size / 2 + size * 0.03)
  } else {
    ctx.font = `bold ${size * 0.42}px monospace`
    ctx.fillText('CF', size / 2, size / 2 + size * 0.03)
  }

  const buffer = canvas.toBuffer('image/png')
  const outPath = path.join(iconsDir, `icon${size}.png`)
  fs.writeFileSync(outPath, buffer)
  console.log(`Generated icon${size}.png`)
}