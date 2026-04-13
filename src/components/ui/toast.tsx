import { Toast } from '@base-ui/react/toast'
import { XIcon } from 'lucide-react'
/**
 * Global toast manager - enables calling toast() from anywhere in the app,
 * including outside of React components.
 */
export const toastManager = Toast.createToastManager()

/**
 * Imperative toast API compatible with common toast patterns.
 *
 * @example
 * toast('Hello world')
 * toast.success('Saved!')
 * toast.error('Failed', { description: 'Something went wrong' })
 * toast.promise(fetch('/api'), { loading: 'Loading...', success: 'Done', error: 'Failed' })
 */
export function toast(
  title: string,
  options?: { description?: string; action?: { label: string; onClick: () => void } },
) {
  return toastManager.add({
    title,
    description: options?.description,
    actionProps: options?.action
      ? { children: options.action.label, onClick: options.action.onClick }
      : undefined,
  })
}

toast.success = (
  title: string,
  options?: { description?: string; action?: { label: string; onClick: () => void } },
) =>
  toastManager.add({
    type: 'success',
    title,
    description: options?.description,
    actionProps: options?.action
      ? { children: options.action.label, onClick: options.action.onClick }
      : undefined,
  })

toast.error = (
  title: string,
  options?: { description?: string; action?: { label: string; onClick: () => void } },
) =>
  toastManager.add({
    type: 'error',
    title,
    description: options?.description,
    priority: 'high',
    actionProps: options?.action
      ? { children: options.action.label, onClick: options.action.onClick }
      : undefined,
  })

toast.info = (
  title: string,
  options?: { description?: string; action?: { label: string; onClick: () => void } },
) =>
  toastManager.add({
    type: 'info',
    title,
    description: options?.description,
    actionProps: options?.action
      ? { children: options.action.label, onClick: options.action.onClick }
      : undefined,
  })

toast.warning = (
  title: string,
  options?: { description?: string; action?: { label: string; onClick: () => void } },
) =>
  toastManager.add({
    type: 'warning',
    title,
    description: options?.description,
    actionProps: options?.action
      ? { children: options.action.label, onClick: options.action.onClick }
      : undefined,
  })

toast.loading = (title: string, options?: { description?: string }) =>
  toastManager.add({
    type: 'loading',
    title,
    description: options?.description,
    timeout: 0,
  })

toast.promise = toastManager.promise.bind(toastManager)
toast.dismiss = toastManager.close.bind(toastManager)

export function ToastProvider({ children }: React.PropsWithChildren) {
  return (
    <Toast.Provider toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className="fixed top-auto right-4 bottom-4 z-10 mx-auto flex w-62.5 sm:right-8 sm:bottom-8 sm:w-75">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
      {children}
    </Toast.Provider>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] mr-0 h-(--height) w-full origin-bottom transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] rounded-lg border border-gray-200 bg-sidebar bg-clip-padding p-4 shadow-md backdrop-blur select-none [--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [transition:transform_0.5s_cubic-bezier(0.22,1,0.36,1),opacity_0.5s,height_0.15s] after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] data-ending-style:opacity-0 data-expanded:h-(--toast-height) data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))] data-limited:opacity-0 data-starting-style:transform-[translateY(150%)] data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))] data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))] data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))] data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:transform-[translateY(150%)]"
      data-sonner-toast={toast.id} // for backwards compatibility with sonner
    >
      <Toast.Content className="overflow-hidden transition-opacity duration-250 data-behind:pointer-events-none data-behind:opacity-0 data-expanded:pointer-events-auto data-expanded:opacity-100">
        <Toast.Title className="text-[0.975rem] leading-5 font-medium" />
        <Toast.Description className="text-[0.925rem] leading-5 text-gray-700" />
        <Toast.Close
          className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded border-none bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close"
        >
          <XIcon className="h-4 w-4" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}
