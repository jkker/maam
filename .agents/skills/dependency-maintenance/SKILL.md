---
name: dependency-maintenance
description: Routine dependency maintenance for vite+ pnpm monorepo workspaces. Use when asked to update deps, run audits, fix vulnerabilities, bump packages, or perform periodic maintenance. Covers pnpm catalog protocol, workspace overrides, audit fixes, major version migrations, changelog review, and Node subpath imports.
---

# Dependency Maintenance

Systematic methodology for routine dependency updates in a vite+ pnpm monorepo.

## Workflow

### 1. Reconnaissance

```bash
vpx taze -r major # what's outdated
vp pm audit                          # What's vulnerable
```

Check `pnpm-workspace.yaml` catalog entries — these are the SSOT for shared versions. Every workspace should reference `catalog:` for shared deps.

### 2. Triage

Classify each outdated package:

| Type      | Risk        | Action                                                |
| --------- | ----------- | ----------------------------------------------------- |
| Patch     | None        | Bulk update via `vpx taze --write --install`          |
| Minor     | Low         | Scan changelog, update                                |
| Major     | Medium–High | Read changelog/migration guide, plan breaking changes |
| Audit fix | Critical    | Fix immediately, even if it means override            |

For major bumps, always check the changelog:

```bash
gh api repos/{owner}/{repo}/releases/latest --jq '.body' | head -80
```

### 3. pnpm Catalog Protocol

The `catalog:` protocol in `pnpm-workspace.yaml` is the single source of truth for shared versions.

```yaml
# pnpm-workspace.yaml
catalog:
  react: ^19.2.4
  vite: ^8.0.2
  vitest: 4.1.1 # Pin exact for test reproducibility

# In any package.json:
'dependencies': {
    'react': 'catalog:', # Resolves to ^19.2.4
    'vitest': 'catalog:', # Resolves to 4.1.1
  }
```

**Rules:**

- All shared deps go in catalog — never duplicate versions across workspaces
- Pin test tooling to exact versions (no `^`) for reproducibility
- Use `catalog:` for `@types/*` used in multiple packages
- Add the `updateConfig.ignoreDependencies` list in workspace yaml for deps managed elsewhere (e.g., `@types/node` pinned to a specific LTS)

### 4. Audit Overrides

When a vulnerability is in a transitive dependency you can't update directly:

```yaml
overrides:
  # Target specific dependency chains
  drizzle-orm>kysely: '>=0.28.14'
  # Or blanket override by version range
  kysely@<=0.28.13: '>=0.28.14'
  # Remove unwanted optional deps
  better-auth>@better-auth/mongo-adapter: '-'
```

**Quirk:** `parent>dep` overrides only affect direct deps, not peers. For peer deps pulled transitively, use the version-range pattern `dep@<=bad: '>=fixed'`.

After overrides, verify: `pnpm ls <pkg> --depth=5` to confirm the patched version resolved.

### 5. Node Subpath Imports (#)

Prefer `#` subpath imports over TypeScript `paths` for intra-package references:

```json
// package.json
{
  "imports": {
    "#*": ["./src/*", "./src/*.ts", "./src/*.tsx"]
  }
}
```

```ts
// Before: import { cn } from '@mylib/ui/lib/utils'
// After:  import { cn } from '#lib/utils'
```

**Quirks:**

- TypeScript resolves `#` via `package.json` `imports` when `resolvePackageJsonImports: true` (default in `bundler` moduleResolution)
- Must provide array with extension variants (`*.ts`, `*.tsx`) for TypeScript to find type declarations
- Update `components.json` (shadcn) aliases to match: `"utils": "#lib/utils"`
- Bulk rename: `sed -i '' "s|from '@pkg/name/|from '#|g" $(find src -name '*.tsx' -o -name '*.ts')`

### 6. Verification Sequence

```bash
vp i           # Should be clean, no warnings
vp pm audit    # Must be 0 vulnerabilities
vp check       # 0 errors
vp test run    # Relevant tests pass
```

### 7. Documentation

Create `docs/maintenance/YYYY-MM-DD-<slug>.md` with:

- Table of version changes (from → to)
- Security fixes applied
- Breaking changes and how they were handled
- Pre-existing issues discovered but not fixed (with justification)

## Common Gotchas

- **TypeScript major bumps**: May surface latent type issues (stricter module augmentation, `@types/node` auto-discovery changes). Check `moduleResolution: "node16"` packages — they may need explicit `"types": ["node"]`.
- **@tanstack version mismatches**: `@tanstack/*` packages across all workspaces must be on the same minor.
- **`@vitejs/plugin-react` 6.0**: Babel integration extracted — use `@rolldown/plugin-babel` with `reactCompilerPreset()` instead of inline babel config.
- **`@base-ui/react` renames**: Components periodically graduate from `*Preview` to stable names (e.g., `DrawerPreview` → `Drawer`).
- **Peer dep warnings**: Add to `peerDependencyRules.allowedVersions` when upstream packages haven't updated their peer ranges for a new major.
- **`pnpm audit` vs overrides**: Overrides take effect after `vp i` — always re-install before re-auditing.
