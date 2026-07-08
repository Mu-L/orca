import React, { useMemo, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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
  const [busy, setBusy] = useState(false)
  // Why: removing the host only (keeping workspaces) is the safe, reversible
  // default. Deleting the remote workspaces is destructive, so it lives behind
  // an Advanced disclosure and must be opted into explicitly.
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [deleteWorkspaces, setDeleteWorkspaces] = useState(false)
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

  const runSshRemoval = async (): Promise<void> => {
    if (target.kind !== 'ssh') {
      return
    }
    setBusy(true)
    try {
      if (deleteWorkspaces && sshResolution) {
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
            setBusy(false)
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
        setBusy(false)
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
        ? translate(
            'auto.components.sidebar.HostRemoveDialog.hostHasWorkspacesDefault',
            'Removes {{value0}} and its credentials from this computer. Its {{value1}} stay in Orca — remote files are not touched.',
            { value0: label, value1: workspaceCountLabel }
          )
        : translate(
            'auto.components.sidebar.HostRemoveDialog.5e6f7a8b9c',
            'This removes the saved SSH host and its credentials from this computer. Remote files are not deleted.'
          )

  // The destructive opt-in wording depends on whether we delete remote files or
  // only forget Orca's records (offline/ghost host).
  const deleteOptionLabel = isConnected
    ? translate(
        'auto.components.sidebar.HostRemoveDialog.alsoDeleteRemote',
        'Also delete these {{value0}} on the remote',
        { value0: workspaceCountLabel }
      )
    : translate(
        'auto.components.sidebar.HostRemoveDialog.alsoForgetLocal',
        'Also remove these {{value0}} from Orca',
        { value0: workspaceCountLabel }
      )

  const primaryLabel = deleteWorkspaces
    ? isConnected
      ? translate(
          'auto.components.sidebar.HostRemoveDialog.deleteHostAndWorkspaces',
          'Remove host & delete workspaces'
        )
      : translate(
          'auto.components.sidebar.HostRemoveDialog.removeHostForgetWorkspaces',
          'Remove host & workspaces'
        )
    : translate('auto.components.sidebar.HostRemoveDialog.8b9c0d1e2f', 'Remove host')

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

        {/* Advanced disclosure: deleting the host's workspaces is destructive, so
            it's opt-in and hidden by default. Only shown when there are any. */}
        {target.kind === 'ssh' && hasWorkspaces ? (
          <div className="min-w-0 rounded-md border border-border bg-muted/30">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="font-medium text-muted-foreground">
                {translate('auto.components.sidebar.HostRemoveDialog.advanced', 'Advanced')}
              </span>
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  advancedOpen && 'rotate-180'
                )}
              />
            </button>
            {advancedOpen ? (
              <label className="flex cursor-pointer items-start gap-2.5 border-t border-border px-3 py-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={deleteWorkspaces}
                  onChange={(e) => setDeleteWorkspaces(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 accent-destructive"
                />
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="font-medium text-foreground">{deleteOptionLabel}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {isConnected
                      ? translate(
                          'auto.components.sidebar.HostRemoveDialog.alsoDeleteRemoteHint',
                          'Permanently deletes the remote Git worktrees and their branches. Cannot be undone.'
                        )
                      : translate(
                          'auto.components.sidebar.HostRemoveDialog.alsoForgetLocalHint',
                          'Clears them from Orca only. Remote files, worktrees, and branches are left untouched.'
                        )}
                  </span>
                </span>
              </label>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
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
          ) : (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void runSshRemoval()}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {primaryLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
