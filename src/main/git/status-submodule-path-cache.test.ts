import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { gitExecFileAsyncMock, gitExecFileAsyncBufferMock, gitStreamStdoutMock } = vi.hoisted(
  () => ({
    gitExecFileAsyncMock: vi.fn(),
    gitExecFileAsyncBufferMock: vi.fn(),
    gitStreamStdoutMock: vi.fn()
  })
)

vi.mock('./runner', () => ({
  gitExecFileAsync: gitExecFileAsyncMock,
  gitExecFileAsyncBuffer: gitExecFileAsyncBufferMock,
  gitStreamStdout: gitStreamStdoutMock,
  gitOptionalLocksDisabledEnv: (env: NodeJS.ProcessEnv = process.env) => ({
    ...env,
    GIT_OPTIONAL_LOCKS: '0'
  })
}))

import {
  MAX_SUBMODULE_PATHS_CACHE_ENTRIES,
  clearSubmodulePathsCacheForTests,
  getSubmodulePathsCacheCountForTests,
  listSubmodulePaths
} from './status'

describe('submodule path cache', () => {
  beforeEach(() => {
    clearSubmodulePathsCacheForTests()
    gitExecFileAsyncMock.mockReset()
    gitExecFileAsyncBufferMock.mockReset()
    gitStreamStdoutMock.mockReset()
    gitExecFileAsyncMock.mockImplementation((_args: string[], options?: { cwd?: string }) =>
      Promise.resolve({
        stdout: `submodule.lib.path ${String(options?.cwd ?? 'repo').replace(/^.*[/\\\\]/, '')}-lib\n`
      })
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    clearSubmodulePathsCacheForTests()
  })

  it('prunes expired entries even when later reads use different worktrees', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    await listSubmodulePaths('/repo-a')
    await listSubmodulePaths('/repo-b')

    expect(getSubmodulePathsCacheCountForTests()).toBe(2)

    vi.setSystemTime(5_001)
    await expect(listSubmodulePaths('/repo-c')).resolves.toEqual(['repo-c-lib'])

    expect(getSubmodulePathsCacheCountForTests()).toBe(1)
    expect(gitExecFileAsyncMock).toHaveBeenCalledTimes(3)
  })

  it('caps entries and keeps recently reused worktrees', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    for (let i = 0; i < MAX_SUBMODULE_PATHS_CACHE_ENTRIES; i += 1) {
      await listSubmodulePaths(`/repo-${i}`)
    }
    await expect(listSubmodulePaths('/repo-0')).resolves.toEqual(['repo-0-lib'])
    await listSubmodulePaths(`/repo-${MAX_SUBMODULE_PATHS_CACHE_ENTRIES}`)

    expect(getSubmodulePathsCacheCountForTests()).toBe(MAX_SUBMODULE_PATHS_CACHE_ENTRIES)

    const callsBeforeRetainedRead = gitExecFileAsyncMock.mock.calls.length
    await expect(listSubmodulePaths('/repo-0')).resolves.toEqual(['repo-0-lib'])
    expect(gitExecFileAsyncMock).toHaveBeenCalledTimes(callsBeforeRetainedRead)

    await expect(listSubmodulePaths('/repo-1')).resolves.toEqual(['repo-1-lib'])
    expect(gitExecFileAsyncMock).toHaveBeenCalledTimes(callsBeforeRetainedRead + 1)
  })
})
