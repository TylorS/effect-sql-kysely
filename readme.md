# effect-sql-kysely

`effect-sql-kysely` is an full-featured integration between `@effect/sql` and `Kysely`.

`effect-sql-kysely` implements the [`SqlClient`](https://effect-ts.github.io/effect/sql/SqlClient.ts.html#sqlclient-interface) interface directly.
This means that `Kysely` is always the one managing database connections, transactions, etc.

We build atop of the `@effect/sql-*` packages to enable support for MsSql, MySql2, Postgres, and Sqlite databases.

This is especially important if you're utilizing 3rd-party libraries which wrap around or create a Kysely instance for you to interact with. such as [PowerSync](https://github.com/powersync-ja/powersync-js/blob/main/packages/kysely-driver/README.md)

## Basic Usage

```ts
// Integrates with Kysely's ColumnType + @effect/schema
const Users = Table({
  id: Generated(Schema.Int),
  name: Schema.String,
});

type User = typeof Users.select.Type;

const TestDatabaseSchema = Schema.Struct({
  users: Users,
});

type TestDatabaseSchema = typeof TestDatabaseSchema.Encoded;

// Define your Database with a specificSchema
class TestDatabase extends Database.make<TestDatabaseSchema, TestDatabase>(
  "TestDatabase"
) {}

// Integrates with `@effect/sql`s Schema and Resolver APIs
const createUser = TestDatabase.schema.single({
  Request: Schema.String,
  Result: Users.select,
  // Kysely Instance is injected as the first parameter before the Request Type
  execute: (db, name) => db.insertInto("users").values({ name }).returningAll(),
});

const findUser = TestDatabase.schema.findOne({
  Request: Users.select.fields.id,
  Result: Users.select,
  execute: (db, id) => db.selectFrom("users").where("id", "=", id).selectAll(),
});

const main = Effect.gen(function* (_) {
  const created: User = yield* _(createUser("Test"));
  const selected: Option.Option<User> = yield* _(findUser(created.id));

  expect(Option.some(created)).toEqual(selected);
}).pipe(
  Effect.provide(
    TestDatabase.layer({
      // Acquire a Kysely instance
      acquire: Effect.sync(
        () =>
          new kysely.Kysely<TestSchema>({
            dialect: new kysely.SqliteDialect({
              database: new BetterSqlite3(":memory:"),
            }),
          })
      ),
      
      // Optionals
      // Key-values utilized for OpenTelemetry
      spanAttributes: [ ['key', 'value'], ['foo', 'bar'] ] // Defaults to []
      // Utilized when streaming data, in bytes
      chunkSize: 16 // default

    })
  ),
  Effect.scoped
);
```
