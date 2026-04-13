/**
 * Tooling script that uses zx for CLI
 *
 * @see https://google.github.io/zx
 *
 * @remarks
 *
 * Use `node scripts/hello-world.ts` to run this script directly (node >= 24).
 */
import { $ } from 'zx'

await $`echo "Hello, World!"`.verbose()
