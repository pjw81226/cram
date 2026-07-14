import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import clipboard from 'clipboardy'
import { scan } from '../core/scanner'
import { tokenizeFiles } from '../core/tokenizer'
import { rank } from '../core/ranker'
import { select } from '../core/selector'
import { format } from '../core/formatter'
import { resolveModel, estimateCost, MODELS } from '../core/models'
import { reasonSummary } from '../core/explain'
import type { OutputFormat, RankedFile, Selection } from '../core/types'
import { buildTree, flatten, collectFiles, type TreeNode } from './tree-model'
import { BudgetBar } from './BudgetBar'
import { Tree } from './Tree'
import { StatusBar } from './StatusBar'
import { formatTokens, defaultOutputName } from '../util'

const FORMATS: OutputFormat[] = ['markdown', 'xml', 'plain']
const MODEL_IDS = Object.keys(MODELS)
const BUDGET_STEP = 10_000

export interface AppProps {
  root: string
  modelId: string
  initialBudget?: number
  format: OutputFormat
  focus?: string
  outputPath?: string
  scanOptions?: {
    ignore?: string[]
    includeDefaultIgnored?: boolean
    respectGitignore?: boolean
  }
}

const byScore = (a: RankedFile, b: RankedFile): number =>
  b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)

export function App(props: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [files, setFiles] = useState<RankedFile[]>([])
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [modelId, setModelId] = useState(props.modelId)
  const [budget, setBudget] = useState(props.initialBudget ?? resolveModel(props.modelId).context)
  const [fmt, setFmt] = useState<OutputFormat>(props.format)
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(0)
  const [filter, setFilter] = useState('')
  const [searching, setSearching] = useState(false)
  const [status, setStatus] = useState('')

  const offsetRef = useRef(0)

  // Load + rank the repo once on mount.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const model = resolveModel(props.modelId)
        const scanned = await scan({ root: props.root, ...props.scanOptions })
        tokenizeFiles(scanned, model.encoding)
        const ranked = rank(scanned, { focus: props.focus, root: props.root })
        if (cancelled) return
        const t = buildTree(ranked)
        const topDirs = new Set(t.children.filter((c) => c.isDir).map((c) => c.path))
        const sel = select(ranked, budget)
        setFiles(ranked)
        setTree(t)
        setExpanded(topDirs)
        setIncluded(new Set(sel.included.map((f) => f.path)))
        setStatus(
          `Auto-fit ${sel.included.length}/${ranked.length} files · ${formatTokens(sel.totalTokens)} / ${formatTokens(budget)}`,
        )
        setPhase('ready')
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err))
          setPhase('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => (tree ? flatten(tree, expanded, filter) : []), [tree, expanded, filter])
  const used = useMemo(
    () => files.reduce((sum, f) => (included.has(f.path) ? sum + f.tokens : sum), 0),
    [files, included],
  )

  // Why the ranker scored the row under the cursor as it did. Files only — a
  // directory has no score of its own, so the line goes blank.
  const why = useMemo(() => {
    const file = rows[cursor]?.node.file
    return file ? `${file.score.toFixed(2)} · ${reasonSummary(file)}` : ''
  }, [rows, cursor])

  const model = resolveModel(modelId)
  const cost = estimateCost(used, model)
  const rootTokens = tree?.tokens ?? 0

  // Keep the cursor within bounds when the visible row set changes.
  useEffect(() => {
    if (cursor > rows.length - 1) setCursor(Math.max(0, rows.length - 1))
  }, [rows.length, cursor])

  // Viewport window (derived; header + why line + status reserve ~10 lines).
  const listHeight = Math.max(4, (stdout?.rows ?? 24) - 10)
  {
    let offset = offsetRef.current
    if (cursor < offset) offset = cursor
    else if (cursor >= offset + listHeight) offset = cursor - listHeight + 1
    offset = Math.max(0, Math.min(offset, Math.max(0, rows.length - listHeight)))
    offsetRef.current = offset
  }

  // Everything the input handler needs, read fresh via a stable ref so Ink's
  // input subscription can never act on a stale closure.
  const live = useRef<{
    rows: typeof rows
    cursor: number
    expanded: Set<string>
    included: Set<string>
    files: RankedFile[]
    budget: number
    fmt: OutputFormat
    modelId: string
    searching: boolean
    listHeight: number
    phase: typeof phase
  }>(null as never)
  live.current = { rows, cursor, expanded, included, files, budget, fmt, modelId, searching, listHeight, phase }

  const buildSelection = (): Selection => {
    const s = live.current
    const inc = s.files.filter((f) => s.included.has(f.path)).sort(byScore)
    const exc = s.files.filter((f) => !s.included.has(f.path)).sort(byScore)
    return {
      included: inc,
      excluded: exc,
      totalTokens: inc.reduce((sum, f) => sum + f.tokens, 0),
      budget: s.budget,
    }
  }

  const render = (): string =>
    format(buildSelection(), { format: live.current.fmt, root: props.root, model: resolveModel(live.current.modelId) })

  const doAutoFit = () => {
    const s = live.current
    const sel = select(s.files, s.budget)
    setIncluded(new Set(sel.included.map((f) => f.path)))
    setStatus(`Auto-fit ${sel.included.length} files · ${formatTokens(sel.totalTokens)} / ${formatTokens(s.budget)}`)
  }

  const cycleModel = () => {
    const s = live.current
    const nextId = MODEL_IDS[(MODEL_IDS.indexOf(s.modelId) + 1) % MODEL_IDS.length]!
    const next = resolveModel(nextId)
    const retok = s.files.map((f) => ({ ...f }))
    tokenizeFiles(retok, next.encoding)
    setFiles(retok)
    setTree(buildTree(retok))
    setModelId(nextId)
    setBudget(next.context)
    setStatus(`Model: ${next.label}${next.approximate ? ' (approx tokens)' : ''} · budget ${formatTokens(next.context)}`)
  }

  const toggleNode = (node: TreeNode) => {
    const s = live.current
    const next = new Set(s.included)
    const targets = collectFiles(node).filter((f) => f.tokens > 0)
    if (targets.length === 0) return
    const allIn = targets.every((f) => next.has(f.path))
    for (const f of targets) allIn ? next.delete(f.path) : next.add(f.path)
    setIncluded(next)
  }

  const doCopy = () => {
    const out = render()
    const s = live.current
    void clipboard
      .write(out)
      .then(() => setStatus(`Copied ${s.included.size} files · ${formatTokens(used)} tokens to clipboard`))
      .catch(() => setStatus('Clipboard unavailable in this environment'))
  }

  const doWrite = () => {
    const out = render()
    const file = props.outputPath ?? defaultOutputName(live.current.fmt)
    void writeFile(path.resolve(process.cwd(), file), out, 'utf8')
      .then(() => setStatus(`Wrote ${formatTokens(used)} tokens → ${file}`))
      .catch((err) => setStatus(`Write failed: ${err instanceof Error ? err.message : String(err)}`))
  }

  useInput((input, key) => {
    const s = live.current

    if (s.phase !== 'ready') {
      if (key.escape || (key.ctrl && input === 'c')) exit()
      return
    }

    if (s.searching) {
      if (key.return) setSearching(false)
      else if (key.escape) {
        setSearching(false)
        setFilter('')
      } else if (key.backspace || key.delete) setFilter((f) => f.slice(0, -1))
      else if (input && !key.ctrl && !key.meta) setFilter((f) => f + input)
      return
    }

    if (input === 'q' || key.escape) return void exit()

    if (key.upArrow || input === 'k') return void setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow || input === 'j') return void setCursor((c) => Math.min(s.rows.length - 1, c + 1))
    if (key.pageUp) return void setCursor((c) => Math.max(0, c - s.listHeight))
    if (key.pageDown) return void setCursor((c) => Math.min(s.rows.length - 1, c + s.listHeight))

    const row = s.rows[s.cursor]

    if (key.rightArrow || input === 'l') {
      if (row?.node.isDir) setExpanded((e) => new Set(e).add(row.node.path))
      return
    }
    if (key.leftArrow || input === 'h') {
      if (row?.node.isDir && s.expanded.has(row.node.path)) {
        setExpanded((e) => {
          const n = new Set(e)
          n.delete(row.node.path)
          return n
        })
      }
      return
    }

    if (input === ' ') return void (row && toggleNode(row.node))
    if (input === 'a') return void doAutoFit()
    if (input === 'n') {
      setIncluded(new Set())
      setStatus('Cleared selection')
      return
    }
    if (input === 'm') return void cycleModel()
    if (input === 'f') {
      const next = FORMATS[(FORMATS.indexOf(s.fmt) + 1) % FORMATS.length]!
      setFmt(next)
      setStatus(`Format: ${next}`)
      return
    }
    if (input === 'c') return void doCopy()
    if (input === 'w') return void doWrite()
    if (input === '/') {
      setSearching(true)
      setFilter('')
      return
    }
    if (input === '[') return void setBudget((b) => Math.max(0, b - BUDGET_STEP))
    if (input === ']') return void setBudget((b) => b + BUDGET_STEP)
  })

  if (phase === 'loading') {
    return (
      <Box padding={1}>
        <Text>
          <Text bold color="cyanBright">
            cram{' '}
          </Text>
          <Text dimColor>scanning {props.root} …</Text>
        </Text>
      </Box>
    )
  }

  if (phase === 'error') {
    return (
      <Box padding={1}>
        <Text color="red">cram error: {errorMsg}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <BudgetBar
        used={used}
        budget={budget}
        includedCount={included.size}
        totalFiles={files.length}
        cost={cost}
        modelLabel={model.label}
        approximate={Boolean(model.approximate)}
        format={fmt}
      />
      <Tree
        rows={rows}
        cursor={cursor}
        offset={offsetRef.current}
        height={listHeight}
        includedPaths={included}
        expanded={expanded}
        rootTokens={rootTokens}
      />
      <StatusBar searching={searching} filter={filter} status={status} why={why} />
    </Box>
  )
}
