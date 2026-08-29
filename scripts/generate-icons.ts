import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

const APP_SIZE = 1024
const MARGIN = 0.16
/** Matches --background in src/index.css so the icon plate and app agree. */
const APP_BACKGROUND = { r: 16, g: 17, b: 20, alpha: 1 }
/**
 * macOS / iOS icon corner radius as a fraction of the canvas. Applied as an
 * alpha mask so the Dock shows through the corners during `tauri dev`, which
 * does not run the system squircle mask used for packaged `.app` icons.
 */
const ICON_CORNER_RATIO = 0.2237

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'src', 'assets', 'pixen-logo.svg')
const iconsDir = join(root, 'src-tauri', 'icons')
const appIconPath = join(iconsDir, 'app-icon.png')

function rasterize(svg: Buffer, fit: number): Buffer {
  return Buffer.from(
    new Resvg(svg, {
      fitTo: { mode: 'height', value: fit },
    })
      .render()
      .asPng(),
  )
}

async function padToSquare(png: Buffer, size: number): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: APP_BACKGROUND,
    },
  })
    .composite([{ input: png, gravity: 'center' }])
    .png()
    .toBuffer()
}

async function applyRoundedMask(png: Buffer, size: number): Promise<Buffer> {
  const radius = Math.round(size * ICON_CORNER_RATIO)
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/>` +
      `</svg>`,
  )

  return sharp(png)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

function runTauriIcon(source: string): void {
  const tauri = join(root, 'node_modules', '.bin', 'tauri')
  const cargoBin = join(homedir(), '.cargo', 'bin')
  const result = spawnSync(tauri, ['icon', source], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `${cargoBin}:${process.env.PATH ?? ''}`,
    },
  })

  if (result.status !== 0) {
    throw new Error('tauri icon failed')
  }
}

async function generate(): Promise<void> {
  const svg = readFileSync(svgPath)
  const inner = Math.round(APP_SIZE * (1 - MARGIN * 2))

  mkdirSync(iconsDir, { recursive: true })

  const plated = await padToSquare(rasterize(svg, inner), APP_SIZE)
  writeFileSync(appIconPath, await applyRoundedMask(plated, APP_SIZE))
  runTauriIcon(appIconPath)
}

await generate()
