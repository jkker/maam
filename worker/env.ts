/**
 * Worker environment bindings type definition.
 * Defines all bindings available in the Worker runtime.
 */
export interface Env {
  /** Durable Object namespace for automation instances */
  INSTANCE_DO: DurableObjectNamespace

  /** Static assets binding for SPA */
  ASSETS: Fetcher

  /** Environment name */
  ENVIRONMENT: string

  /** Optional: API authentication secret */
  API_SECRET?: string

  /** Optional: MAA client authentication tokens (comma-separated) */
  MAA_TOKENS?: string
}
