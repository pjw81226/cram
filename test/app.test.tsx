import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { fileURLToPath } from 'node:url'
import { App } from '../src/tui/App'

const root = fileURLToPath(new URL('./fixtures/sample', import.meta.url))
const tick = () => new Promise((r) => setTimeout(r, 40))

async function waitForFrame(lastFrame: () => string | undefined, re: RegExp) {
  for (let i = 0; i < 50; i++) {
    if (re.test(lastFrame() ?? '')) return
    await tick()
  }
}

describe('TUI App (smoke)', () => {
  it('mounts, scans the repo, and renders the gauge + files', async () => {
    const { lastFrame, unmount } = render(
      <App root={root} modelId="gpt-4o" format="markdown" initialBudget={5000} />,
    )
    await waitForFrame(lastFrame, /files/)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('cram')
    expect(frame).toContain('tokens')
    expect(frame).toMatch(/files/)
    expect(frame).toMatch(/index\.ts|README|package\.json/)
    unmount()
  })

  it('accepts keypresses (auto-fit, format, budget, toggle, search) without crashing', async () => {
    const { lastFrame, stdin, unmount } = render(
      <App root={root} modelId="gpt-4o" format="markdown" initialBudget={5000} />,
    )
    await waitForFrame(lastFrame, /files/)
    for (const key of ['a', 'f', ']', '[', ' ', 'j', 'k']) {
      stdin.write(key)
      await tick()
    }
    const frame = lastFrame() ?? ''
    expect(frame).toContain('cram')
    expect(frame.length).toBeGreaterThan(0)
    unmount()
  })
})
