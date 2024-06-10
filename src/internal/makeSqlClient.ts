import * as Sql from "@effect/sql";
import type { Connection } from "@effect/sql/Connection";
import { type Primitive } from "@effect/sql/Statement";
import { Chunk, Effect, Exit, Stream } from "effect";
import { CompiledQuery, type Kysely } from "kysely";
import { beginConnection } from "./beginConnection.js";
import { createQueryId } from "./createQueryId.js";

export function makeSqlClient<DB>({
  database,
  compiler,
  spanAttributes = [],
  chunkSize = 16,
}: {
  database: Kysely<DB>;
  compiler: Sql.statement.Compiler;
  spanAttributes?: ReadonlyArray<readonly [string, string]>;
  chunkSize?: number;
}): Sql.client.Client {
  const transformRows = Sql.statement.defaultTransforms((s) => s, false).array;

  // A Connection is a wrapper around a Kysely database connection, or Transaction, that provides
  // the ability to run queries within Effects and captures any errors that may occur.
  class ConnectionImpl implements Connection {
    constructor(private readonly db: Kysely<DB>) {}

    execute(sql: string, params: ReadonlyArray<Primitive>) {
      return Effect.tryPromise({
        try: () =>
          this.db
            .executeQuery(compileSqlQuery(sql, params))
            .then((r) => transformRows(r.rows)),
        catch: (error) => new Sql.error.SqlError({ error }),
      });
    }

    executeWithoutTransform(sql: string, params: ReadonlyArray<Primitive>) {
      return Effect.tryPromise({
        try: () =>
          this.db
            .executeQuery(compileSqlQuery(sql, params))
            .then((r) => r.rows),
        catch: (error) => new Sql.error.SqlError({ error }),
      });
    }

    executeValues(sql: string, params: ReadonlyArray<Primitive>) {
      return Effect.map(this.executeRaw(sql, params), (results) =>
        results.map((x) => Object.values(x as Record<string, Primitive>))
      );
    }

    executeRaw(sql: string, params?: ReadonlyArray<Primitive>) {
      return Effect.tryPromise({
        try: () =>
          this.db
            .executeQuery(compileSqlQuery(sql, params))
            .then((r) => transformRows(r.rows)),
        catch: (error) => new Sql.error.SqlError({ error }),
      });
    }

    executeStream(sql: string, params: ReadonlyArray<Primitive>) {
      const query = compileSqlQuery(sql, params);
      return Stream.suspend(() =>
        Stream.mapChunks(
          Stream.fromAsyncIterable(
            this.db
              .getExecutor()
              .stream(query, chunkSize, { queryId: createQueryId() }),
            (error) => new Sql.error.SqlError({ error })
          ),
          Chunk.flatMap((result) => Chunk.unsafeFromArray(result.rows))
        )
      );
    }
  }

  const acquirer = Effect.succeed(new ConnectionImpl(database));

  return Sql.client.make({
    // Our default connection is managed by Kysely
    acquirer,
    // Our SQL statement compiler
    compiler,
    // We don't utilize db.transaction() because Sql.client.make will handle the actual transaction
    // But we do ensure that all queries are run within a single connection
    transactionAcquirer: Effect.map(
      Effect.acquireRelease(
        Effect.promise(() => beginConnection(database)),
        (conn, exit) =>
          Effect.promise(() =>
            Exit.match(exit, {
              // If the scope fails we rollback the transaction
              onFailure: () => conn.fail(),
              // If the scope succeeds we commit the transaction
              onSuccess: () => conn.success(),
            })
          )
      ),
      ({ conn }) => new ConnectionImpl(conn)
    ),
    spanAttributes,
  });
}

function compileSqlQuery(
  sql: string,
  params?: ReadonlyArray<Primitive>
): CompiledQuery<object> {
  return CompiledQuery.raw(sql, params as unknown[]) as CompiledQuery<object>;
}
