import { createFileRoute, Link } from '@tanstack/react-router'
import { Info } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/about')({
  staticData: { title: 'About', icon: Info },
  component: AboutPage,
})

const stack = [
  { name: 'React 19', desc: 'UI framework with React Compiler' },
  { name: 'Vite+', desc: 'Unified dev, build, test, lint & format' },
  { name: 'TanStack Router', desc: 'Type-safe file-based routing' },
  { name: 'TanStack Query', desc: 'Async state management' },
  { name: 'TanStack Form', desc: 'Headless form management' },
  { name: 'TanStack Table', desc: 'Headless table with sorting & filtering' },
  { name: 'Zustand X', desc: 'Type-safe stores with auto-generated hooks' },
  { name: 'Tailwind CSS 4', desc: 'Utility-first styling' },
  { name: 'shadcn/ui', desc: 'Accessible component primitives' },
  { name: 'Arktype', desc: 'Runtime type validation' },
  { name: 'i18next', desc: 'Internationalization framework' },
  { name: 'Temporal', desc: 'Modern date/time polyfill' },
] as const

function AboutPage() {
  return (
    <article className="container mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">About This Template</h1>
        <p className="text-lg text-muted-foreground">
          A production-ready React SPA starter with modern tooling, type-safe routing, and
          enterprise patterns baked in.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Tech Stack</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {stack.map(({ name, desc }) => (
            <Card key={name} className="gap-2 py-3">
              <CardHeader className="py-0">
                <CardTitle className="text-sm font-medium">{name}</CardTitle>
                <CardDescription className="text-xs">{desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Key Patterns</h2>
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {[
                'File-based routing',
                'i18n route labels',
                'Zustand persist',
                'Arktype validation',
                'React Compiler',
                'Node subpath imports',
              ].map((pattern) => (
                <Badge key={pattern} variant="secondary">
                  {pattern}
                </Badge>
              ))}
            </div>
            <p className="text-muted-foreground">
              Route titles are driven by{' '}
              <code className="rounded bg-muted px-1 text-xs">routes.json</code> via i18next, with{' '}
              <code className="rounded bg-muted px-1 text-xs">startCase</code> fallback. Icons are
              declared per-route in{' '}
              <code className="rounded bg-muted px-1 text-xs">staticData</code>.
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="flex gap-3">
        <Button variant="outline" render={<Link to="/demo" />}>
          View Demos
        </Button>
      </div>
    </article>
  )
}
