/** Parse a human token budget like "100k", "1.5m", "200000" into a number. */
export function parseBudget(input: string | number | undefined): number | undefined {
  if (input === undefined || input === null) return undefined
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined
  const s = String(input).trim().toLowerCase().replace(/[,_]/g, '')
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([kmg])?$/)
  if (!m) return undefined
  const n = parseFloat(m[1]!)
  const mult = m[2] === 'g' ? 1e9 : m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1
  return Math.round(n * mult)
}

/** Compact token count, e.g. 128000 → "128k", 1500000 → "1.50m". */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (n < 1000) return String(Math.round(n))
  if (n < 1e6) {
    const k = n / 1000
    return (Number.isInteger(k) ? k : k.toFixed(1)) + 'k'
  }
  const mm = n / 1e6
  return mm.toFixed(mm < 10 ? 2 : 1) + 'm'
}

/** Compact USD, e.g. 0.004 → "<$0.01", 2.5 → "$2.50". */
export function formatCost(usd: number): string {
  if (usd <= 0) return '$0.00'
  if (usd < 0.01) return '<$0.01'
  return '$' + usd.toFixed(2)
}

/** Pick a sensible default output filename for a format. */
export function defaultOutputName(format: 'markdown' | 'xml' | 'plain'): string {
  const ext = format === 'xml' ? 'xml' : format === 'plain' ? 'txt' : 'md'
  return `cram-output.${ext}`
}
