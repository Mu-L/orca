import { afterEach, describe, expect, it } from 'vitest'
import {
  HUGE_REPO_WARNING_DISMISSAL_MAX_WORKTREES,
  clearHugeRepoWarningDismissalsForTests,
  getHugeRepoWarningDismissalCountForTests,
  hasDismissedHugeRepoWarning,
  markHugeRepoWarningDismissed
} from './source-control-huge-repo-warning-dismissals'

describe('source-control huge repo warning dismissals', () => {
  afterEach(() => {
    clearHugeRepoWarningDismissalsForTests()
  })

  it('bounds dismissed worktrees while retaining recently reused entries', () => {
    markHugeRepoWarningDismissed('keep')

    for (let i = 0; i < HUGE_REPO_WARNING_DISMISSAL_MAX_WORKTREES - 1; i += 1) {
      markHugeRepoWarningDismissed(`worktree-${i}`)
    }

    expect(hasDismissedHugeRepoWarning('keep')).toBe(true)

    markHugeRepoWarningDismissed('worktree-new')

    expect(getHugeRepoWarningDismissalCountForTests()).toBe(
      HUGE_REPO_WARNING_DISMISSAL_MAX_WORKTREES
    )
    expect(hasDismissedHugeRepoWarning('keep')).toBe(true)
    expect(hasDismissedHugeRepoWarning('worktree-0')).toBe(false)
    expect(hasDismissedHugeRepoWarning('worktree-new')).toBe(true)
  })

  it('does not count duplicate dismissals as new worktree entries', () => {
    markHugeRepoWarningDismissed('worktree-a')
    markHugeRepoWarningDismissed('worktree-a')

    expect(getHugeRepoWarningDismissalCountForTests()).toBe(1)
    expect(hasDismissedHugeRepoWarning('worktree-a')).toBe(true)
  })
})
