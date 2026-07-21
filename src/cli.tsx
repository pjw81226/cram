import React from 'react'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { cac } from 'cac'
import { render } from 'ink'
import clipboard from 'clipboardy'
import { App } from './tui/App'
import { runHeadless } from './headless'
import { resolveModel, DEFAULT_MODEL, MODELS } from './core/models'
import { explainReport } from './core/explain'
import { loadConfig } from './core/config'
import { parseBudget, formatTokens, formatCost } from './util'
import type { OutputFormat } from './core/types'

const VERSION = '0.1.0'

const cli = cac('cram')

cli
  .command('[dir]', 'Pack a codebase into an LLM context bundle')
  .option('-m, --model <id>', 'Target model: gpt-4o, claude, o1, gemini …', { default: DEFAULT_MODEL })
  .option('-b, --budget <tokens>', 'Token budget, e.g. 100k or 1.5m (default: model context)')
  .option('-f, --format <fmt>', 'Output format: markdown | xml | plain', { default: 'markdown' })
  .option('-o, --output <file>', 'Write the bundle to a file')
  .option('-c, --copy', 'Copy the bundle to the clipboard')
  .option('--stdout', 'Force writing the bundle to stdout')
  .option('--focus <text>', 'Bias ranking toward a task description')
  .option('--explain', 'Print why each file was kept or dropped')
  .option('--ignore <glob>', 'Extra ignore glob (repeatable)')
  .option('--include <glob>', 'Always include matching files, whatever the budget (repeatable)')
  .option('--all', 'Include files normally ignored by default')
  .option('--no-gitignore', 'Do not honor .gitignore files')
  .option('-i, --interactive', 'Force the interactive TUI')
  .option('--list-models', 'List model presets and exit')
  .example('  $ cram                       # interactively pack the current directory')
  .example('  $ cram . -b 100k -o ctx.md   # auto-fit to 100k tokens, write a file')
  .example('  $ cram src --model claude -c # pack src/ for Claude, copy to clipboard')
  .example('  $ cram . -b 50k --explain    # show why each file was kept or dropped')
  .example('  $ cram . --include "docs/**" # pin files cram must always keep')
  .action(async (dir: string | undefined, options: Record<string, unknown>) => {
    if (options.listModels) {
      listModels()
      return
    }

    const root = path.resolve(process.cwd(), dir ?? '.')
    const format = normalizeFormat(String(options.format ?? 'markdown'))

    let budget: number | undefined
    if (options.budget !== undefined) {
      budget = parseBudget(options.budget as string)
      if (budget === undefined) return fail(`Invalid budget "${String(options.budget)}". Try 100k, 1.5m, or a number.`)
    }

    let model
    try {
      model = resolveModel(String(options.model ?? DEFAULT_MODEL))
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err))
    }

    // Pins come from the repo's config file and from --include; both apply.
    const config = await loadConfig(root)
    for (const warning of config.warnings) process.stderr.write(`cram: ${warning}\n`)
    const alwaysInclude = [...config.alwaysInclude, ...(toArray(options.include) ?? [])]

    const scanOptions = {
      ignore: toArray(options.ignore),
      includeDefaultIgnored: Boolean(options.all),
      respectGitignore: options.gitignore !== false,
      alwaysInclude,
    }

    const explain = Boolean(options.explain)
    const wantsFileOutput = Boolean(options.output || options.copy || options.stdout)
    const isTTY = Boolean(process.stdout.isTTY && process.stdin.isTTY)
    // --explain asks for a report, not a session, so it stays headless unless -i is explicit.
    const interactive = Boolean(options.interactive) || (isTTY && !wantsFileOutput && !explain)

    if (interactive) {
      const { waitUntilExit } = render(
        <App
          root={root}
          modelId={model.id}
          initialBudget={budget}
          format={format}
          focus={options.focus as string | undefined}
          outputPath={options.output as string | undefined}
          scanOptions={scanOptions}
        />,
      )
      await waitUntilExit()
      return
    }

    const result = await runHeadless({ root, model: model.id, budget, format, focus: options.focus as string | undefined, ...scanOptions })

    // A pin that matches nothing is almost always a typo; say so rather than
    // leaving the user to wonder why their file never shows up.
    const files = [...result.selection.included, ...result.selection.excluded]
    if (alwaysInclude.length > 0 && !files.some((f) => f.pinned)) {
      process.stderr.write(`cram: no files matched ${alwaysInclude.join(', ')}\n`)
    }

    let wroteSomewhere = false
    if (options.output) {
      await writeFile(path.resolve(process.cwd(), String(options.output)), result.output, 'utf8')
      process.stderr.write(`Wrote ${String(options.output)}\n`)
      wroteSomewhere = true
    }
    if (options.copy) {
      try {
        await clipboard.write(result.output)
        process.stderr.write('Copied to clipboard\n')
        wroteSomewhere = true
      } catch {
        process.stderr.write('Clipboard unavailable in this environment\n')
      }
    }
    // An --explain run with no output flag wants the report, not the bundle.
    const bundleToStdout = Boolean(options.stdout) || (!wroteSomewhere && !explain)
    if (bundleToStdout) {
      process.stdout.write(result.output)
    }

    if (explain) {
      // Wherever the bundle goes, keep the report off the same stream.
      const stream = bundleToStdout ? process.stderr : process.stdout
      stream.write(explainReport(result.selection))
    }

    const stats =
      `cram · ${result.modelLabel}${result.approximate ? ' (approx)' : ''} · ` +
      `${result.includedCount}/${result.totalFiles} files · ` +
      `${formatTokens(result.totalTokens)} / ${formatTokens(result.budget)} tokens` +
      (result.cost !== undefined ? ` · ~${formatCost(result.cost)}` : '')
    process.stderr.write('\n' + stats + '\n')
  })

cli.help()
cli.version(VERSION)

async function main() {
  cli.parse(process.argv, { run: false })
  await cli.runMatchedCommand()
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))

function normalizeFormat(f: string): OutputFormat {
  const v = f.toLowerCase()
  if (v === 'xml') return 'xml'
  if (v === 'plain' || v === 'text' || v === 'txt') return 'plain'
  if (v === 'markdown' || v === 'md') return 'markdown'
  fail(`Unknown format "${f}". Use markdown, xml, or plain.`)
  process.exit(1)
}

function toArray(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined
  return Array.isArray(v) ? v.map(String) : [String(v)]
}

function listModels(): void {
  process.stdout.write('Available models:\n')
  for (const m of Object.values(MODELS)) {
    process.stdout.write(
      `  ${m.id.padEnd(18)} ${formatTokens(m.context).padStart(6)} ctx  ${m.encoding}${m.approximate ? '  (approx)' : ''}\n`,
    )
  }
}

function fail(msg: string): void {
  process.stderr.write(`cram: ${msg}\n`)
  process.exitCode = 1
}
