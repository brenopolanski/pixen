// Vendors the model and WASM files that @imgly/background-removal would
// otherwise fetch from IMG.LY's CDN at runtime. Pixen's CSP allows no such
// origin, and a desktop app should not need the network to remove a
// background, so the assets are served from `public/` instead.
//
// Only the quantized model is taken. The full set is 272 MB, most of it
// alternative precisions Pixen never asks for.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const PACKAGE_NAME = '@imgly/background-removal'
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'bg-removal')

/**
 * Must match the model in src/lib/image/cutout.ts. The onnxruntime entries are
 * both variants: `jsep` is the WebGPU build, the other the CPU fallback, and
 * which one loads depends on the machine.
 */
const RESOURCES = [
  '/models/isnet_quint8',
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs',
  '/onnxruntime-web/ort-wasm-simd-threaded.mjs',
]

const installedVersion = async () => {
  const manifest = path.join(process.cwd(), 'node_modules', PACKAGE_NAME, 'package.json')

  try {
    const raw = await readFile(manifest, 'utf8')

    return JSON.parse(raw).version
  } catch {
    throw new Error(`${PACKAGE_NAME} is not installed. Run pnpm install first.`)
  }
}

const fetchOk = async (url) => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`)
  }

  return response
}

const run = async () => {
  const version = await installedVersion()
  // The data package is versioned in step with the library, so the assets
  // always match the code that reads them.
  const baseUrl = `https://staticimgly.com/${PACKAGE_NAME}-data/${version}/dist/`

  console.log(`Fetching ${PACKAGE_NAME} assets for v${version}`)

  const manifest = await (await fetchOk(`${baseUrl}resources.json`)).json()
  const missing = RESOURCES.filter((key) => !manifest[key])

  if (missing.length > 0) {
    throw new Error(`resources.json has no entry for ${missing.join(', ')}`)
  }

  await mkdir(OUTPUT_DIR, { recursive: true })

  // Every entry is split into content-addressed chunks, and the two wasm
  // builds share some, so the same hash is only downloaded once.
  const chunks = new Map()

  for (const key of RESOURCES) {
    for (const chunk of manifest[key].chunks) {
      chunks.set(chunk.hash, chunk.name)
    }
  }

  let done = 0

  for (const [hash, name] of chunks) {
    const body = Buffer.from(await (await fetchOk(`${baseUrl}${name}`)).arrayBuffer())
    const digest = createHash('sha256').update(body).digest('hex')

    // The name is the hash, so a mismatch means a corrupted or swapped file.
    if (digest !== hash) {
      throw new Error(`${name} does not match its hash`)
    }

    await writeFile(path.join(OUTPUT_DIR, name), body)

    done += 1
    console.log(`  ${done}/${chunks.size} ${name.slice(0, 12)}…`)
  }

  // Pruned to what was written: an entry whose chunks are absent would fail at
  // load time with a 404 rather than a clear error.
  const pruned = Object.fromEntries(RESOURCES.map((key) => [key, manifest[key]]))

  await writeFile(path.join(OUTPUT_DIR, 'resources.json'), `${JSON.stringify(pruned, null, 2)}\n`)

  console.log(`Wrote ${chunks.size} files to public/bg-removal`)
}

try {
  await run()
} catch (failure) {
  console.error(`Could not fetch background removal assets: ${failure.message}`)
  process.exit(1)
}
