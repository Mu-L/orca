import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMountedRef } from '@/hooks/useMountedRef'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'

type DeleteSshWorkspaceModalData = {
  worktreeId: string
  displayName: string
  targetId: string
}

function isModalData(data: unknown): data is DeleteSshWorkspaceModalData {
  if (!data || typeof data !== 'object') {
    return false
  }
  const candidate = data as Partial<DeleteSshWorkspaceModalData>
  return typeof candidate.worktreeId === 'string' && typeof candidate.displayName === 'string'
}

// A borderless switch matching the New Workspace composer's Advanced toggle.
function ToggleSwitch({
  checked,
  disabled,
  onChange
}: {
  checked: boolean
  disabled?: boolean
  onChange: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'group mt-0.5 flex shrink-0 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors',
          checked ? 'bg-foreground' : 'bg-muted-foreground/30'
        )}
      >
        <span
          className={cn(
            'pointer-events-none block size-3.5 rounded-full bg-background shadow-sm transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  )
}

export function DeleteSshWorkspaceDialog(): React.JSX.Element | null {
  const modalData = useAppStore((s) => s.modalData)
  const closeModal = useAppStore((s) => s.closeModal)
  const [busy, setBusy] = useState(false)
  // Toggle 1: remove the workspace from Orca. On by default — it's the base
  // action. Toggle 2 is gated on this being enabled.
  const [removeFromOrca, setRemoveFromOrca] = useState(true)
  // Toggle 2: also delete the worktree/branch on the remote. Off by default.
  const [deleteOnRemote, setDeleteOnRemote] = useState(false)
  const mountedRef = useMountedRef()

  if (!isModalData(modalData)) {
    return null
  }
  const { worktreeId, displayName } = modalData

  const handleDelete = async (): Promise<void> => {
    if (!removeFromOrca) {
      return
    }
    setBusy(true)
    try {
      // deleteOnRemote off → forget-local (keep remote); on → normal remote removal.
      const result = deleteOnRemote
        ? await useAppStore.getState().removeWorktree(worktreeId, false)
        : await useAppStore.getState().removeWorktree(worktreeId, false, { mode: 'forget-local' })
      if (!result.ok) {
        toast.error(result.error)
        if (mountedRef.current) {
          setBusy(false)
        }
        return
      }
      if (mountedRef.current) {
        setBusy(false)
        closeModal()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      if (mountedRef.current) {
        setBusy(false)
      }
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? closeModal() : undefined)}>
      <DialogContent className="sm:max-w-md gap-3">
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.sidebar.DeleteSshWorkspaceDialog.title',
              'Delete “{{name}}”?',
              {
                name: displayName
              }
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.sidebar.DeleteSshWorkspaceDialog.body',
              'By default this removes the workspace from Orca only. The remote worktree and branch are kept unless you also choose to delete them.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <ToggleSwitch checked={removeFromOrca} onChange={() => setRemoveFromOrca((v) => !v)} />
            <span className="min-w-0 flex-1 text-xs leading-snug">
              <span className="font-medium text-foreground">
                {translate(
                  'auto.components.sidebar.DeleteSshWorkspaceDialog.removeFromOrca',
                  'Remove from Orca'
                )}
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                {translate(
                  'auto.components.sidebar.DeleteSshWorkspaceDialog.removeFromOrcaHint',
                  'Clears this workspace’s tabs, history, and metadata from Orca.'
                )}
              </span>
            </span>
          </div>

          <div className="flex items-start gap-3">
            <ToggleSwitch
              checked={deleteOnRemote}
              // Why: gated on Remove from Orca — you can't delete the remote
              // copy while keeping the Orca record.
              disabled={!removeFromOrca}
              onChange={() => setDeleteOnRemote((v) => !v)}
            />
            <span
              className={cn('min-w-0 flex-1 text-xs leading-snug', !removeFromOrca && 'opacity-40')}
            >
              <span className="font-medium text-foreground">
                {translate(
                  'auto.components.sidebar.DeleteSshWorkspaceDialog.deleteOnRemote',
                  'Also delete on the remote'
                )}
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                {translate(
                  'auto.components.sidebar.DeleteSshWorkspaceDialog.deleteOnRemoteHint',
                  'Permanently deletes the remote Git worktree and its branch. Cannot be undone.'
                )}
              </span>
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => closeModal()}>
            {translate('auto.components.sidebar.DeleteSshWorkspaceDialog.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy || !removeFromOrca}
            onClick={() => void handleDelete()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {translate('auto.components.sidebar.DeleteSshWorkspaceDialog.delete', 'Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteSshWorkspaceDialog
