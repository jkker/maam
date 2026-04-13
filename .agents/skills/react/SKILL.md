---
name: react
description: React 19+ development patterns, Rules of React, and performance optimization. Apply when writing, reviewing, or refactoring React components, hooks, state management, effects, and composition patterns.
---

# React

Modern React development patterns for React 19+. Covers the Rules of React, compiler-friendly patterns, composition, state management, and performance.

## Rules of React

React requires components and hooks to follow specific rules for correctness and optimization.

### Purity

Components and hooks must be pure—idempotent, side-effect free during render, and never mutate inputs.

```tsx
// ❌ Mutates argument
function Item({ item }) {
  item.url = new URL(item.url, base)
  return <Link url={item.url}>{item.title}</Link>
}

// ✅ Creates new value
function Item({ item }) {
  const url = new URL(item.url, base)
  return <Link url={url}>{item.title}</Link>
}
```

**Props, state, and hook return values are immutable.** Never mutate them directly. Always use setters or create copies.

**Local mutation is fine.** Arrays/objects created within render can be mutated before returning JSX.

```tsx
function FriendList({ friends }) {
  const items = [] // ✅ Local, can mutate
  for (const friend of friends) {
    items.push(<Friend key={friend.id} friend={friend} />)
  }
  return <section>{items}</section>
}
```

### Rules of Hooks

Call hooks only at the top level of components/custom hooks—never in loops, conditions, nested functions, or try/catch.

```tsx
// ❌ Bad: inside condition
function Bad({ cond }) {
  if (cond) {
    const theme = use(ThemeContext)
  }
}

// ❌ Bad: after early return
function Bad({ cond }) {
  if (cond) return null
  const [state, setState] = useState(0)
}

// ✅ Good: top level
function Good({ cond }) {
  const theme = use(ThemeContext)
  const [state, setState] = useState(0)
  if (cond) return null
  return <div>{state}</div>
}
```

## React Compiler

React Compiler automatically memoizes at build time. **Do not use `useMemo`, `useCallback`, or `React.memo` manually** unless you need explicit control over memoization (e.g., effect dependencies).

```tsx
// ❌ Manual memoization (unnecessary with compiler)
const ExpensiveComponent = memo(function ExpensiveComponent({ data, onClick }) {
  const processedData = useMemo(() => expensiveProcessing(data), [data])
  const handleClick = useCallback((item) => onClick(item.id), [onClick])
  return (
    <div>
      {processedData.map((item) => (
        <Item key={item.id} onClick={() => handleClick(item)} />
      ))}
    </div>
  )
})

// ✅ Plain code (compiler optimizes automatically)
function ExpensiveComponent({ data, onClick }) {
  const processedData = expensiveProcessing(data)
  const handleClick = (item) => onClick(item.id)
  return (
    <div>
      {processedData.map((item) => (
        <Item key={item.id} onClick={() => handleClick(item)} />
      ))}
    </div>
  )
}
```

## React 19 APIs

### `use` Hook

Replaces `useContext`. Can be called conditionally.

```tsx
// ❌ Legacy (deprecated)
const value = useContext(MyContext)

// ✅ React 19+
const value = use(MyContext)

// ✅ Can call conditionally
function Profile({ shouldLoad }) {
  if (shouldLoad) {
    const data = use(dataPromise)
    return <div>{data.name}</div>
  }
  return <Skeleton />
}
```

### Refs as Props

`ref` is now a regular prop—no `forwardRef` wrapper needed.

```tsx
// ❌ Legacy (deprecated)
const Input = forwardRef<HTMLInputElement, Props>((props, ref) => {
  return <input ref={ref} {...props} />
})

// ✅ React 19+
function Input({ ref, ...props }: Props & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />
}
```

## You Might Not Need an Effect

Effects synchronize with external systems. Don't use them for transformations, event responses, or state derivation.

### Derive State During Render

```tsx
// ❌ Redundant state + effect
function Form() {
  const [firstName, setFirstName] = useState('First')
  const [lastName, setLastName] = useState('Last')
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    setFullName(firstName + ' ' + lastName)
  }, [firstName, lastName])
}

// ✅ Derive during render
function Form() {
  const [firstName, setFirstName] = useState('First')
  const [lastName, setLastName] = useState('Last')
  const fullName = firstName + ' ' + lastName
}
```

### Event Logic Belongs in Event Handlers

```tsx
// ❌ Event modeled as state + effect
function Form() {
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => {
    if (submitted) post('/api/register')
  }, [submitted])
  return <button onClick={() => setSubmitted(true)}>Submit</button>
}

// ✅ Logic in handler
function Form() {
  async function handleSubmit() {
    await post('/api/register')
    showToast('Registered')
  }
  return <button onClick={handleSubmit}>Submit</button>
}
```

### Reset State with Key

```tsx
// ❌ Effect to reset state on prop change
function Profile({ userId }) {
  const [comment, setComment] = useState('')
  useEffect(() => {
    setComment('')
  }, [userId])
}

// ✅ Key forces remount and state reset
function ProfilePage({ userId }) {
  return <Profile userId={userId} key={userId} />
}
```

## State Patterns

### Lazy State Initialization

```tsx
// ❌ Runs on every render
const [index, setIndex] = useState(buildSearchIndex(items))

// ✅ Runs only once
const [index, setIndex] = useState(() => buildSearchIndex(items))
```

### useRef for Transient Values

Store frequently-changing values that don't need re-renders in refs.

```tsx
// ❌ Re-renders on every mouse move
function Tracker() {
  const [lastX, setLastX] = useState(0)
  useEffect(() => {
    const onMove = (e) => setLastX(e.clientX)
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
}

// ✅ No re-renders, update DOM directly
function Tracker() {
  const dotRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onMove = (e) => {
      if (dotRef.current) dotRef.current.style.transform = `translateX(${e.clientX}px)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  return <div ref={dotRef} />
}
```

### Defer State Reads

Don't subscribe to state only used in callbacks.

```tsx
// ❌ Re-renders on searchParams changes
function ShareButton({ chatId }) {
  const searchParams = useSearchParams()
  const handleShare = () => shareChat(chatId, { ref: searchParams.get('ref') })
}

// ✅ Read on demand
function ShareButton({ chatId }) {
  const handleShare = () => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    shareChat(chatId, { ref })
  }
}
```

## Transitions

### startTransition for Non-Urgent Updates

```tsx
import { startTransition } from 'react'

function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const handler = () => startTransition(() => setScrollY(window.scrollY))
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
}
```

### useTransition for Loading States

```tsx
function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  const handleSearch = (value) => {
    setQuery(value)
    startTransition(async () => {
      const data = await fetchResults(value)
      setResults(data)
    })
  }

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isPending && <Spinner />}
      <Results data={results} />
    </>
  )
}
```

## Code Splitting & Suspense

### Lazy Loading

```tsx
import { lazy, Suspense } from 'react'

const MonacoEditor = lazy(() =>
  import('./monaco-editor').then((m) => ({ default: m.MonacoEditor })),
)

function CodePanel({ code }) {
  return (
    <Suspense fallback={<div>Loading editor...</div>}>
      <MonacoEditor value={code} />
    </Suspense>
  )
}
```

## Composition Patterns

### Avoid Boolean Prop Proliferation

Boolean props create exponential complexity. Use composition instead.

```tsx
// ❌ Boolean props (2^n possible states)
<Composer isThread isEditing={false} channelId="abc" showAttachments showFormatting={false} />

// ✅ Explicit variants
<ThreadComposer channelId="abc" />
<EditMessageComposer messageId="xyz" />
```

## App Initialization

```tsx
// ❌ Runs twice in dev, re-runs on remount
useEffect(() => {
  loadFromStorage()
  checkAuthToken()
}, [])

// ✅ Once per app load
let didInit = false
function App() {
  useEffect(() => {
    if (didInit) return
    didInit = true
    loadFromStorage()
    checkAuthToken()
  }, [])
}

// ✅ Or at module level
if (typeof window !== 'undefined') {
  loadFromStorage()
  checkAuthToken()
}
```

## Conditional Rendering

```tsx
// ❌ Renders "0" when count is 0
{
  count && <Badge>{count}</Badge>
}

// ✅ Explicit check
{
  count > 0 ? <Badge>{count}</Badge> : null
}
```

## Import Patterns

Import directly from source files, not barrel files (re-export `index.ts`).

```tsx
// ❌ Imports entire library (200-800ms cold start cost)
import { Check, X } from 'lucide-react'

// ✅ Direct imports
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
```

## Event Listeners

### Passive Listeners for Scroll/Touch

Add `{ passive: true }` to enable immediate scrolling without waiting for listener.

```tsx
useEffect(() => {
  const handleWheel = (e: WheelEvent) => console.log(e.deltaY)
  document.addEventListener('wheel', handleWheel, { passive: true })
  return () => document.removeEventListener('wheel', handleWheel)
}, [])
```

Use passive when not calling `preventDefault()`. Don't use when implementing custom gestures.

### Stable Callback Refs with useEffectEvent

Avoid effect re-subscriptions when callbacks change.

```tsx
import { useEffectEvent } from 'react'

function useWindowEvent(event: string, handler: (e: Event) => void) {
  const onEvent = useEffectEvent(handler)

  useEffect(() => {
    window.addEventListener(event, onEvent)
    return () => window.removeEventListener(event, onEvent)
  }, [event])
}
```

## Long Lists

Apply `content-visibility: auto` to defer off-screen rendering.

```css
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

For 1000 items, browser skips layout/paint for ~990 off-screen items.
