export const HUGE_REPO_WARNING_DISMISSAL_MAX_WORKTREES = 1024

const hugeRepoWarningDismissedByWorktreeId = new Set<string>()

function trimHugeRepoWarningDismissals(): void {
  while (hugeRepoWarningDismissedByWorktreeId.size > HUGE_REPO_WARNING_DISMISSAL_MAX_WORKTREES) {
    const oldestWorktreeId = hugeRepoWarningDismissedByWorktreeId.keys().next().value
    if (oldestWorktreeId === undefined) {
      break
    }
    hugeRepoWarningDismissedByWorktreeId.delete(oldestWorktreeId)
  }
}

export function hasDismissedHugeRepoWarning(worktreeId: string): boolean {
  if (!hugeRepoWarningDismissedByWorktreeId.has(worktreeId)) {
    return false
  }

  hugeRepoWarningDismissedByWorktreeId.delete(worktreeId)
  hugeRepoWarningDismissedByWorktreeId.add(worktreeId)
  return true
}

export function markHugeRepoWarningDismissed(worktreeId: string): void {
  // Why: this warning is a session-only "don't show again" gate; bound stale
  // removed-worktree IDs while keeping recently active huge repos dismissed.
  hugeRepoWarningDismissedByWorktreeId.delete(worktreeId)
  hugeRepoWarningDismissedByWorktreeId.add(worktreeId)
  trimHugeRepoWarningDismissals()
}

export function clearHugeRepoWarningDismissalsForTests(): void {
  hugeRepoWarningDismissedByWorktreeId.clear()
}

export function getHugeRepoWarningDismissalCountForTests(): number {
  return hugeRepoWarningDismissedByWorktreeId.size
}
