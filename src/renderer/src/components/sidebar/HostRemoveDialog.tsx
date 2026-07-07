import React, { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import { useAppStore } from '@/store'
import { getAllWorktreesFromState } from '@/store/selectors'
import { translate } from '@/i18n/i18n'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { removeSshTargetWithBestEffortCleanup } from '../settings/ssh-target-remove'
import { clearHostRename } from './host-rename-remove'
import type { HostRemovalTarget } from './host-rename-remove'
import { resolveSshHostRemoval } from './ssh-host-remove-resolution'
import { clearSshHostWorkspaces } from './ssh-host-remove-workspaces'

type HostRemoveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  hostId: ExecutionHostId
  label: string
  target: NonNullable<HostRemovalTarget>
}

export function HostRemoveDialog({
  open,
  onOpenChange,
  hostId,
  label,
  target
}: HostRemoveDialogProps): React.JSX.Element {
  const [busy, setBusy] = useState<null | 'with-workspaces' | 'host-only'>(null)
  const mountedRef = useMountedRef()

  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)

  // Resolve which workspaces live on the target so the dialog can offer to
  // delete/forget them alongside the host.
  const sshResolution = useMemo(() => {
    if (target.kind !== 'ssh') {
      return null
    }
    return resolveSshHostRemoval({
      targetId: target.targetId,
      repos,
      worktrees: getAllWorktreesFromState({ worktreesByRepo }),
      sshConnectionStates
    })
  }, [target, repos, worktreesByRepo, sshConnectionStates])

  const workspaceCount = sshResolution?.workspaceCount ?? 0
  const hasWorkspaces = workspaceCount > 0
  const isConnected = sshResolution?.isConnected ?? false

  // Why: dropping a host should also drop its now-orphaned label override so a
  // future host reusing the same id doesn't inherit a stale rename.
  const dropOverridesForHost = (): void => {
    const state = useAppStore.getState()
    void state.updateSettings({
      hostSettingOverrides: clearHostRename(state.settings, hostId)
    })
  }

  const removeSshTarget = async (targetId: string): Promise<void> => {
    await removeSshTargetWithBestEffortCleanup(window.api.ssh, targetId)
    // Why: clear deferred reconnect metadata so focused SSH tabs stop retrying
    // the deleted target — mirrors the SSH settings pane removal flow.
    useAppStore.getState().clearRemovedSshTargetState(targetId)
    dropOverridesForHost()
  }

  // Why: runtime-environment removal needs active-environment switching and
  // error context owned by the Orca servers settings pane, so we deep-link
  // there with the host pre-selected instead of duplicating that flow.
  const handleRemoveRuntime = (environmentId: string): void => {
    const state = useAppStore.getState()
    state.openSettingsTarget({ pane: 'servers', repoId: null, sectionId: environmentId })
    state.openSettingsPage()
    onOpenChange(false)
  }

  const runSshRemoval = async (
    mode: 'with-workspaces' | 'host-only',
    busyKey: 'with-workspaces' | 'host-only'
  ): Promise<void> => {
    if (target.kind !== 'ssh') {
      return
    }
    setBusy(busyKey)
    try {
      if (mode === 'with-workspaces' && sshResolution) {
        // Connected → real remote removal; offline/ghost → local forget.
        const { failedIds } = await clearSshHostWorkspaces(
          sshResolution,
          isConnected ? 'delete-remote' : 'forget-local'
        )
        // Why: don't remove the SSH target (and report success) while some of its
        // workspaces failed to clear — that would strand ghost rows behind a
        // now-gone host. Surface the failure and keep the target so the user can
        // retry or resolve the blocking workspace first.
        if (failedIds.length > 0) {
          if (mountedRef.current) {
            setBusy(null)
          }
          toast.error(
            translate(
              'auto.components.sidebar.HostRemoveDialog.workspacesFailed',
              'Could not remove {{count}} of this host’s workspaces. The host was kept so you can retry.',
              { count: failedIds.length }
            )
          )
          return
        }
      }
      await removeSshTarget(target.targetId)
      if (mountedRef.current) {
        onOpenChange(false)
      }
      toast.success(
        translate('auto.components.sidebar.HostRemoveDialog.1a2b3c4d5e', 'Removed {{value0}}', {
          value0: label
        })
      )
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : translate(
              'auto.components.sidebar.HostRemoveDialog.2b3c4d5e6f',
              'Failed to remove host'
            )
      )
    } finally {
      if (mountedRef.current) {
        setBusy(null)
      }
    }
  }

  const workspaceCountLabel =
    workspaceCount === 1
      ? translate('auto.components.sidebar.HostRemoveDialog.oneWorkspace', '1 workspace')
      : translate(
          'auto.components.sidebar.HostRemoveDialog.manyWorkspaces',
          '{{count}} workspaces',
          {
            count: workspaceCount
          }
        )

  const description =
    target.kind === 'runtime'
      ? translate(
          'auto.components.sidebar.HostRemoveDialog.4d5e6f7a8b',
          'This opens the Orca servers settings where you can remove this server.'
        )
      : hasWorkspaces
        ? isConnected
          ? translate(
              'auto.components.sidebar.HostRemoveDialog.hostHasWorkspacesConnected',
              '{{value0}} has {{value1}}. You can delete them on the remote too, or keep them and remove the host only.',
              { value0: label, value1: workspaceCountLabel }
            )
          : translate(
              'auto.components.sidebar.HostRemoveDialog.hostHasWorkspacesOffline',
              '{{value0}} has {{value1}}. The host is not connected, so they can only be removed from Orca — remote files are left untouched.',
              { value0: label, value1: workspaceCountLabel }
            )
        : translate(
            'auto.components.sidebar.HostRemoveDialog.5e6f7a8b9c',
            'This removes the saved SSH host and its credentials from this computer. Remote files are not deleted.'
          )

  // Label for the "also clear the workspaces" action depends on whether the
  // removal deletes remote files or only forgets Orca's records.
  const withWorkspacesLabel = isConnected
    ? translate(
        'auto.components.sidebar.HostRemoveDialog.deleteHostAndWorkspaces',
        'Delete host & workspaces'
      )
    : translate(
        'auto.components.sidebar.HostRemoveDialog.removeHostForgetWorkspaces',
        'Remove host & forget workspaces'
      )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.sidebar.HostRemoveDialog.3c4d5e6f7a',
              'Remove {{value0}}?',
              {
                value0: label
              }
            )}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {translate('auto.components.sidebar.HostRemoveDialog.6f7a8b9c0d', 'Cancel')}
          </Button>
          {target.kind === 'runtime' ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleRemoveRuntime(target.environmentId)}
            >
              {translate('auto.components.sidebar.HostRemoveDialog.7a8b9c0d1e', 'Open settings')}
            </Button>
          ) : hasWorkspaces ? (
            <>
              {/* Keep-workspaces path stays available whenever remote delete is
                  possible; when offline it isn't offered since "keep" would just
                  recreate the ghost state the user is trying to clear. */}
              {isConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy != null}
                  onClick={() => void runSshRemoval('host-only', 'host-only')}
                >
                  {busy === 'host-only' ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {translate(
                    'auto.components.sidebar.HostRemoveDialog.keepWorkspaces',
                    'Keep workspaces, remove host'
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                disabled={busy != null}
                onClick={() => void runSshRemoval('with-workspaces', 'with-workspaces')}
              >
                {busy === 'with-workspaces' ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {withWorkspacesLabel}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="destructive"
              disabled={busy != null}
              onClick={() => void runSshRemoval('host-only', 'host-only')}
            >
              {busy === 'host-only' ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {translate('auto.components.sidebar.HostRemoveDialog.8b9c0d1e2f', 'Remove host')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
