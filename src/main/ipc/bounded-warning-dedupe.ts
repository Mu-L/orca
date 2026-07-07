export const DEFAULT_WARNING_DEDUPE_MAX_KEYS = 256

// Why: diagnostic "warn once" keys often include dynamic paths/providers; keep
// repeated warnings quiet without retaining every stale key forever.
export function shouldEmitBoundedWarning(
  warningKeys: Set<string>,
  key: string,
  maxKeys = DEFAULT_WARNING_DEDUPE_MAX_KEYS
): boolean {
  if (warningKeys.has(key)) {
    warningKeys.delete(key)
    warningKeys.add(key)
    return false
  }
  warningKeys.add(key)
  while (warningKeys.size > maxKeys) {
    const oldestKey = warningKeys.values().next().value
    if (oldestKey === undefined) {
      break
    }
    warningKeys.delete(oldestKey)
  }
  return true
}
