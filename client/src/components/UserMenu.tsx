import { LogOut, User } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/lib/auth-store'

import { Button } from './ui/button'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

export function UserMenu() {
  const { user, device } = useAuthStore()

  const handleLogout = () => {
    useAuthStore.setState({ user: undefined, device: undefined, isAuthenticated: false })
    toast.info('Logged out successfully')
    // Reload to show auth modal
    window.location.reload()
  }

  if (!user || !device) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium truncate">{user}</div>
          <div className="text-muted-foreground text-xs font-mono truncate mt-1">
            {device.slice(0, 16)}...
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
