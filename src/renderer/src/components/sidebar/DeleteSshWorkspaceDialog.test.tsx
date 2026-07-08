// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteSshWorkspaceDialog } from './DeleteSshWorkspaceDialog'
import { useAppStore } from '@/store'

const toastMocks = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: toastMocks.error } }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_k: string, fallback: string, v?: Record<string, string>) =>
    fallback.replace('{{name}}', v?.name ?? '')
}))

const removeWorktree = vi.fn()

describe('DeleteSshWorkspaceDialog', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    removeWorktree.mockReset().mockResolvedValue({ ok: true })
    useAppStore.setState({
      removeWorktree,
      modalData: { worktreeId: 'repo::/wt', displayName: 'feature-x', targetId: 'ssh-1' }
    })
    toastMocks.error.mockReset()
  })

  afterEach(() => cleanup())

  it('defaults to forget-local (keeps remote) when "delete on remote" is off', async () => {
    const user = userEvent.setup()
    render(<DeleteSshWorkspaceDialog />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(removeWorktree).toHaveBeenCalledWith('repo::/wt', false, { mode: 'forget-local' })
  })

  it('removes the remote worktree when "delete on remote" is enabled', async () => {
    const user = userEvent.setup()
    render(<DeleteSshWorkspaceDialog />)

    const switches = screen.getAllByRole('switch')
    // switches[0] = Remove from Orca (on), switches[1] = Also delete on remote.
    await user.click(switches[1])
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    // Normal remove (no forget-local mode) → hits the remote provider.
    expect(removeWorktree).toHaveBeenCalledWith('repo::/wt', false)
  })

  it('gates "delete on remote" behind "remove from Orca" and disables Delete when off', async () => {
    const user = userEvent.setup()
    render(<DeleteSshWorkspaceDialog />)

    const switches = screen.getAllByRole('switch')
    // Turn OFF "Remove from Orca".
    await user.click(switches[0])

    // The remote toggle is now disabled, and Delete is disabled.
    expect(switches[1]).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('keeps the dialog open and toasts on failure', async () => {
    removeWorktree.mockResolvedValue({ ok: false, error: 'boom' })
    const user = userEvent.setup()
    render(<DeleteSshWorkspaceDialog />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith('boom'))
  })
})
