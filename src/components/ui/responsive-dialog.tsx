import * as React from 'react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#/components/ui/drawer'
import { useIsMobile } from '#/hooks/use-mobile'
import { createContext } from '#/lib/context'

const [useResponsiveDialog, ResponsiveDialogContext] = createContext({
  name: 'ResponsiveDialogContext',
  defaultValue: { isMobile: false },
})

function ResponsiveDialog({
  children,
  ...props
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()

  return (
    <ResponsiveDialogContext value={{ isMobile }}>
      {isMobile ? <Drawer {...props}>{children}</Drawer> : <Dialog {...props}>{children}</Dialog>}
    </ResponsiveDialogContext>
  )
}

function ResponsiveDialogTrigger({
  children,
  ...props
}: React.ComponentProps<typeof DrawerTrigger>) {
  const { isMobile } = useResponsiveDialog()
  return isMobile ? (
    <DrawerTrigger {...props}>{children}</DrawerTrigger>
  ) : (
    <DialogTrigger {...props}>{children}</DialogTrigger>
  )
}

function ResponsiveDialogContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { isMobile } = useResponsiveDialog()
  return isMobile ? (
    <DrawerContent className={className}>{children}</DrawerContent>
  ) : (
    <DialogContent className={className}>{children}</DialogContent>
  )
}

function ResponsiveDialogHeader({ children, ...props }: React.ComponentProps<typeof DialogHeader>) {
  const { isMobile } = useResponsiveDialog()
  return isMobile ? (
    <DrawerHeader {...props}>{children}</DrawerHeader>
  ) : (
    <DialogHeader {...props}>{children}</DialogHeader>
  )
}

function ResponsiveDialogFooter({ children, ...props }: React.ComponentProps<typeof DialogFooter>) {
  const { isMobile } = useResponsiveDialog()
  return isMobile ? (
    <DrawerFooter {...props}>{children}</DrawerFooter>
  ) : (
    <DialogFooter {...props}>{children}</DialogFooter>
  )
}

function ResponsiveDialogTitle({ children, ...props }: React.ComponentProps<typeof DrawerTitle>) {
  const { isMobile } = useResponsiveDialog()
  return isMobile ? (
    <DrawerTitle {...props}>{children}</DrawerTitle>
  ) : (
    <DialogTitle {...props}>{children}</DialogTitle>
  )
}

function ResponsiveDialogDescription({
  children,
  ...props
}: React.ComponentProps<typeof DrawerDescription>) {
  const { isMobile } = useResponsiveDialog()
  return isMobile ? (
    <DrawerDescription {...props}>{children}</DrawerDescription>
  ) : (
    <DialogDescription {...props}>{children}</DialogDescription>
  )
}

function ResponsiveDialogClose({ children, ...props }: React.ComponentProps<typeof DrawerClose>) {
  const { isMobile } = useResponsiveDialog()
  return isMobile ? (
    <DrawerClose {...props}>{children}</DrawerClose>
  ) : (
    <DialogClose {...props}>{children}</DialogClose>
  )
}

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
}
