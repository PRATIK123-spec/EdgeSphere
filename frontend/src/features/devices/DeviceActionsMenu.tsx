import { useState } from 'react'
import { Link } from 'react-router'
import { Eye, KeyRound, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteDeviceDialog } from '@/features/devices/DeleteDeviceDialog'
import { EditDeviceDialog } from '@/features/devices/EditDeviceDialog'
import { RotateKeyDialog } from '@/features/devices/RotateKeyDialog'
import type { DeviceResponse } from '@/types/api'

/** Row-level actions: view, edit, delete. */
export function DeviceActionsMenu({ device }: { device: DeviceResponse }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)

  return (
    // Dialogs render in portals but React events still bubble through this
    // element; stop them so they don't trigger the table row's navigation.
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {/* Non-modal so opening a dialog from an item doesn't fight the menu's focus lock */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${device.display_name}`}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link to={`/devices/${device.id}`}>
              <Eye aria-hidden="true" /> View details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil aria-hidden="true" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRotateOpen(true)}>
            <KeyRound aria-hidden="true" /> Rotate key
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDeviceDialog device={device} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteDeviceDialog device={device} open={deleteOpen} onOpenChange={setDeleteOpen} />
      <RotateKeyDialog device={device} open={rotateOpen} onOpenChange={setRotateOpen} />
    </div>
  )
}
