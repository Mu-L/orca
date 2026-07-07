import { describe, expect, it } from 'vitest'
import { Terminal } from '@xterm/headless'
import {
  installKittyKeyboardAwarenessDetector,
  isTerminalKittyKeyboardAware,
  markTerminalKittyKeyboardAware
} from './terminal-kitty-keyboard-awareness'

function writeTerminal(term: Terminal, data: string): Promise<void> {
  return new Promise((resolve) => term.write(data, resolve))
}

function createDetectedTerminal(options?: { kittyKeyboard?: boolean }): {
  term: Terminal
  dispose: () => void
} {
  const term = new Terminal({
    cols: 80,
    rows: 24,
    allowProposedApi: true,
    ...(options?.kittyKeyboard === undefined
      ? {}
      : { vtExtensions: { kittyKeyboard: options.kittyKeyboard } })
  })
  const disposable = installKittyKeyboardAwarenessDetector({
    terminal: term as never,
    parser: term.parser
  })
  return {
    term,
    dispose: () => {
      disposable.dispose()
      term.dispose()
    }
  }
}

describe('terminal kitty keyboard awareness', () => {
  it('treats null/undefined terminals as not aware', () => {
    expect(isTerminalKittyKeyboardAware(null)).toBe(false)
    expect(isTerminalKittyKeyboardAware(undefined)).toBe(false)
  })

  it('marks a terminal aware after a kitty query (CSI ? u), the sequence droid emits', async () => {
    const { term, dispose } = createDetectedTerminal()
    try {
      expect(isTerminalKittyKeyboardAware(term as never)).toBe(false)
      await writeTerminal(term, '\x1b[?u')
      expect(isTerminalKittyKeyboardAware(term as never)).toBe(true)
    } finally {
      dispose()
    }
  })

  it('marks a terminal aware on push (CSI > N u) and set (CSI = N ; M u) controls', async () => {
    for (const control of ['\x1b[>1u', '\x1b[=1;1u']) {
      const { term, dispose } = createDetectedTerminal()
      try {
        await writeTerminal(term, control)
        expect(isTerminalKittyKeyboardAware(term as never)).toBe(true)
      } finally {
        dispose()
      }
    }
  })

  it('does not mark a terminal aware for unrelated CSI sequences (e.g. Codex has none)', async () => {
    const { term, dispose } = createDetectedTerminal()
    try {
      // win32-input-mode enable + DA1 query + SGR reset: nothing kitty here.
      await writeTerminal(term, '\x1b[?9001h\x1b[c\x1b[0mhello')
      expect(isTerminalKittyKeyboardAware(term as never)).toBe(false)
    } finally {
      dispose()
    }
  })

  it('still detects the query when xterm has the kitty encoder enabled', async () => {
    const { term, dispose } = createDetectedTerminal({ kittyKeyboard: true })
    try {
      await writeTerminal(term, '\x1b[?u')
      expect(isTerminalKittyKeyboardAware(term as never)).toBe(true)
    } finally {
      dispose()
    }
  })

  it('stops latching after dispose', async () => {
    const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    const disposable = installKittyKeyboardAwarenessDetector({
      terminal: term as never,
      parser: term.parser
    })
    disposable.dispose()
    try {
      await writeTerminal(term, '\x1b[?u')
      expect(isTerminalKittyKeyboardAware(term as never)).toBe(false)
    } finally {
      term.dispose()
    }
  })

  it('exposes an imperative mark for callers that observe kitty out-of-band', () => {
    const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    try {
      expect(isTerminalKittyKeyboardAware(term as never)).toBe(false)
      markTerminalKittyKeyboardAware(term as never)
      expect(isTerminalKittyKeyboardAware(term as never)).toBe(true)
    } finally {
      term.dispose()
    }
  })
})
