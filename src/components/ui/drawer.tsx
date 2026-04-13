import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer'
import { prefill } from 'prefill'

import { cn } from '#/lib/utils'

export const DrawerClose = DrawerPrimitive.Close
export const DrawerTrigger = DrawerPrimitive.Trigger
export const Drawer = prefill(DrawerPrimitive.Root, {
  swipeDirection: 'right',
})

function DrawerContent({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] [--backdrop-opacity:0.2] [--bleed:3rem] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute dark:[--backdrop-opacity:0.7]" />
      <DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex items-stretch justify-end p-(--viewport-padding) [--viewport-padding:0px] supports-[-webkit-touch-callout:none]:[--viewport-padding:0.625rem]">
        <DrawerPrimitive.Popup
          className={cn(
            '-mr-12 h-full w-92 max-w-[calc(100vw-3rem+3rem)] transform-[translateX(var(--drawer-swipe-movement-x))] touch-auto overflow-y-auto overscroll-contain bg-gray-50 p-6 pr-18 text-gray-900 outline outline-gray-200 transition-transform duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] [--bleed:3rem] data-ending-style:transform-[translateX(calc(100%-var(--bleed)+var(--viewport-padding)))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:transform-[translateX(calc(100%-var(--bleed)+var(--viewport-padding)))] data-swiping:select-none supports-[-webkit-touch-callout:none]:mr-0 supports-[-webkit-touch-callout:none]:w-[20rem] supports-[-webkit-touch-callout:none]:max-w-[calc(100vw-20px)] supports-[-webkit-touch-callout:none]:rounded-[10px] supports-[-webkit-touch-callout:none]:pr-6 supports-[-webkit-touch-callout:none]:[--bleed:0px] dark:outline-gray-300',
            className,
          )}
          {...props}
        >
          <DrawerPrimitive.Content className="mx-auto w-full max-w-lg">
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-header"
      className={cn('flex flex-col gap-0.5 p-4 md:gap-1.5 md:text-left', className)}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  )
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export { DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription }
