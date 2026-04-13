---
name: zustand-x
description: Type-safe Zustand state management with auto-generated hooks, selectors, and actions. Use when implementing or working with Zustand stores in React apps, especially when creating new stores, adding selectors/actions, using middleware (devtools, persist, immer, mutative), or migrating from plain Zustand to get better DX with less boilerplate.
---

# Zustand X

Type-safe state management built on Zustand with auto-generated hooks, simplified API patterns, and extensible selectors/actions.

## Quick Start

Create a basic store:

```tsx
import { createStore, useStoreValue, useStoreState } from 'zustand-x'

const repoStore = createStore({
  name: 'ZustandX',
  stars: 0,
})

function RepoInfo() {
  const name = useStoreValue(repoStore, 'name')
  const stars = useStoreValue(repoStore, 'stars')

  return (
    <div>
      <h1>{name}</h1>
      <p>{stars} stars</p>
    </div>
  )
}

function AddStarButton() {
  const [, setStars] = useStoreState(repoStore, 'stars')
  return <button onClick={() => setStars((s) => s + 1)}>Add star</button>
}
```

## Core Patterns

### Store Creation with Middleware

```tsx
const userStore = createStore(
  {
    name: 'Alice',
    loggedIn: false,
  },
  {
    name: 'user',
    devtools: true, // Redux DevTools
    persist: true, // localStorage persistence
    mutative: true, // Immer-style mutations
  },
)
```

### Reading State

```ts
// Get single value
store.get('name') // => 'Alice'

// Get entire state
store.get('state')

// Call selector with arguments
store.get('someSelector', 1, 2)
```

### Writing State

```ts
// Set single value
store.set('name', 'Bob')

// Call action
store.set('someAction', 10)

// Update multiple values
store.set('state', (draft) => {
  draft.name = 'Bob'
  draft.loggedIn = true
  return draft // Required with immer
})
```

### Subscribing to Changes

```ts
// Subscribe to field
const unsubscribe = store.subscribe('name', (name, previousName) => {
  console.log('Name changed from', previousName, 'to', name)
})

// Subscribe to state
const unsubscribe = store.subscribe('state', (state) => {
  console.log('State changed:', state)
})

// Fire immediately on subscribe
const unsubscribe = store.subscribe(
  'name',
  (name) => name.length,
  (length) => console.log('Name length:', length),
  { fireImmediately: true },
)
```

## React Hooks

### `useStoreValue(store, key, ...args)`

Subscribe to a single value or selector:

```tsx
const name = useStoreValue(store, 'name')

// With selector arguments
const greeting = useStoreValue(store, 'greeting', 'Hello')

// With custom equality for arrays/objects
const items = useStoreValue(
  store,
  'items',
  (a, b) => a.length === b.length && a.every((item, i) => item.id === b[i].id),
)
```

### `useStoreState(store, key, [equalityFn])`

Get value and setter like `useState`, perfect for forms:

```tsx
function UserForm() {
  const [name, setName] = useStoreState(store, 'name')
  const [email, setEmail] = useStoreState(store, 'email')

  return (
    <form>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
    </form>
  )
}
```

### `useTracked(store, key)`

Subscribe with minimal re-renders for large objects:

```tsx
function UserEmail() {
  // Only re-renders when user.email changes
  const user = useTracked(store, 'user')
  return <div>{user.email}</div>
}
```

## Extending Stores

### Adding Selectors

Derive computed values from state:

```tsx
const store = createStore({ firstName: 'Jane', lastName: 'Doe' }, { mutative: true })

const extendedStore = store
  .extendSelectors(({ get }) => ({
    fullName: () => get('firstName') + ' ' + get('lastName'),
  }))
  .extendSelectors(({ get }) => ({
    fancyTitle: (prefix: string) => prefix + get('fullName').toUpperCase(),
  }))

// Usage
extendedStore.get('fullName') // => 'Jane Doe'
extendedStore.get('fancyTitle', 'Hello ') // => 'Hello JANE DOE'

// In components
function Title() {
  const fancyTitle = useStoreValue(extendedStore, 'fancyTitle', 'Welcome ')
  return <h1>{fancyTitle}</h1>
}
```

### Adding Actions

Create functions that modify state:

```tsx
const storeWithActions = store.extendActions(({ get, set, actions: { someActionToOverride } }) => ({
  updateName: (newName: string) => set('name', newName),
  resetState: () => {
    set('state', (draft) => {
      draft.firstName = 'Jane'
      draft.lastName = 'Doe'
      return draft
    })
  },
  someActionToOverride: () => {
    // Override or call original: someActionToOverride()
  },
}))

// Usage
storeWithActions.set('updateName', 'Julia')
storeWithActions.set('resetState')
```

## Middleware Options

```tsx
const store = createStore(
  { name: 'ZustandX', stars: 10 },
  {
    name: 'repo',
    devtools: { enabled: true }, // Redux DevTools with options
    persist: { enabled: true }, // localStorage with options
    mutative: true, // shorthand for { enabled: true }
  },
)
```

## Key Differences from Plain Zustand

- Auto-generated hooks for each state field (no manual selectors)
- Direct field access: `store.get('name')` vs `store.getState().name`
- Simplified actions: `store.set('name', value)` pattern
- Type-safe by default without extra annotations
- Computed values auto-memoized with `extendSelectors`
