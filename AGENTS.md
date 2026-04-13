## Non-Negotiable

- Be extremely concise; sacrifice grammar for brevity.
- Refer to skills, tools, cli `--help`, and codebase documentation before taking action. Avoid assumptions.
- Verify your work with `vpx @playwright/cli`, vitest browser tests after making changes.

## File Structure

- Routes: `src/routes/` — TanStack Router file-based routes
- Components: `src/components/` — UI primitives in `ui/`, layout in `layout/`, demos in `examples/`
- Libraries: `src/lib/` — i18n, router, query client, stores, utilities
- Stores: `src/stores/` — Zustand client state (e.g., theme)
- Hooks: `src/hooks/` — shared React hooks

## Standards

- React 19 & Compiler — Functional components only, no `React.FC`. Named imports for hooks. React Compiler handles memoization; no manual `useMemo`/`useCallback`/`React.memo`. NEVER derive state in `useEffect`; compute during render.
- Routing — TanStack Router, file-based in `src/routes/`. Use `createFileRoute`, `<Link>`, type-safe params, route loaders.
- Data Fetching — TanStack Query (`useQuery`/`useMutation`). Never fetch in `useEffect`.
- State — Zustand-X stores with strict interfaces. Refer to zustand-x SKILL for patterns. Avoid React context for global state.
- Styling — Tailwind CSS 4, utility classes in JSX. `cn()` for conditional classes, `cva` for variants, Lucide icons.
- Forms — TanStack Form + Arktype validation.
- Imports — Node subpath imports (`#/*` → `./src/*`). Use `#/components/ui/button`, `#/lib/utils`, etc. No tsconfig `paths` or Vite `resolve.alias`. Configured solely in `package.json` `imports` field.
- TypeScript — Strict mode, no `any`/`as unknown`/`@ts-ignore`. Use inference, `??`, `?.`, `.toSorted()`, `.toSpliced()`. Arktype for runtime schemas. No barrel files. Generics for reusable functions.
- Testing — Import from `vite-plus/test`. Use `vitest-browser-react` + browser locators for component tests. `toMatchInlineSnapshot()` for snapshots. Write tests for all new features and bug fixes. Run `vp test` before committing.
- Comments — Adopt TSDoc format. Explain _why_ and _how_, not _what_. Use `@remarks`, `@example`, `@see`. Never restate types.
- Security — No secrets in code. Env vars for sensitive data. Validate user input with Arktype.

## Tools

- Query docs via `vpx ctx7` before implementing unfamiliar APIs.
  - `vpx ctx7 library <name> <query>`: Searches the Context7 index by library name and returns matching libraries with their IDs.
  - `vpx ctx7 docs <libraryId> <query>`: Retrieves documentation for a library using a Context7-compatible library ID (`/tanstack/router`, `/tanstack/query`, `/tanstack/form`, `/websites/ui_shadcn`, `/arktypeio/arktype`).
- Run `vpx shadcn@canary` (shadcn skill) to add/manage UI components. Config in `components.json` (style: `base-nova`). Uses `#/` subpath import aliases.
- If a task involves UI changes/web features, you must use `vpx @playwright/cli` (playwright-cli skill) to validate e2e.

## Commands

`vp` is a global CLI wrapping Vite, Rolldown, Vitest, Oxlint, and Oxfmt. Run `vp help` or `vp <command> --help` for usage.

| Command           | Purpose                     |
| ----------------- | --------------------------- |
| `vp dev`          | Start Vite dev server       |
| `vp build`        | Production build            |
| `vp check`        | Format + lint + type-check  |
| `vp check --fix`  | Auto-fix lint/format issues |
| `vp test`         | Vitest (unit + browser)     |
| `vp i <pkg>`      | Install dependencies        |
| `vp run <script>` | Run a package.json script   |
| `vpx <pkg>`       | One-off binary execution    |

- Do NOT install Vitest, Oxlint, Oxfmt, or tsdown directly — Vite+ bundles them.
- Import from `vite-plus` (not `vite`/`vitest`): `import { expect, test } from 'vite-plus/test'`.
- Use `vpx` instead of `npx`/`pnpx` for one-off binaries.
- `vp check` handles all formatting, linting, and type-checking; never run `tsc`.

## Workflow

1. Plan — Clarify intent → query context7 docs → read relevant code → create todos.
2. Implement — Write code → `vp check` → `vp test`.
3. Review — Self-review against standards → fix issues.
4. Ship — Commit (conventional message) → push → `gh pr create` if requested.

<!-- intent-skills:start -->

## Skill Mappings

When working in these areas, load the linked skill file into context.

```yaml
skills:
  - task: 'configuring TanStack Router bundler plugin, route generation, or code splitting settings'
    load: 'node_modules/@tanstack/router-plugin/skills/router-plugin/SKILL.md'
  - task: 'implementing routing with TanStack Router (routes, navigation, params, loaders, guards, errors)'
    load: 'node_modules/.pnpm/@tanstack+router-core@1.168.6/node_modules/@tanstack/router-core/skills/router-core/SKILL.md'
  - task: 'configuring TanStack Devtools Vite plugin (source inspection, console piping, event bus)'
    load: 'node_modules/@tanstack/devtools-vite/skills/devtools-vite-plugin/SKILL.md'
  - task: 'using Vite+ CLI for dev, build, test, lint, format workflows'
    load: 'node_modules/vite-plus/skills/vite-plus/SKILL.md'
```

<!-- intent-skills:end -->
