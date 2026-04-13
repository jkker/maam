import { createContext as createReactContext, use, type Context } from 'react'

/**
 * Options for creating a strongly-typed React context.
 * @remarks Allows customizing error handling, naming, and default value for the context.
 */
export interface CreateContextOptions<T> {
  /**
   * If true, throws an error when context is undefined (default: true).
   * @defaultValue true
   */
  strict?: boolean
  /**
   * Name of the hook for error messages and debugging.
   * @defaultValue 'useContext'
   */
  hookName?: string
  /**
   * Name of the provider for error messages and debugging.
   * @defaultValue 'Provider'
   */
  providerName?: string
  /**
   * Custom error message to throw if context is missing.
   */
  errorMessage?: string
  /**
   * Display name for the context (for React DevTools).
   */
  name?: string
  /**
   * Default value for the context.
   */
  defaultValue?: T
}

/**
 * Return type of {@link createContext}.
 * @remarks Tuple of [Provider, useContext hook, Context object].
 * @template T - The context value type.
 */
export type CreateContextReturn<T> = [() => T, Context<T | undefined>]

/**
 * Returns a tuple of [Provider, useContext hook, Context object] for a strongly-typed React context.
 * @remarks
 * - Enforces strict context usage by default (throws if context is missing).
 * - Customizes error messages and context display name.
 * - Encourages type safety and clarity in context usage.
 * - The context value is always T | undefined; the hook narrows to T or throws if strict.
 * @example
 * ```ts
 * const [Provider, useValue, Context] = createContext<MyType>({ name: 'MyContext' })
 * ```
 * @throws {Error} If strict is true and context is missing.
 */
export function createContext<T>({
  name = 'Context',
  strict = true,
  hookName = `use${name}`,
  providerName = `${name}Provider`,
  errorMessage,
  defaultValue,
}: CreateContextOptions<T> = {}): CreateContextReturn<T> {
  const Context = createReactContext(defaultValue)
  Context.displayName = name

  const useContext = (): T => {
    const context = use(Context)
    if (context === undefined && strict) {
      const error = new Error(
        errorMessage ??
          `${hookName} returned \`undefined\`. Seems you forgot to wrap component within ${providerName}`,
      )
      error.name = 'ContextError'
      throw error
    }
    return context as T
  }
  useContext.displayName = hookName

  return [useContext, Context]
}
