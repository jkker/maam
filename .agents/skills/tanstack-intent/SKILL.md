---
name: tanstack-intent
description: Manage TanStack Intent skill-to-task mappings. Use when adding, updating, or discovering agent skills from installed npm packages, or when re-syncing intent-skills after dependency updates.
---

# TanStack Intent

@tanstack/intent is a CLI for discovering and managing AI agent skills shipped inside npm packages. Skills version with library releases — no manual syncing needed.

## Commands

All commands use `vpx` (not `npx`):

| Command                                                | Purpose                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `vpx @tanstack/intent@latest list`                     | Discover all intent-enabled skills from installed packages |
| `vpx @tanstack/intent@latest list --json`              | Machine-readable skill listing                             |
| `vpx @tanstack/intent@latest install`                  | Print agent instructions for setting up skill mappings     |
| `vpx @tanstack/intent@latest stale`                    | Check if skills reference outdated source docs             |
| `vpx @tanstack/intent@latest meta feedback-collection` | Print skill for submitting feedback to maintainers         |

## Workflow

### After updating TanStack packages

```bash
# Check what skills are available
vpx @tanstack/intent@latest list

# Check for stale skills
vpx @tanstack/intent@latest stale

# Re-run install to update AGENTS.md intent-skills block
vpx @tanstack/intent@latest install
```

### intent-skills block format

The mappings live in AGENTS.md between sentinel comments:

```markdown
<!-- intent-skills:start -->

## Skill Mappings

skills:

- task: "description of when to load this skill"
load: "node_modules/package/skills/skill-name/SKILL.md"
<!-- intent-skills:end -->
```

Rules:

- Use exact paths from `vpx @tanstack/intent@latest list` output
- Keep entries concise — the block is read on every agent task
- Update in place when adding/removing skills
- Preserve all content outside the block tags

## Current Skills in This Project

Run `vpx @tanstack/intent@latest list` to see the full list. Key consumer skills:

- **router-plugin** — TanStack Router bundler plugin configuration
- **router-core** — Core routing (entry point with sub-skills for navigation, params, loaders, auth, code splitting, errors, type safety)
- **devtools-vite-plugin** — TanStack Devtools Vite plugin configuration
- **vite-plus** — Vite+ CLI workflow and operations
