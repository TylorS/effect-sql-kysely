import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import * as Database from "../src/Sqlite.js";
import { Generated, Table } from "../src/Schema.js";
import * as Schema from "@effect/schema/Schema";
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
  ) {}

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
    Request: Schema.String,
    Result: Users.select,
    execute: (db, name) =>
      db.insertInto("users").values({ name }).returningAll(),
  });

  const findUser = TestDatabase.schema.findOne({
    Request: Users.select.fields.id,
    Result: Users.select,
    execute: (db, id) =>
      db.selectFrom("users").where("id", "=", id).selectAll(),
  });

  it.effect("should allow making SQL queries", () =>
    Effect.gen(function* (_) {
      const created = yield* _(createUser("Test"));
      const selected = yield* _(findUser(created.id));

      expect(Option.some(created)).toEqual(selected);
    }).pipe(Effect.provide(TestDatabase.layer({ acquire })), Effect.scoped)
  );

  it.effect("should allow making SQL queries with transactions", () =>
    Effect.gen(function* (_) {
      const created = yield* _(createUser("Test"));
      const selected = yield* _(findUser(created.id));

      expect(Option.some(created)).toEqual(selected);
    }).pipe(
      TestDatabase.withTransaction,
      Effect.provide(TestDatabase.layer({ acquire })),
      Effect.scoped
    )
  );
});
