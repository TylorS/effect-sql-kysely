# effect-sql-kysely

Integration between [Effect SQL](https://github.com/Effect-TS/effect/tree/main/packages/sql) and [Kysely](https://kysely.dev/) for type-safe queries with Effect error handling and resource management.

**Requires Effect 4** (`effect@^4.0.0-rc.117`). SQL types and services live under `effect/unstable/sql` in that release.

`effect-sql-kysely` implements the [`SqlClient`](https://effect.website/docs/sql/SqlClient) interface on top of Kysely: Kysely owns connections, transactions, and query building; Effect owns execution, errors, layers, and request batching. Tooling built for Kysely or Effect SQL remains compatible.

## Features

- **Type-safe queries** with Kysely’s query builder
- **Effect** errors, layers, scopes, and structured concurrency
- **Schema helpers** aligned with `SqlSchema` (`findAll`, `findOne`, `single`, `void`, …)
- **Resolvers** with batched `findById`, `grouped`, `ordered`, and `void`
- **Transactions** via `withTransaction` (rollback on failure)
- **Drivers** matching all [Effect SQL packages](https://github.com/Effect-TS/effect/tree/main/packages/sql) that expose a statement compiler (Postgres, PGlite, MySQL, MSSQL, ClickHouse, SQLite, libSQL, D1, …)
- **OpenTelemetry** via optional span attributes on the SQL client
- **Streaming** through Kysely executors and `SqlClient` stream execution

## Installation

```bash
pnpm add effect-sql-kysely effect kysely
```

### Peer dependencies

```json
{
  "effect": "^4.0.0-rc.117",
  "kysely": "^0.28.3"
}
```

Install the `@effect/sql-*` driver that matches your database when you use that driver’s layers or types alongside this library (see table below).

### Entry points and drivers

Pick the `effect-sql-kysely` import that matches the [`@effect/sql-*`](https://github.com/Effect-TS/effect/tree/main/packages/sql) package you use. All packages should be on the **same Effect 4 RC** version as `effect` (e.g. `4.0.0-rc.117`).

| Import | `@effect/sql-*` package | Notes |
|--------|-------------------------|--------|
| `effect-sql-kysely/Pg` | `@effect/sql-pg` | PostgreSQL |
| `effect-sql-kysely/Pglite` | `@effect/sql-pglite` | Embedded Postgres (PGlite) |
| `effect-sql-kysely/MySql2` | `@effect/sql-mysql2` | MySQL / MariaDB |
| `effect-sql-kysely/MsSql` | `@effect/sql-mssql` | Microsoft SQL Server |
| `effect-sql-kysely/Clickhouse` | `@effect/sql-clickhouse` | ClickHouse |
| `effect-sql-kysely/Sqlite` | — | Generic SQLite compiler (any Kysely SQLite dialect) |
| `effect-sql-kysely/SqliteNode` | `@effect/sql-sqlite-node` | Node `node:sqlite` / better-sqlite3-style setups via Kysely |
| `effect-sql-kysely/SqliteBun` | `@effect/sql-sqlite-bun` | Bun SQLite |
| `effect-sql-kysely/SqliteDo` | `@effect/sql-sqlite-do` | Cloudflare Durable Objects SQLite |
| `effect-sql-kysely/SqliteWasm` | `@effect/sql-sqlite-wasm` | WASM SQLite |
| `effect-sql-kysely/SqliteReactNative` | `@effect/sql-sqlite-react-native` | React Native SQLite |
| `effect-sql-kysely/D1` | `@effect/sql-d1` | Cloudflare D1 |
| `effect-sql-kysely/Libsql` | `@effect/sql-libsql` | libSQL / Turso |

SQLite-family entry points (`Sqlite`, `D1`, `Libsql`, `SqliteNode`, …) share the same **SQLite statement compiler** from `effect/unstable/sql`. Choose the entry point that documents which driver you pair with Kysely; behavior is identical aside from typing ergonomics.

Example:

```bash
pnpm add @effect/sql-pg   # when using effect-sql-kysely/Pg
```

## Quick start

### 1. Define schema (Effect Schema + Kysely column shapes)

```typescript
import { Table, Generated } from "effect-sql-kysely";
import * as Schema from "effect/Schema";

const Users = Table({
  id: Generated(Schema.Int),
  name: Schema.String,
  email: Schema.String,
  createdAt: Generated(Schema.DateFromString),
});

const Posts = Table({
  id: Generated(Schema.Int),
  title: Schema.String,
  content: Schema.String,
  authorId: Schema.Int,
  publishedAt: Schema.optional(Schema.DateFromString),
});

const DatabaseSchema = Schema.Struct({
  users: Users,
  posts: Posts,
});

type DatabaseSchema = typeof DatabaseSchema.Encoded;
```

Each `Table` exposes `.select`, `.insert`, and `.update` schemas for Kysely row shapes.

### 2. Database service tag

```typescript
import * as Database from "effect-sql-kysely/Pg";
// or MySql2, MsSql, Clickhouse, Pglite, Sqlite, Libsql, D1, …

class MyDatabase extends Database.make<DatabaseSchema, MyDatabase>("MyDatabase") {}
```

### 3. Query helpers (`schema`)

These mirror [SqlSchema](https://effect.website/docs/sql/SqlSchema) but take `(db, request) => Compilable` so the query stays in Kysely.

```typescript
import { Effect, Option } from "effect";

const createUser = MyDatabase.schema.single({
  Request: Users.insert,
  Result: Users.select,
  execute: (db, insert) =>
    db.insertInto("users").values(insert).returningAll(),
});

const findUser = MyDatabase.schema.findOne({
  Request: Users.select.fields.id,
  Result: Users.select,
  execute: (db, id) =>
    db.selectFrom("users").where("id", "=", id).selectAll(),
});

const findPostsByAuthor = MyDatabase.schema.select({
  Request: Users.select.fields.id,
  Result: Posts.select,
  execute: (db, authorId) =>
    db.selectFrom("posts").where("authorId", "=", authorId).selectAll(),
});

const updateUser = MyDatabase.schema.void({
  Request: Users.update,
  execute: (update, db) =>
    db.updateTable("users").set(update).where("id", "=", update.id),
});
```

### 4. Layer (scoped Kysely instance)

Use `Effect.acquireRelease` for lifecycle (Effect 4):

```typescript
import { Effect } from "effect";
import * as kysely from "kysely";
import { Pool } from "pg";

const databaseLayer = MyDatabase.layer({
  acquire: Effect.acquireRelease(
    Effect.sync(
      () =>
        new kysely.Kysely<DatabaseSchema>({
          dialect: new kysely.PostgresDialect({
            pool: new Pool({
              host: "localhost",
              port: 5432,
              user: "postgres",
              password: "password",
              database: "myapp",
            }),
          }),
        }),
    ),
    (db) => Effect.promise(() => db.destroy()),
  ),
  spanAttributes: [
    ["db.system", "postgresql"],
    ["db.name", "myapp"],
  ],
  chunkSize: 32,
});
```

### 5. Run

```typescript
const main = Effect.gen(function* () {
  const user = yield* createUser({
    name: "John Doe",
    email: "john@example.com",
  });

  const foundUser = yield* findUser(user.id);
  console.log("Found user:", Option.getOrNull(foundUser));

  const posts = yield* findPostsByAuthor(user.id);
  console.log("Posts:", posts);
}).pipe(Effect.provide(databaseLayer), Effect.scoped);

Effect.runPromise(main);
```

Tests in this repo use `@effect/vitest` with `it.effect` (not `it.scoped`).

## Database examples

Use the same `layer({ acquire, … })` pattern; only the **import** and **Kysely dialect** change.

### PostgreSQL (`Pg`)

```typescript
import * as Database from "effect-sql-kysely/Pg";
import { Pool } from "pg";
// … PostgresDialect + Pool as in quick start
```

### MySQL (`MySql2`)

```typescript
import * as Database from "effect-sql-kysely/MySql2";
// … MySqlDialect + mysql2 pool
```

### SQLite (`Sqlite` or `SqliteNode`)

```typescript
import * as Database from "effect-sql-kysely/Sqlite";
import BetterSqlite3 from "better-sqlite3";

const databaseLayer = MyDatabase.layer({
  acquire: Effect.acquireRelease(
    Effect.sync(
      () =>
        new kysely.Kysely<DatabaseSchema>({
          dialect: new kysely.SqliteDialect({
            database: new BetterSqlite3("database.db"),
          }),
        }),
    ),
    (db) => Effect.promise(() => db.destroy()),
  ),
});
```

For `@effect/sql-sqlite-node`, prefer `effect-sql-kysely/SqliteNode` as the import name.

### MS SQL (`MsSql`)

```typescript
import * as Database from "effect-sql-kysely/MsSql";
// … MssqlDialect + tedious / mssql pool
```

### Other drivers

Use the [entry point table](#entry-points-and-drivers) and the same layer pattern with the Kysely dialect appropriate for that engine (Postgres-like for PGlite, SQLite-like for D1/libSQL, etc.).

## Schema operations

| Method | Result | Empty result |
|--------|--------|----------------|
| `single` | one row | fails (`NoSuchElementError`) |
| `findOne` | `Option` row | `Option.none()` |
| `select` / `findAll` | array | `[]` |
| `void` | `void` | — |

Errors include `SqlError` and `Schema.SchemaError` where decoding applies.

## Resolvers (batched requests)

Kysely-enhanced wrappers around [`SqlResolver`](https://effect.website/docs/sql/SqlResolver). Resolvers expose `.execute(payload)` in addition to working with `Effect.request`.

In Effect 4, batch resolver work by running requests **concurrently** (for example `Effect.all` with `{ concurrency: "unbounded" }`), not `{ batching: true }`.

### `findById`

```typescript
const userResolver = yield* MyDatabase.resolver.findById("FindUser", {
  Id: Users.select.fields.id,
  Result: Users.select,
  ResultId: (user) => user.id,
  execute: (db, ids) =>
    db.selectFrom("users").where("id", "in", ids).selectAll(),
});

const users = yield* Effect.all(
  userIds.map((id) => userResolver.execute(id)),
  { concurrency: "unbounded" },
);
```

Missing ids fail with `NoSuchElementError` (Effect 4); they are no longer returned as `Option.none` from the resolver.

### `grouped`

```typescript
const postsByAuthor = yield* MyDatabase.resolver.grouped("PostsByAuthor", {
  Id: Users.select.fields.id,
  Result: Posts.select,
  ResultId: (post) => post.authorId,
  execute: (db, authorIds) =>
    db.selectFrom("posts").where("authorId", "in", authorIds).selectAll(),
});
```

### `ordered`

```typescript
const orderedUsers = yield* MyDatabase.resolver.ordered("OrderedUser", {
  Id: Users.select.fields.id,
  Result: Users.select,
  ResultId: (user) => user.id,
  execute: (db, ids) =>
    db.selectFrom("users").where("id", "in", ids).selectAll(),
});
```

### `void`

```typescript
const deleteUsers = yield* MyDatabase.resolver.void("DeleteUsers", {
  Request: Users.select.fields.id,
  execute: (db, ids) => db.deleteFrom("users").where("id", "in", ids),
});
```

## Transactions

```typescript
const createUserWithPost = Effect.gen(function* () {
  const user = yield* createUser({ name: "John", email: "john@example.com" });
  const post = yield* createPost({
    title: "First post",
    content: "Hello",
    authorId: user.id,
  });
  return { user, post };
}).pipe(MyDatabase.withTransaction, Effect.provide(databaseLayer), Effect.scoped);
```

Or use the SQL client directly:

```typescript
yield* MyDatabase.pipe(
  Effect.flatMap(({ sql }) =>
    sql.withTransaction(
      Effect.gen(function* () {
        // … queries
      }),
    ),
  ),
);
```

## Advanced usage

### Raw Kysely through the client

```typescript
const rows = yield* MyDatabase.kysely((db) =>
  db
    .selectFrom("users")
    .innerJoin("posts", "users.id", "posts.authorId")
    .select(["users.name", "posts.title"])
    .where("users.id", "=", 1),
);
```

Compiled SQL runs through the Effect SQL client (`sql.unsafe`), so transactions and connection scope from `SqlClient` still apply.

### Low-level exports

```typescript
import {
  makeKyselyEffect,
  makeResolver,
  makeSchema,
  makeSqlClient,
} from "effect-sql-kysely";

// Build SqlClient from an existing Kysely instance + compiler (see driver modules)
const sql = yield* makeSqlClient({ database: db, compiler });
const kyselyEffect = makeKyselyEffect(db, sql);
const resolver = makeResolver(kyselyEffect);
const schema = makeSchema(kyselyEffect);
```

Use a driver module’s `makeSqlClient` when you need that driver’s `makeCompiler()` (Postgres, ClickHouse, …).

### OpenTelemetry

Pass `spanAttributes` into `layer` / `makeSqlClient` (see quick start).

## Errors

Operations fail with `SqlError` (wrapper around structured SQL reasons) and, when schemas are involved, `Schema.SchemaError`. Use `Effect.catchTag("SqlError", …)` or `Cause` helpers as usual.

## Third-party Kysely dialects

Any Kysely `Dialect` works as long as you use the matching **Effect SQL statement compiler** (via the correct `effect-sql-kysely/*` import). For example, PowerSync or other SQLite-backed Kysely wrappers typically pair with `effect-sql-kysely/Sqlite` or `SqliteNode`.

## Contributing

Contributions are welcome. Please open a pull request.

## License

MIT
