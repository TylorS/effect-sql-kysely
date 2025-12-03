# effect-sql-kysely

A full-featured integration between `@effect/sql` and `Kysely` that provides type-safe database operations with Effect's powerful error handling and resource management.

`effect-sql-kysely` implements the [`SqlClient`](https://effect-ts.github.io/effect/sql/SqlClient.ts.html#sqlclient-interface) interface directly, meaning Kysely manages database connections, transactions, and query compilation while Effect handles the execution context, error handling, and resource lifecycle.

Given we just implement `SqlClient` atop of `Kysely` any and all 3rd-party tooling for Kysely or `@effect/sql` are 100% compatible.

## Features

- **Type-safe database operations** with Kysely's query builder
- **Effect-based error handling** and resource management
- **Schema validation** with Effect Schema
- **Batched queries** with intelligent resolvers
- **Transaction support** with automatic rollback on failure
- **Multiple database support**: PostgreSQL, MySQL, SQLite, and MS SQL Server
- **OpenTelemetry integration** for observability
- **Streaming support** for large datasets
- **Third-party integration** support (e.g., PowerSync)

## Installation

```bash
npm install effect-sql-kysely
# or
pnpm add effect-sql-kysely
# or
yarn add effect-sql-kysely
```

### Peer Dependencies

This library requires the following peer dependencies:

```json
{
  "@effect/sql": "^0.44.0",
  "effect": "^3.17.1",
  "kysely": "^0.28.3"
}
```

### Optional Database Drivers

For specific database support, install the corresponding `@effect/sql-*` package:

```bash
# PostgreSQL
npm install @effect/sql-pg

# MySQL
npm install @effect/sql-mysql2

# MS SQL Server
npm install @effect/sql-mssql

# SQLite (included with @effect/sql)
```

## Quick Start

### 1. Define Your Schema

```typescript
import { Table, Generated } from "effect-sql-kysely";
import * as Schema from "effect/Schema";

// Define table schemas with Kysely column types
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
  publishedAt: Schema.OptionFromSelf(Schema.DateFromString),
});

// Create database schema
const DatabaseSchema = Schema.Struct({
  users: Users,
  posts: Posts,
});

type DatabaseSchema = typeof DatabaseSchema.Encoded;
```

### 2. Create Database Instance

```typescript
import * as Database from "effect-sql-kysely/Pg";
// or for specific databases:
// import * as Database from "effect-sql-kysely/MySql2";
// import * as Database from "effect-sql-kysely/MsSql";
// import * as Database from "effect-sql-kysely/Sqlite";

class MyDatabase extends Database.make<DatabaseSchema, MyDatabase>("MyDatabase") {}
```

### 3. Define Query Operations

> These are kysely-enhanced versions of `@effect/sql`'s `Sql.SqlSchema.*`

```typescript
import { Effect, Option } from "effect";

// Create a user
const createUser = MyDatabase.schema.single({
  Request: Users.insert,
  Result: Users.select,
  execute: (db, insert) =>
    db.insertInto("users").values(insert).returningAll(),
});

// Find user by ID
const findUser = MyDatabase.schema.findOne({
  Request: Users.select.fields.id,
  Result: Users.select,
  execute: (db, id) =>
    db.selectFrom("users").where("id", "=", id).selectAll(),
});

// Find all posts by author
const findPostsByAuthor = MyDatabase.schema.select({
  Request: Users.select.fields.id,
  Result: Posts.select,
  execute: (db, authorId) =>
    db.selectFrom("posts").where("authorId", "=", authorId).selectAll(),
});

// Update user
const updateUser = MyDatabase.schema.void({
  Request: Users.update,
  execute: (db, { id, ...update }) =>
    db.updateTable("users").set(update).where("id", "=", id),
});
```

### 4. Set Up Database Connection

```typescript
import * as Effect from "effect";
import * as kysely from "kysely";

// PostgreSQL example
const databaseLayer = MyDatabase.layer({
  acquire: Effect.sync(() =>
    new kysely.Kysely<DatabaseSchema>({
      dialect: new kysely.PostgresDialect({
        pool: new kysely.Pool({
          host: "localhost",
          port: 5432,
          user: "postgres",
          password: "password",
          database: "myapp",
        }),
      }),
    })
  ).pipe(Effect.acquireRelease(database => Effect.promise(() => database.destroy()))),
  // Optional: OpenTelemetry span attributes
  spanAttributes: [
    ["db.system", "postgresql"],
    ["db.name", "myapp"],
  ],
  // Optional: Chunk size for streaming (default: 16)
  chunkSize: 32,
});
```

### 5. Use in Your Application

```typescript
const main = Effect.gen(function* () {
  // Create a user
  const user = yield* createUser({
    name: "John Doe",
    email: "john@example.com",
  });

  // Find the user
  const foundUser = yield* findUser(user.id);
  console.log("Found user:", Option.getOrNull(foundUser));

  // Create a post for the user
  const post = yield* createPost({
    title: "My First Post",
    content: "Hello, world!",
    authorId: user.id,
  });

  // Find all posts by the user
  const userPosts = yield* findPostsByAuthor(user.id);
  console.log("User posts:", userPosts);
}).pipe(
  Effect.provide(databaseLayer),
  Effect.scoped
);

// Run the effect
Effect.runPromise(main);
```

## Database Support

### PostgreSQL

```typescript
import * as Database from "effect-sql-kysely/Pg";
import * as kysely from "kysely";
import { Pool } from "pg";

const databaseLayer = MyDatabase.layer({
  acquire: Effect.sync(() =>
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
    })
  ).pipe(Effect.acquireRelease(database => Effect.promise(() => database.destroy()))),
});
```

### MySQL

```typescript
import * as Database from "effect-sql-kysely/MySql2";
import * as kysely from "kysely";

const databaseLayer = MyDatabase.layer({
  acquire: Effect.sync(() =>
    new kysely.Kysely<DatabaseSchema>({
      dialect: new kysely.MySqlDialect({
        pool: new kysely.Pool({
          host: "localhost",
          port: 3306,
          user: "root",
          password: "password",
          database: "myapp",
        }),
      }),
    })
  ).pipe(Effect.acquireRelease(database => Effect.promise(() => database.destroy()))),
});
```

### SQLite

```typescript
import * as Database from "effect-sql-kysely/Sqlite";
import * as kysely from "kysely";
import BetterSqlite3 from "better-sqlite3";

const databaseLayer = MyDatabase.layer({
  acquire: Effect.sync(() =>
    new kysely.Kysely<DatabaseSchema>({
      dialect: new kysely.SqliteDialect({
        database: new BetterSqlite3("database.db"),
      }),
    })
  ).pipe(Effect.acquireRelease(database => Effect.promise(() => database.destroy()))) ,
});
```

### MS SQL Server

```typescript
import * as Database from "effect-sql-kysely/MsSql";
import * as kysely from "kysely";

const databaseLayer = MyDatabase.layer({
  acquire: Effect.sync(() =>
    new kysely.Kysely<DatabaseSchema>({
      dialect: new kysely.MssqlDialect({
        pool: new kysely.Pool({
          host: "localhost",
          port: 1433,
          user: "sa",
          password: "password",
          database: "myapp",
        }),
      }),
    })
  ).pipe(Effect.acquireRelease(database => Effect.promise(() => database.destroy()))),
});
```

## Schema Operations

### Available Operations

The `schema` object provides several operation types:

#### `single` - Returns exactly one result
```typescript
const getUser = MyDatabase.schema.single({
  Request: Schema.Int, // user ID
  Result: Users.select,
  execute: (db, id) =>
    db.selectFrom("users").where("id", "=", id).selectAll(),
});
// Returns: Effect<User, NoSuchElementException | SqlError>
```

#### `findOne` - Returns optional result
```typescript
const findUser = MyDatabase.schema.findOne({
  Request: Schema.Int, // user ID
  Result: Users.select,
  execute: (db, id) =>
    db.selectFrom("users").where("id", "=", id).selectAll(),
});
// Returns: Effect<Option<User>, SqlError>
```

#### `select` - Returns array of results
```typescript
const getAllUsers = MyDatabase.schema.select({
  Request: Schema.Void,
  Result: Users.select,
  execute: (db) => db.selectFrom("users").selectAll(),
});
// Returns: Effect<ReadonlyArray<User>, SqlError>
```

#### `void` - No return value
```typescript
const deleteUser = MyDatabase.schema.void({
  Request: Schema.Int, // user ID
  execute: (db, id) =>
    db.deleteFrom("users").where("id", "=", id),
});
// Returns: Effect<void, SqlError>
```

## Resolvers for Batched Queries

> These are kysely-enhanced versions of `@effect/sql`'s `Sql.SqlResolver.*`

Resolvers provide intelligent batching for N+1 query problems:

### `findById` - Batch by ID
```typescript
const userResolver = yield* MyDatabase.resolver.findById("FindUser", {
  Id: Users.select.fields.id,
  Result: Users.select,
  ResultId: (user) => user.id,
  execute: (db, ids) =>
    db.selectFrom("users").where("id", "in", ids).selectAll(),
});

// Use with batching
const users = yield* Effect.all(
  userIds.map(id => userResolver.execute(id)),
  { batching: true }
);
```

### `grouped` - Group results by key
```typescript
const postsByAuthorResolver = yield* MyDatabase.resolver.grouped("PostsByAuthor", {
  Id: Users.select.fields.id,
  Result: Posts.select,
  ResultId: (post) => post.authorId,
  execute: (db, authorIds) =>
    db.selectFrom("posts").where("authorId", "in", authorIds).selectAll(),
});

// Returns posts grouped by author
const postsByAuthor = yield* Effect.all(
  authorIds.map(id => postsByAuthorResolver.execute(id)),
  { batching: true }
);
```

### `ordered` - Maintain request order
```typescript
const orderedUserResolver = yield* MyDatabase.resolver.ordered("OrderedUser", {
  Id: Users.select.fields.id,
  Result: Users.select,
  ResultId: (user) => user.id,
  execute: (db, ids) =>
    db.selectFrom("users").where("id", "in", ids).selectAll(),
});

// Results maintain the same order as input IDs
const users = yield* Effect.all(
  userIds.map(id => orderedUserResolver.execute(id)),
  { batching: true }
);
```

### `void` - Batch operations with no return
```typescript
const deleteUsersResolver = yield* MyDatabase.resolver.void("DeleteUsers", {
  Id: Users.select.fields.id,
  execute: (db, ids) =>
    db.deleteFrom("users").where("id", "in", ids),
});

// Batch delete users
yield* Effect.all(
  userIds.map(id => deleteUsersResolver.execute(id)),
  { batching: true }
);
```

## Transactions

### Automatic Transaction Management
```typescript
const createUserWithPost = Effect.gen(function* () {
  const user = yield* createUser({
    name: "John Doe",
    email: "john@example.com",
  });

  const post = yield* createPost({
    title: "First Post",
    content: "Hello world!",
    authorId: user.id,
  });

  return { user, post };
}).pipe(
  MyDatabase.withTransaction, // Wraps in transaction
  Effect.provide(databaseLayer)
);
```

### Manual Transaction Control
```typescript
const manualTransaction = Effect.gen(function* () {
  const { sql } = yield* MyDatabase;
  
  return yield* sql.withTransaction(
    Effect.gen(function* () {
      const user = yield* createUser({ name: "John", email: "john@example.com" });
      const post = yield* createPost({ title: "Post", content: "Content", authorId: user.id });
      return { user, post };
    })
  );
}).pipe(
  Effect.provide(databaseLayer)
);
```

## Advanced Features

### Direct Kysely Access
```typescript
const customQuery = Effect.gen(function* () {
  const { kysely } = yield* MyDatabase;
  
  return yield* kysely(db =>
    db.selectFrom("users")
      .innerJoin("posts", "users.id", "posts.authorId")
      .select(["users.name", "posts.title"])
      .where("users.id", "=", 1)
  );
});

// Or MyDatabase.kysely(db => ...)
```

### Streaming Large Datasets
```typescript
const streamUsers = Effect.gen(function* () {
  const { sql } = yield* MyDatabase;
  
  return yield* sql.executeStream(
    "SELECT * FROM users WHERE created_at > $1",
    [new Date("2024-01-01").toISOString()]
  );
});
```

### Custom SQL with Parameters
```typescript
const customSql = Effect.gen(function* () {
  const { sql } = yield* MyDatabase;
  
  return yield* sql.execute(
    "SELECT COUNT(*) as count FROM users WHERE created_at > $1",
    [new Date("2024-01-01").toISOString()]
  );
});
```

### OpenTelemetry Integration
```typescript
const databaseLayer = MyDatabase.layer({
  acquire: Effect.sync(() => new kysely.Kysely<DatabaseSchema>({ /* config */ })),
  spanAttributes: [
    ["db.system", "postgresql"],
    ["db.name", "myapp"],
    ["service.name", "user-service"],
  ],
});
```

## Error Handling

All database operations return `Effect` types that properly handle errors:

```typescript
const safeUserOperation = Effect.gen(function* () {
  const user = yield* createUser({
    name: "John Doe",
    email: "john@example.com",
  });

  return user;
}).pipe(
  Effect.catchTag("SqlError", sqlError => ...),
  Effect.provide(databaseLayer)
);
```

## Third-Party Integration

### PowerSync Integration
```typescript
import { PowerSyncDatabase } from "@powersync/react";

const powersyncLayer = MyDatabase.layer({
  acquire: Effect.sync(() => {
    export const powerSyncDb = new PowerSyncDatabase({
      database: {
        dbFilename: 'test.sqlite'
      },
      schema: appSchema
    });

    return wrapPowerSyncWithKysely(powerSyncDb);
  }),
});
```

## Type Safety

The library provides full type safety throughout the query chain:

```typescript
// Type-safe table definition
const Users = Table({
  id: Generated(Schema.Int),
  name: Schema.String,
  email: Schema.String,
});

// Type-safe query operations
const createUser = MyDatabase.schema.single({
  Request: Users.insert,
  Result: Users.select, // Type-safe result
  execute: (db, insert) =>
    db.insertInto("users").values(insert).returningAll(),
});

// Type-safe usage
const user: User = yield* createUser({
  name: "John Doe",
  email: "john@example.com",
});
// user.id is typed as number
// user.name is typed as string
// user.email is typed as string
```

### Utilize Kysely as a query builder only

Note: Be careful of utilizing row transformations in your SqlClient, as if they are not reflected in your Kysely database schema, you may end up with unexpected results.

```typescript
import { makeKyselyEffect, makeResolver, makeSchema } from 'effect-sql-kysely';

const db = new Kysely<Database>(...);
const sql = yield* SqlClient;
const kysely = makeKyselyEffect(db, sql);
// Construct your resolvers helpers
const resolver = makeResolver(kysely);
// Cosntructor your schema helpers
const schema = makeSchema(kysely);

yield* kysely(db => db.selectFrom("users").selectAll());
resolver.findById(...)
schema.findAll(...)
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
