# Database Migrations with Drizzle Kit

This project uses [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) for database migrations.

## Quick Start

### Prerequisites

Ensure migrations are applied before starting the server:

```bash
cd server
pnpm db:migrate
```

Then start the server:

```bash
pnpm start
```

## Development Workflow

### 1. Making Schema Changes

Edit the schema in `server/src/lib/db/schema.ts`:

```typescript
// Example: Add a new column
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email'), // NEW COLUMN
  createdAt: text('created_at').notNull(),
})
```

### 2. Generate Migration

Generate a migration file from your schema changes:

```bash
cd server
pnpm db:generate
```

This creates a timestamped SQL file in `server/drizzle/` with your changes.

### 3. Apply Migrations

Apply pending migrations to your database:

```bash
pnpm db:migrate
```

**Important:** Always run this before starting the server after schema changes.

### 4. Quick Prototyping (Development Only)

For rapid iteration without generating migration files:

```bash
pnpm db:push
```

⚠️ **Warning:** This bypasses migration tracking. Use only for local development.

## Migration Scripts

Available npm scripts in `server/package.json`:

| Command            | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `pnpm db:generate` | Generate migration from schema changes                  |
| `pnpm db:push`     | Push schema directly to DB (dev only, skips migrations) |
| `pnpm db:migrate`  | Apply pending migrations via CLI                        |
| `pnpm db:studio`   | Open Drizzle Studio UI for database inspection          |

## Database Inspection

Launch Drizzle Studio to visually browse your database:

```bash
cd server
pnpm db:studio
```

Opens at `https://local.drizzle.studio`

## Production Deployment

### Automated (Recommended)

Add a `postinstall` script to run migrations automatically:

```json
{
  "scripts": {
    "postinstall": "cd server && pnpm db:migrate"
  }
}
```

### Manual

Run migrations before starting the server:

```bash
cd server
pnpm db:migrate
pnpm start
```

## Testing

Tests use mocked database services for isolation. No database setup needed:

```bash
pnpm test
```

The database service is mocked with `vi.mock` in test files:

```typescript
vi.mock('../lib/db/service', () => ({
  saveTask: vi.fn().mockResolvedValue(undefined),
  // ... other mocks
}))
```

## Migration Files

Generated migrations live in `server/drizzle/`:

```
drizzle/
├── 0000_initial_schema.sql
├── 0001_add_user_email.sql
└── meta/
    └── _journal.json
```

- **Never edit generated SQL files manually**
- **Always commit migration files to git**
- Migrations apply in timestamp order

## Configuration

Database configuration in `server/drizzle.config.ts`:

```typescript
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: 'maam.db',
  },
})
```

## Troubleshooting

### "Database is locked" error

SQLite is in WAL mode. Close other connections:

```bash
rm server/maam.db-shm server/maam.db-wal
```

### Migrations out of sync

Reset local database (⚠️ data loss):

```bash
rm server/maam.db
cd server && pnpm db:migrate
```

### Schema drift

If schema and database diverge:

1. `pnpm db:generate` to create catchup migration
2. `pnpm db:migrate` to apply
3. Or use `pnpm db:push` to force sync (dev only)

## Best Practices

1. **Never skip migrations in production**
2. **Test migrations on a database copy first**
3. **Keep migrations small and focused**
4. **Document breaking changes in migration comments**
5. **Use `db:push` only for local prototyping**

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Drizzle Kit Docs](https://orm.drizzle.team/kit-docs/overview)
- [SQLite Migrations](https://orm.drizzle.team/docs/migrations)
