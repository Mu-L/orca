import { describe, expect, it } from 'vitest'
import { shouldEmitBoundedWarning } from './bounded-warning-dedupe'

describe('shouldEmitBoundedWarning', () => {
  it('keeps repeat warning keys quiet while bounding stale keys', () => {
    const warningKeys = new Set<string>()

    expect(shouldEmitBoundedWarning(warningKeys, 'keep', 3)).toBe(true)
    expect(shouldEmitBoundedWarning(warningKeys, 'stale-1', 3)).toBe(true)
    expect(shouldEmitBoundedWarning(warningKeys, 'stale-2', 3)).toBe(true)

    expect(shouldEmitBoundedWarning(warningKeys, 'keep', 3)).toBe(false)
    expect(shouldEmitBoundedWarning(warningKeys, 'new', 3)).toBe(true)

    expect([...warningKeys]).toEqual(['stale-2', 'keep', 'new'])
    expect(shouldEmitBoundedWarning(warningKeys, 'stale-1', 3)).toBe(true)
  })
})
