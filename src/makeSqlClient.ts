import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type * as SqlConnection from "effect/unstable/sql/SqlConnection";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlError from "effect/unstable/sql/SqlError";
import * as Statement from "effect/unstable/sql/Statement";
import { Effect, Exit, Stream } from "effect";
import { squash } from "effect/Cause";
import { Compilable, CompiledQuery, type Kysely } from "kysely";
import { beginConnection } from "./internal/beginConnection.js";

const defaultTransformRows = Statement.defaultTransforms((s) => s, false).array;

type TransformRows = NonNullable<Parameters<SqlConnection.Connection["execute"]>[2]>;

const toSqlError = (cause: unknown) =>
  new SqlError.SqlError({ reason: new SqlError.UnknownError({ cause }) });

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
  spanAttributes?: ReadonlyArray<readonly [string, unknown]>;
  chunkSize?: number;
}): Effect.Effect<SqlClient.SqlClient, never, Reactivity.Reactivity> {
  class ConnectionImpl implements SqlConnection.Connection {
    constructor(private readonly db: Kysely<DB>) {}

    private queryRows(
      sql: string,
      params: ReadonlyArray<unknown>,
      transformRows: TransformRows | undefined,
    ) {
      return Effect.tryPromise({
        try: () =>
          this.db.executeQuery(compileSqlQuery(sql, params)).then((result) =>
            transformRows !== undefined
              ? transformRows(result.rows as Array<object>)
              : result.rows,
          ),
        catch: toSqlError,
      });
    }

    execute(
      sql: string,
      params: ReadonlyArray<unknown>,
      transformRows: TransformRows | undefined,
    ) {
      return this.queryRows(sql, params, transformRows);
    }

    executeUnprepared(
      sql: string,
      params: ReadonlyArray<unknown>,
      transformRows: TransformRows | undefined,
    ) {
      return this.queryRows(sql, params, transformRows);
    }

    executeRaw(sql: string, params: ReadonlyArray<unknown>) {
      return Effect.tryPromise({
        try: () => this.db.executeQuery(compileSqlQuery(sql, params)).then((r) => r.rows),
        catch: toSqlError,
      });
    }

    executeValues(sql: string, params: ReadonlyArray<unknown>) {
      return Effect.map(this.executeRaw(sql, params), (results) =>
        (results as Array<Record<string, unknown>>).map((x) => Object.values(x)),
      );
    }

    executeValuesUnprepared(sql: string, params: ReadonlyArray<unknown>) {
      return this.executeValues(sql, params);
    }

    executeStream(sql: string, params: ReadonlyArray<unknown>, transformRows: TransformRows | undefined) {
      const query = compileSqlQuery(sql, params);
      return Stream.fromIterableEffect(
        Effect.tryPromise({
          try: async () => {
            const rows: Array<unknown> = [];
            for await (const result of this.db.getExecutor().stream(query, chunkSize)) {
              const batch =
                transformRows !== undefined
                  ? transformRows(result.rows as Array<object>)
                  : result.rows;
              rows.push(...batch);
            }
            return rows;
          },
          catch: toSqlError,
        }),
      );
    }
  }

  return SqlClient.make({
    // Our default connection is managed by Kysely
    acquirer: Effect.succeed(new ConnectionImpl(database)),
    // Our SQL statement compiler
    compiler,
    transformRows: defaultTransformRows,
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

export function makeKyselyEffect<DB>(database: Kysely<DB>, sql: SqlClient.SqlClient) {
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
