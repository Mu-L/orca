import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_LINEAR_AGENT_SKILL_SETUP_REMINDER_RUNTIME_KEYS,
  createLinearAgentSkillSetupActivationId,
  getLinearAgentSkillSetupReminderState,
  getLinearAgentSkillSetupReminderStateCountForTests,
  hasLinearAgentSkillSetupReminderStateForTests,
  resetLinearAgentSkillSetupReminderState
} from './linear-agent-skill-setup-reminders'

afterEach(() => {
  resetLinearAgentSkillSetupReminderState()
})

describe('linear agent skill setup reminders', () => {
  it('bounds runtime reminder state while retaining recently reused keys', () => {
    getLinearAgentSkillSetupReminderState('keep').modalShown = true
    for (let i = 0; i < MAX_LINEAR_AGENT_SKILL_SETUP_REMINDER_RUNTIME_KEYS - 1; i += 1) {
      getLinearAgentSkillSetupReminderState(`runtime-${i}`).toastCount = 1
    }

    expect(getLinearAgentSkillSetupReminderState('keep').modalShown).toBe(true)

    getLinearAgentSkillSetupReminderState('runtime-new')

    expect(getLinearAgentSkillSetupReminderStateCountForTests()).toBe(
      MAX_LINEAR_AGENT_SKILL_SETUP_REMINDER_RUNTIME_KEYS
    )
    expect(hasLinearAgentSkillSetupReminderStateForTests('runtime-0')).toBe(false)
    expect(getLinearAgentSkillSetupReminderState('keep').modalShown).toBe(true)
  })

  it('keeps active toast state ahead of inactive stale entries when trimming', () => {
    getLinearAgentSkillSetupReminderState('toast-active').activeToastId = 'toast-id'
    for (let i = 0; i < MAX_LINEAR_AGENT_SKILL_SETUP_REMINDER_RUNTIME_KEYS; i += 1) {
      getLinearAgentSkillSetupReminderState(`runtime-${i}`)
    }

    expect(getLinearAgentSkillSetupReminderStateCountForTests()).toBe(
      MAX_LINEAR_AGENT_SKILL_SETUP_REMINDER_RUNTIME_KEYS
    )
    expect(hasLinearAgentSkillSetupReminderStateForTests('toast-active')).toBe(true)
    expect(hasLinearAgentSkillSetupReminderStateForTests('runtime-0')).toBe(false)
  })

  it('resets activation ids with reminder state for tests', () => {
    expect(createLinearAgentSkillSetupActivationId()).toBe('linear-agent-skill-setup-0')
    expect(createLinearAgentSkillSetupActivationId()).toBe('linear-agent-skill-setup-1')

    resetLinearAgentSkillSetupReminderState()

    expect(createLinearAgentSkillSetupActivationId()).toBe('linear-agent-skill-setup-0')
  })
})
