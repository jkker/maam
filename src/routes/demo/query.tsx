import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Search } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/demo/query')({
  staticData: { title: 'Query', icon: Search },
  component: TanStackQueryDemo,
})

const fetchUsers = () =>
  Promise.resolve([
    { id: 1, name: 'Alice', role: 'Engineer' },
    { id: 2, name: 'Bob', role: 'Designer' },
    { id: 3, name: 'Charlie', role: 'Product' },
  ])

function TanStackQueryDemo() {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['demo-users'],
    queryFn: fetchUsers,
    initialData: [],
  })

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">TanStack Query</h1>
        <p className="text-muted-foreground">
          Declarative data fetching with caching, background refetches, and stale-while-revalidate.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription suppressHydrationWarning>
            {isLoading
              ? 'Loading…'
              : `${data.length} users · last fetched ${new Date(dataUpdatedAt).toLocaleTimeString()}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {data.map((user) => (
              <li key={user.id} className="flex items-center justify-between py-3">
                <span className="font-medium">{user.name}</span>
                <Badge variant="secondary">{user.role}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
