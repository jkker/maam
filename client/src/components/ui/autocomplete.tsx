import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Transition,
} from '@headlessui/react'

import { ChevronsUpDown } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface AutocompleteOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export interface AutocompleteProps {
  options: AutocompleteOption[]
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  onQueryChange?: (query: string) => void
  placeholder?: string
  emptyMessage?: string
  allowArbitrary?: boolean
  disabled?: boolean
  className?: string
  name?: string
}

function Autocomplete({
  options,
  value,
  defaultValue,
  onChange,
  onQueryChange,
  placeholder = 'Search...',
  emptyMessage = 'No results found.',
  allowArbitrary = true,
  disabled = false,
  className,
  name,
}: AutocompleteProps) {
  const [query, setQuery] = React.useState('')

  const handleQueryChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = event.target.value
      setQuery(newQuery)
      onQueryChange?.(newQuery)
    },
    [onQueryChange],
  )

  const filteredOptions = React.useMemo(() => {
    if (query === '') {
      return options
    }
    return options.filter((option) => {
      if (typeof option.label === 'string') {
        return (
          option.label.toLowerCase().includes(query.toLowerCase()) ||
          option.value.toLowerCase().includes(query.toLowerCase())
        )
      }
      return option.value.toLowerCase().includes(query.toLowerCase())
    })
  }, [options, query])

  const displayValue = React.useCallback(
    (value: string | null) => {
      if (!value) return ''
      const option = options.find((opt) => opt.value === value)
      return typeof option?.label === 'string' ? (option?.label ?? value) : value
    },
    [options],
  )

  const showCustomOption =
    allowArbitrary &&
    query.length > 0 &&
    !filteredOptions.some((option) => option.value.toLowerCase() === query.toLowerCase())

  return (
    <Combobox
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={disabled}
      name={name}
    >
      {({ open }) => (
        <div className={cn('relative', className)}>
          <div className="relative">
            <ComboboxInput
              className={cn(
                'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                'pl-3 pr-10',
              )}
              displayValue={displayValue}
              onChange={handleQueryChange}
              placeholder={placeholder}
              autoComplete="off"
            />
            <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronsUpDown className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            </ComboboxButton>
          </div>
          <Transition
            show={open}
            as={React.Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <ComboboxOptions
              className={cn(
                'border-input bg-popover text-popover-foreground absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow-lg',
                'focus:outline-none',
              )}
            >
              {showCustomOption && (
                <ComboboxOption
                  value={query}
                  className={({ focus }) =>
                    cn(
                      'relative cursor-pointer select-none p-2',
                      focus ? 'bg-accent text-accent-foreground' : 'text-foreground',
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className={cn('block truncate', selected && 'font-medium bg-accent')}>
                        "{query}"
                      </span>
                    </>
                  )}
                </ComboboxOption>
              )}
              {filteredOptions.length === 0 && !showCustomOption ? (
                <div className="text-muted-foreground relative cursor-default select-none px-4 py-2 text-sm">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <ComboboxOption
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={({ focus, disabled }) =>
                      cn(
                        'relative cursor-pointer select-none p-2',
                        focus && !disabled && 'bg-accent text-accent-foreground',
                        !focus && !disabled && 'text-foreground',
                        disabled && 'text-muted-foreground cursor-not-allowed opacity-50',
                      )
                    }
                  >
                    {({ selected }) => (
                      <>
                        <span className={cn('block truncate', selected && 'font-medium bg-accent')}>
                          {option.label}
                        </span>
                      </>
                    )}
                  </ComboboxOption>
                ))
              )}
            </ComboboxOptions>
          </Transition>
        </div>
      )}
    </Combobox>
  )
}

export { Autocomplete }
