import { describe, expect, it } from "@effect/vitest";
import { Array, Effect, Option } from "effect";
import * as Database from "../src/Sqlite.js";
import { Generated, Table } from "../src/Schema.js";
import * as Schema from "effect/Schema";
import * as kysely from "kysely";
import BetterSqlite3 from "better-sqlite3";

describe("database", () => {
  class Users extends Table({
    id: Generated(Schema.Int),
    name: Schema.String,
  }) { }

  const TestSchema = Schema.Struct({
    users: Users,
  })

  type TestSchema = typeof TestSchema.Encoded

  class TestDatabase extends Database.make<TestSchema, TestDatabase>(
    "TestDatabase"
  ) { }

  const acquire = Effect.promise(async () => {
    const db = new kysely.Kysely<TestSchema>({
      dialect: new kysely.SqliteDialect({
        database: new BetterSqlite3(":memory:"),
      }),
    });

    await db.schema
      .createTable("users")
      .addColumn("id", "integer", (column) =>
        column.primaryKey().autoIncrement()
      )
      .addColumn("name", "text")
      .execute();

    return db;
  });

  const createUser = TestDatabase.schema.single({
    Request: Users.insert,
    Result: Users.select,
    execute: (db, insert) =>
      db.insertInto("users").values(insert).returningAll(),
  });

  const findUser = TestDatabase.schema.findOne({
    Request: Users.select.fields.id,
    Result: Users.select,
    execute: (db, id) =>
      db.selectFrom("users").where("id", "=", id).selectAll(),
  });

  it.scoped("allows making SQL queries", () =>
    Effect.gen(function* () {
      const created = yield* createUser({ name: "Test" });
      const selected = yield* findUser(created.id);

      expect(Option.some(created)).toEqual(selected);
    }).pipe(Effect.provide(TestDatabase.layer({ acquire })))
  );

  it.scoped("allows making SQL queries with transactions", () =>
    Effect.gen(function* () {
      const created = yield* createUser({ name: "Test" });
      const selected = yield* findUser(created.id);

      expect(Option.some(created)).toEqual(selected);
    }).pipe(
      TestDatabase.withTransaction,
      Effect.provide(TestDatabase.layer({ acquire })),
    )
  );

  it.scoped("allows resolving by id", () => Effect.gen(function* () {
    const total = 10

    const created = yield* Effect.all(globalThis.Array.from({ length: total }, (_, i) => createUser({ name: `Test ${i}` })))

    const resolver = yield* TestDatabase.resolver.findById('FindUser', {
      Id: Users.select.fields.id,
      Result: Users.select,
      ResultId: (user) => user.id,
      execute: (db, ids) => {
        expect(ids.length).toBe(total);
        return db.selectFrom("users").where("id", 'in', ids).selectAll();
      },
    })

    const selected = yield* Effect.all(created.map(user => resolver.execute(user.id)), { batching: true })
    const zipped = Array.zip(created, selected)

    for (const [created, selected] of zipped) {
      expect(Option.some(created)).toEqual(selected);
    }
  }).pipe(Effect.provide(TestDatabase.layer({ acquire }))))
});
