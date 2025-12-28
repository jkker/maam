import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { useAuthStore } from '@/lib/auth-store'
import { useRPC } from '@/lib/orpc'

import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Field, FieldLabel } from './ui/field'
import { Input } from './ui/input'
import { Spinner } from './ui/spinner'

export function AuthModal() {
  const [userId, setUserId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [deviceName, setDeviceName] = useState('')

  const { orpc, isAuthenticated } = useRPC()
  const loginMutation = useMutation(
    orpc.auth.login.mutationOptions({
      onSuccess: (data) => {
        useAuthStore.setState({ user: data.user, device: data.device, isAuthenticated: true })
        toast.success('Authentication successful')
      },
      onError: (error) => {
        toast.error('Authentication failed: ' + error.message)
      },
    }),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!userId.trim() || !deviceId.trim()) {
      toast.error('User ID and Device ID are required')
      return
    }

    if (deviceId.length < 10) {
      toast.error('Device ID must be at least 10 characters')
      return
    }

    loginMutation.mutate({
      user: userId.trim(),
      device: deviceId.trim(),
      label: deviceName.trim() || undefined,
    })
  }

  // Generate a random device ID
  const generateDeviceId = () => {
    const chars = 'abcdef0123456789'
    let result = ''
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setDeviceId(result)
  }

  return (
    <Dialog open={!isAuthenticated} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Welcome to MAA Manager</DialogTitle>
          <DialogDescription>
            Please authenticate with your user ID and device ID to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="userId">User ID</FieldLabel>
            <Input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID"
              required
              autoFocus
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="deviceId">Device ID</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="deviceId"
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="Enter your device ID"
                required
                className="font-mono text-sm"
              />
              <Button type="button" variant="outline" onClick={generateDeviceId}>
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Must be at least 10 characters. Generate a random ID if you don't have one.
            </p>
          </Field>

          <Field>
            <FieldLabel htmlFor="deviceName">Device Name (Optional)</FieldLabel>
            <Input
              id="deviceName"
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g., My Phone"
            />
          </Field>

          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending && <Spinner className="mr-2" />}
            {loginMutation.isPending ? 'Authenticating...' : 'Continue'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
