import { Reactivity } from "@effect/experimental";
import type { SqlConnection } from "@effect/sql";
import { SqlClient, SqlError, Statement } from "@effect/sql";
import { Chunk, Effect, Exit, Stream } from "effect";
import { squash } from "effect/Cause";
import { Compilable, CompiledQuery, type Kysely } from "kysely";
import { beginConnection } from "./internal/beginConnection.js";

const transformRows = Statement.defaultTransforms((s) => s, false).array;

/**
 * Low-level ability to construct an @effect/sql SqlClient interface for a Kysely database.
 */
export function makeSqlClient<DB>({
  database,
  compiler,
  spanAttributes = [],
  chunkSize = 16,
}: {
  database: Kysely<DB>;
  compiler: Statement.Compiler;
  spanAttributes?: ReadonlyArray<readonly [string, string]>;
  chunkSize?: number;
}): Effect.Effect<SqlClient.SqlClient, never, Reactivity.Reactivity> {
  class ConnectionImpl implements SqlConnection.Connection {
    constructor(private readonly db: Kysely<DB>) {}

    executeUnprepared(
      sql: string,
      params?: ReadonlyArray<unknown> | undefined,
    ): Effect.Effect<ReadonlyArray<unknown>, SqlError.SqlError> {
      return Effect.tryPromise({
        try: () =>
          this.db.executeQuery(compileSqlQuery(sql, params)).then((r) => transformRows(r.rows)),
        catch: (cause) => new SqlError.SqlError({ cause }),
      });
    }

    execute(sql: string, params: ReadonlyArray<unknown>) {
      return Effect.tryPromise({
        try: () =>
          this.db.executeQuery(compileSqlQuery(sql, params)).then((r) => transformRows(r.rows)),
        catch: (cause) => new SqlError.SqlError({ cause }),
      });
    }

    executeWithoutTransform(sql: string, params: ReadonlyArray<unknown>) {
      return Effect.tryPromise({
        try: () => this.db.executeQuery(compileSqlQuery(sql, params)).then((r) => r.rows),
        catch: (cause) => new SqlError.SqlError({ cause }),
      });
    }

    executeValues(sql: string, params: ReadonlyArray<unknown>) {
      return Effect.map(this.executeRaw(sql, params), (results) =>
        results.map((x) => Object.values(x as Record<string, unknown>)),
      );
    }

    executeRaw(sql: string, params?: ReadonlyArray<unknown>) {
      return Effect.tryPromise({
        try: () =>
          this.db.executeQuery(compileSqlQuery(sql, params)).then((r) => transformRows(r.rows)),
        catch: (cause) => new SqlError.SqlError({ cause }),
      });
    }

    executeStream(sql: string, params: ReadonlyArray<unknown>) {
      const query = compileSqlQuery(sql, params);
      return Stream.suspend(() =>
        Stream.mapChunks(
          Stream.fromAsyncIterable(
            this.db.getExecutor().stream(query, chunkSize),
            (cause) => new SqlError.SqlError({ cause }),
          ),
          Chunk.flatMap((result) => Chunk.unsafeFromArray(result.rows)),
        ),
      );
    }
  }

  return SqlClient.make({
    // Our default connection is managed by Kysely
    acquirer: Effect.succeed(new ConnectionImpl(database)),
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
              onFailure: (cause) => conn.fail(squash(cause)),
              // If the scope succeeds we commit the transaction
              onSuccess: () => conn.success(),
            }),
          ),
      ),
      ({ conn }) => new ConnectionImpl(conn),
    ),
    spanAttributes,
  });
}

export function makeSqlWithKysely<DB>(database: Kysely<DB>, sql: SqlClient.SqlClient) {
  return <Out>(
    f: (db: Kysely<DB>) => Compilable<Out>,
  ): Effect.Effect<ReadonlyArray<Out>, SqlError.SqlError, never> => {
    // We utilize compile() and sql.unsafe to enable utilizing Effect's notion of a Transaction
    const compiled = f(database).compile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return sql.unsafe<any>(compiled.sql, compiled.parameters);
  };
}

function compileSqlQuery(sql: string, params?: ReadonlyArray<unknown>): CompiledQuery<object> {
  return CompiledQuery.raw(sql, params as unknown[]);
}
