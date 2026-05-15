'use client'

import { Toaster } from 'sonner'

export function SonnerToaster() {
  return (
    <Toaster
      closeButton
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          warning:
            '!border-yellow-400/80 !bg-yellow-50 !text-yellow-950 dark:!bg-yellow-950/90 dark:!text-yellow-50',
        },
      }}
    />
  )
}
