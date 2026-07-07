import type { IDisposable, IParser, Terminal } from '@xterm/xterm'

// Why: Orca advertises the kitty keyboard protocol but withholds it from local
// Windows ConPTY panes (see terminal-keyboard-protocol.ts), and xterm never
// exposes the live kitty state to us. To pick the right Shift+Enter encoding on
// Windows we need to know whether the pane's *program* speaks CSI-u: kitty TUIs
// (e.g. droid) parse `\x1b[13;2u` and treat the Alt+Enter byte `\x1b\r` as a
// plain Enter that SUBMITS, while win32-input-mode-only TUIs (e.g. Codex) only
// newline on `\x1b\r` and ignore CSI-u. A program announces CSI-u support by
// emitting a kitty keyboard control (query `CSI ? u`, push `CSI > … u`, or set
// `CSI = … u`); we latch that per-terminal so the shortcut policy can prefer
// CSI-u for those panes. (#7620; the win32-only fallback comes from #2418.)

const kittyKeyboardAwareTerminals = new WeakSet<Terminal>()

export function markTerminalKittyKeyboardAware(terminal: Terminal): void {
  kittyKeyboardAwareTerminals.add(terminal)
}

export function isTerminalKittyKeyboardAware(terminal: Terminal | null | undefined): boolean {
  return terminal != null && kittyKeyboardAwareTerminals.has(terminal)
}

// Private-marker bytes that introduce an app→terminal kitty keyboard control:
// `?` = query flags, `>` = push flags, `=` = set flags. Pop (`<`) is omitted —
// disabling the protocol does not prove the program parses CSI-u input.
const KITTY_KEYBOARD_CONTROL_PREFIXES = ['?', '>', '='] as const

type KittyKeyboardAwarenessDeps = {
  terminal: Terminal
  parser: Pick<IParser, 'registerCsiHandler'>
}

/**
 * Latches a pane as kitty-keyboard-aware the first time its program emits a
 * kitty keyboard control. Registered on the pane parser next to the capability
 * reply handlers; returns false from every handler so xterm's own kitty logic
 * (enabled on non-Windows panes) still answers the query / applies the flags.
 */
export function installKittyKeyboardAwarenessDetector(
  deps: KittyKeyboardAwarenessDeps
): IDisposable {
  const disposables = KITTY_KEYBOARD_CONTROL_PREFIXES.map((prefix) =>
    deps.parser.registerCsiHandler({ prefix, final: 'u' }, () => {
      markTerminalKittyKeyboardAware(deps.terminal)
      return false
    })
  )
  return {
    dispose: () => {
      for (const disposable of disposables) {
        disposable.dispose()
      }
    }
  }
}
