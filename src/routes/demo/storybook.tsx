import { createFileRoute } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'

export const Route = createFileRoute('/demo/storybook')({
  staticData: { title: 'Storybook', icon: BookOpen },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Storybook</h1>
      <p className="text-muted-foreground">
        Component stories are served separately. Run{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">pnpm storybook</code> to launch the
        Storybook dev server on port 6006.
      </p>
    </div>
  )
}
