import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

/**
 * Apple's macOS icon grid: a 824 px rounded plate centred on a 1024 px canvas,
 * with the remaining 100 px ring left transparent. Keeping to the grid is what
 * makes the icon read at the same size as every other app in the Dock.
 */
const ICON_SIZE = 1024
const PLATE_SIZE = 824
const PLATE_CORNER_RADIUS = 185
/** Breathing room between the plate edge and the mark. */
const MARK_MARGIN = 0.16
/** Matches --background in src/index.css so the icon plate and app agree. */
const APP_BACKGROUND = { r: 16, g: 17, b: 20, alpha: 1 }
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

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

/**
 * The mark on its dark plate, clipped to rounded corners. The clip is baked in
 * rather than left to the OS because `tauri dev` runs a bare binary, which
 * macOS shows without the squircle mask it applies to packaged `.app` icons.
 */
async function buildPlate(mark: Buffer): Promise<Buffer> {
  const filled = await sharp({
    create: {
      width: PLATE_SIZE,
      height: PLATE_SIZE,
      channels: 4,
      background: APP_BACKGROUND,
    },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()

  const corners = Buffer.from(
    `<svg width="${PLATE_SIZE}" height="${PLATE_SIZE}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${PLATE_SIZE}" height="${PLATE_SIZE}" rx="${PLATE_CORNER_RADIUS}" ` +
      `ry="${PLATE_CORNER_RADIUS}" fill="#fff"/>` +
      `</svg>`,
  )

  return sharp(filled)
    .composite([{ input: corners, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function padToCanvas(plate: Buffer): Promise<Buffer> {
  const inset = Math.round((ICON_SIZE - PLATE_SIZE) / 2)

  return sharp(plate)
    .extend({
      top: inset,
      bottom: inset,
      left: inset,
      right: inset,
      background: TRANSPARENT,
    })
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
  const markSize = Math.round(PLATE_SIZE * (1 - MARK_MARGIN * 2))

  mkdirSync(iconsDir, { recursive: true })

  const plate = await buildPlate(rasterize(svg, markSize))
  writeFileSync(appIconPath, await padToCanvas(plate))
  runTauriIcon(appIconPath)
}

await generate()
