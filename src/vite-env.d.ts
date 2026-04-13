/// <reference types="vite-plus/client" />
/// <reference types="vite-plus/test/importMeta" />
/**
 * Reset TypeScript's built-in types to a more sane default.
 *
 * @see https://www.totaltypescript.com/ts-reset
 */
/// <reference types="@total-typescript/ts-reset" />

interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  // See https://vite.dev/guide/env-and-mode#intellisense-for-typescript for more details.
  strictImportMetaEnv: unknown
}

// https://arkenv.js.org/docs/vite-plugin/arkenv-in-viteconfig
type ImportMetaEnvAugmented = import('@arkenv/vite-plugin').ImportMetaEnvAugmented<
  typeof import('../vite.config').Env
>
// Augment import.meta.env with your schema
// Only `VITE_*` prefixed variables will be included
interface ImportMetaEnv extends ImportMetaEnvAugmented {}

import 'react'
declare module 'react' {
  interface CSSProperties {
    /**
     * Support for CSS custom properties
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
     */
    [property: `--${string}`]: string | number | undefined
  }
}
