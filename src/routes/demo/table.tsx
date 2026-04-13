import { faker } from '@faker-js/faker'
import { compareItems, rankItem } from '@tanstack/match-sorter-utils'
import type { RankingInfo } from '@tanstack/match-sorter-utils'
import { createFileRoute } from '@tanstack/react-router'
import {
  createColumnHelper,
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  sortingFns,
  useReactTable,
} from '@tanstack/react-table'
import type {
  Column,
  ColumnFiltersState,
  FilterFn,
  SortingFn,
  SortingState,
  Updater,
} from '@tanstack/react-table'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  SearchIcon,
  Table2,
} from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { createStore, useStoreValue } from 'zustand-x'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Pagination, PaginationContent, PaginationItem } from '#/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

// --- Data ---
interface Person {
  id: number
  firstName: string
  lastName: string
  age: number
  visits: number
  progress: number
  status: 'relationship' | 'complicated' | 'single'
  subRows?: Person[]
}

const makeData = (count: number): Person[] => {
  faker.seed(42)

  return Array.from({ length: count }, (_, id) => ({
    id,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    age: faker.number.int(40),
    visits: faker.number.int(1000),
    progress: faker.number.int(100),
    status: faker.helpers.shuffle<Person['status']>(['relationship', 'complicated', 'single'])[0],
  }))
}

export const Route = createFileRoute('/demo/table')({
  staticData: { title: 'Table', icon: Table2 },
  component: TableDemo,
})

const store = createStore(
  {
    data: makeData(5_000),
    globalFilter: '',
    columnFilters: [] as ColumnFiltersState,
    sorting: [] as SortingState,
  },
  { name: 'table-demo', devtools: true },
).extendActions(({ set }) => ({
  onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) =>
    set('columnFilters', (value) => functionalUpdate(updater, value)),
  onSortingChange: (updater: Updater<SortingState>) =>
    set('sorting', (value) => functionalUpdate(updater, value)),
}))

// --- Table config ---

declare module '@tanstack/react-table' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }
  interface FilterMeta {
    itemRank: RankingInfo
  }
}

const fuzzyFilter: FilterFn<Person> = (row, columnId, value: string, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const fuzzySort: SortingFn<Person> = (rowA, rowB, columnId) => {
  let dir = 0
  if (rowA.columnFiltersMeta[columnId]) {
    dir = compareItems(
      rowA.columnFiltersMeta[columnId]?.itemRank,
      rowB.columnFiltersMeta[columnId]?.itemRank,
    )
  }
  return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir
}

const col = createColumnHelper<Person>()

const columns = [
  col.accessor('id', { header: 'ID', filterFn: 'equalsString' }),
  col.accessor('firstName', {
    header: 'First Name',
    filterFn: 'includesStringSensitive',
  }),
  col.accessor('lastName', {
    header: 'Last Name',
    filterFn: 'includesString',
  }),
  col.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: 'fullName',
    header: 'Full Name',
    filterFn: 'fuzzy',
    sortingFn: fuzzySort,
  }),
]

// --- Components ---

function TableDemo() {
  const globalFilter = useStoreValue(store, 'globalFilter')
  const columnFilters = useStoreValue(store, 'columnFilters')
  const sorting = useStoreValue(store, 'sorting')

  // Defer filter values so typing stays snappy while the table re-renders in background
  const deferredGlobalFilter = useDeferredValue(globalFilter)
  const deferredColumnFilters = useDeferredValue(columnFilters)
  const isStale = globalFilter !== deferredGlobalFilter || columnFilters !== deferredColumnFilters

  // Auto-sort by fullName when its column filter is active
  const effectiveSorting =
    columnFilters[0]?.id === 'fullName' && sorting[0]?.id !== 'fullName'
      ? [{ id: 'fullName', desc: false }]
      : sorting

  const table = useReactTable({
    data: useStoreValue(store, 'data'),
    columns,
    filterFns: { fuzzy: fuzzyFilter },
    state: {
      columnFilters: deferredColumnFilters,
      globalFilter: deferredGlobalFilter,
      sorting: effectiveSorting,
    },
    onGlobalFilterChange: (value) => store.set('globalFilter', String(value)),
    onColumnFiltersChange: store.actions.onColumnFiltersChange,
    onSortingChange: store.actions.onSortingChange,
    globalFilterFn: 'fuzzy',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const filteredRowCount = table.getPrePaginationRowModel().rows.length

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-3xl font-bold">TanStack Table</h1>
      <p className="text-muted-foreground">
        Headless table with fuzzy filtering, sorting, and pagination over{' '}
        {filteredRowCount.toLocaleString()} rows.
      </p>

      <Card>
        <CardContent className="space-y-4">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={globalFilter}
              onChange={(e) => store.set('globalFilter', e.target.value)}
              placeholder="Search all columns..."
              className="pl-8"
            />
          </div>

          <div
            className="overflow-x-auto rounded-md border transition-opacity duration-150"
            style={{ opacity: isStale ? 0.6 : 1 }}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className="gap-2 space-y-1 py-2"
                      >
                        {header.isPlaceholder ? null : (
                          <>
                            <div
                              className={
                                header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                              }
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {{ asc: ' \u2191', desc: ' \u2193' }[
                                header.column.getIsSorted() as string
                              ] ?? null}
                            </div>
                            {header.column.getCanFilter() && (
                              <ColumnFilter column={header.column} />
                            )}
                          </>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {filteredRowCount.toLocaleString()} result{filteredRowCount !== 1 ? 's' : ''}
              {isStale && (
                <Badge variant="secondary" className="ml-2">
                  Filtering...
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      Show {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                      aria-label="First page"
                    >
                      <ChevronsLeftIcon />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      aria-label="Previous page"
                    >
                      <ChevronLeftIcon />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-2 text-sm text-muted-foreground">
                      {pageIndex + 1} / {pageCount}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      aria-label="Next page"
                    >
                      <ChevronRightIcon />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => table.setPageIndex(pageCount - 1)}
                      disabled={!table.getCanNextPage()}
                      aria-label="Last page"
                    >
                      <ChevronsRightIcon />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ColumnFilter({ column }: { column: Column<Person> }) {
  const filterValue = (column.getFilterValue() as string | undefined) ?? ''
  const [value, setValue] = useState(filterValue)
  const deferredValue = useDeferredValue(value)

  // Sync deferred value to table filter declaratively during render
  if (filterValue !== deferredValue) {
    column.setFilterValue(deferredValue)
  }

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Filter..."
      className="h-7 text-xs"
    />
  )
}
