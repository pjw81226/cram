/**
 * Scanner: walks a directory tree and produces FileRecord[] for the pipeline.
 *
 * Responsibilities:
 *   - Recursively walk `root` (never following symlinked directories).
 *   - Apply a built-in default-ignore set, .gitignore files (root + nested),
 *     and any extra `opts.ignore` globs — all via the `ignore` package.
 *   - Read text content (UTF-8), detect binary files, map extension → lang.
 *   - Leave `tokens` at 0; the tokenizer fills that in later.
 */

import { promises as fs } from 'node:fs'
import type { Dirent, Stats } from 'node:fs'
import path from 'node:path'
import ignore from 'ignore'
import type { Ignore } from 'ignore'

import type { FileRecord, ScanOptions } from './types'

const DEFAULT_MAX_FILE_BYTES = 512 * 1024
/** Only the first slice of a file is inspected for NUL bytes. */
const BINARY_SNIFF_BYTES = 8192

/** Directories, files, and extensions dropped unless `includeDefaultIgnored`. */
const DEFAULT_IGNORE: readonly string[] = [
  // VCS / dependency / build / tool caches (directories)
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  '.venv',
  'venv',
  '__pycache__',
  '.mypy_cache',
  '.pytest_cache',
  '.idea',
  '.vscode',
  '.DS_Store',
  // generated / noisy files
  '*.min.js',
  '*.map',
  // lockfiles
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Cargo.lock',
  'poetry.lock',
  'composer.lock',
  // binary / media extensions (SVG is text and intentionally NOT listed)
  '*.png', '*.jpg', '*.jpeg', '*.gif', '*.webp', '*.ico', '*.bmp', '*.tiff',
  '*.woff', '*.woff2', '*.ttf', '*.eot', '*.otf',
  '*.mp3', '*.mp4', '*.mov', '*.avi', '*.mkv', '*.wav',
  '*.zip', '*.tar', '*.gz', '*.tgz', '*.rar', '*.7z',
  '*.pdf',
  '*.exe', '*.dll', '*.so', '*.dylib', '*.bin', '*.wasm',
  '*.class', '*.jar',
  '*.node', '*.sqlite', '*.db',
]

/** Extension (lowercased, no dot) → fenced-code language id. */
const LANG_BY_EXT: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  jsx: 'jsx',
  mjs: 'mjs',
  cjs: 'cjs',
  py: 'py',
  go: 'go',
  rs: 'rs',
  java: 'java',
  kt: 'kt',
  rb: 'rb',
  php: 'php',
  c: 'c',
  h: 'h',
  cpp: 'cpp',
  cc: 'cc',
  hpp: 'hpp',
  cs: 'cs',
  swift: 'swift',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  jsonc: 'jsonc',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sql: 'sql',
  md: 'md',
  markdown: 'md',
  rst: 'rst',
  graphql: 'graphql',
  gql: 'graphql',
  vue: 'vue',
  svelte: 'svelte',
  proto: 'proto',
  tf: 'hcl',
  ini: 'ini',
  env: 'bash',
}

/** Map a filename to a fenced-code language id, or "" when unknown. */
function detectLang(name: string): string {
  const lower = name.toLowerCase()
  // Extension-less / special filenames.
  if (lower === 'dockerfile' || lower === 'containerfile' ||
      lower.startsWith('dockerfile.') || lower.endsWith('.dockerfile')) {
    return 'dockerfile'
  }
  if (lower === 'makefile' || lower === 'gnumakefile') return 'makefile'
  if (lower === '.env' || lower.startsWith('.env.')) return 'bash'

  const dot = lower.lastIndexOf('.')
  if (dot <= 0) return '' // no extension, or a dotfile like ".gitignore"
  const ext = lower.slice(dot + 1)
  return LANG_BY_EXT[ext] ?? ''
}

/** A file is binary if it has a NUL byte in its head, or is not valid UTF-8. */
function looksBinary(buf: Buffer): boolean {
  const head = Math.min(buf.length, BINARY_SNIFF_BYTES)
  for (let i = 0; i < head; i++) {
    if (buf[i] === 0) return true
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf)
    return false
  } catch {
    return true
  }
}

/** One layer of ignore rules, scoped to the subtree rooted at `base`. */
interface IgnoreLayer {
  /** Directory (relative to scan root, POSIX) the rules are anchored at; "" = root. */
  base: string
  ig: Ignore
}

/** Re-express `rel` relative to a layer's base, or null if it lies outside. */
function relativeToBase(rel: string, base: string): string | null {
  if (base === '') return rel
  if (rel === base) return ''
  if (rel.startsWith(`${base}/`)) return rel.slice(base.length + 1)
  return null
}

/** True when any active layer ignores `rel` (a POSIX path relative to root). */
function isIgnored(rel: string, layers: IgnoreLayer[]): boolean {
  for (const layer of layers) {
    const sub = relativeToBase(rel, layer.base)
    if (sub === null || sub === '') continue
    if (layer.ig.ignores(sub)) return true
  }
  return false
}

/** Build a FileRecord for a single file, or null if it can't be read. */
async function recordFile(
  absPath: string,
  rel: string,
  maxFileBytes: number,
): Promise<FileRecord | null> {
  let st: Stats
  try {
    st = await fs.stat(absPath)
  } catch {
    return null // permission / race; skip gracefully
  }

  const record: FileRecord = {
    path: rel,
    absPath,
    content: '',
    bytes: st.size,
    tokens: 0,
    mtimeMs: st.mtimeMs,
    lang: detectLang(path.basename(rel)),
    binary: false,
  }

  // Oversized: keep the record but skip content (never load it into memory).
  if (st.size > maxFileBytes) return record

  let buf: Buffer
  try {
    buf = await fs.readFile(absPath)
  } catch {
    return null
  }

  if (looksBinary(buf)) {
    record.binary = true
    record.content = ''
  } else {
    record.content = buf.toString('utf8')
  }
  return record
}

/** Recursively walk `dir`, appending kept files to `out`. */
async function walk(
  dir: string,
  rel: string,
  layers: IgnoreLayer[],
  respectGitignore: boolean,
  maxFileBytes: number,
  out: FileRecord[],
): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return // unreadable directory; skip gracefully
  }

  // Layer in a nested .gitignore found here, scoped to this subtree.
  let localLayers = layers
  if (respectGitignore) {
    const gi = entries.find((e) => e.name === '.gitignore' && e.isFile())
    if (gi) {
      try {
        const content = await fs.readFile(path.join(dir, '.gitignore'), 'utf8')
        localLayers = [...layers, { base: rel, ig: ignore().add(content) }]
      } catch {
        // ignore an unreadable .gitignore
      }
    }
  }

  for (const entry of entries) {
    const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`
    const childAbs = path.join(dir, entry.name)

    let isDir = false
    let isFile = false
    if (entry.isSymbolicLink()) {
      // Resolve the target once; never descend into a symlinked directory.
      let target: Stats | null = null
      try {
        target = await fs.stat(childAbs)
      } catch {
        target = null
      }
      if (!target || target.isDirectory()) continue
      isFile = target.isFile()
    } else {
      isDir = entry.isDirectory()
      isFile = entry.isFile()
    }

    if (isDir) {
      if (isIgnored(childRel, localLayers)) continue // prune whole subtree
      await walk(childAbs, childRel, localLayers, respectGitignore, maxFileBytes, out)
    } else if (isFile) {
      if (isIgnored(childRel, localLayers)) continue
      const record = await recordFile(childAbs, childRel, maxFileBytes)
      if (record) out.push(record)
    }
    // Other entry types (fifo, socket, block device) are skipped.
  }
}

/**
 * Walk `opts.root` and return the discovered files, sorted by path ascending.
 * `tokens` is left at 0 for the tokenizer to fill in.
 */
export async function scan(opts: ScanOptions): Promise<FileRecord[]> {
  const root = path.resolve(opts.root)
  const respectGitignore = opts.respectGitignore !== false
  const maxFileBytes = opts.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES

  const layers: IgnoreLayer[] = []
  if (!opts.includeDefaultIgnored) {
    layers.push({ base: '', ig: ignore().add([...DEFAULT_IGNORE]) })
  }
  if (opts.ignore && opts.ignore.length > 0) {
    layers.push({ base: '', ig: ignore().add(opts.ignore) })
  }

  const out: FileRecord[] = []
  await walk(root, '', layers, respectGitignore, maxFileBytes, out)

  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return out
}
