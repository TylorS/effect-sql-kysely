import * as Sql from "@effect/sql";
import type { Connection } from "@effect/sql/Connection";
import { type Primitive } from "@effect/sql/Statement";
import { Chunk, Effect, Exit, Stream } from "effect";
import { CompiledQuery, type Kysely, type Transaction } from "kysely";

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
      return Stream.suspend(() => {
        const executor = this.db.getExecutor();
        return Stream.mapChunks(
          Stream.fromAsyncIterable(
            executor.stream(compileSqlQuery(sql, params), chunkSize, {
              queryId: createQueryId(),
            }),
            (error) => new Sql.error.SqlError({ error })
          ),
          Chunk.flatMap((result) => Chunk.unsafeFromArray(result.rows))
        );
      });
    }
  }

  return Sql.client.make({
    // Our default connection is managed by Kysely
    acquirer: Effect.succeed(new ConnectionImpl(database)),
    // Our SQL statement compiler
    compiler,
    // Acquire a new transaction from the Kysely database
    transactionAcquirer: Effect.gen(function* (_) {
      const { trx } = yield* _(
        // Acquire a transaction
        Effect.acquireRelease(
          Effect.promise(() => begin(database)),
          (trx, exit) =>
            Effect.promise(() =>
              Exit.match(exit, {
                // If the scope fails we rollback the transaction
                onFailure: () => trx.rollback(),
                // If the scope succeeds we commit the transaction
                onSuccess: () => trx.commit(),
              })
            )
        )
      );

      return new ConnectionImpl(trx);
    }),
    spanAttributes,
  });
}

function compileSqlQuery(
  sql: string,
  params?: ReadonlyArray<Primitive>
): CompiledQuery<object> {
  return CompiledQuery.raw(sql, params as unknown[]) as CompiledQuery<object>;
}

// Adapts Kysely's transaction API to Effect's API where we can manually
// close the transaction by calling commit or rollback at a later point in time.
async function begin<DB>(db: Kysely<DB>) {
  const connection = new DeferredPromise<Transaction<DB>>();
  const result = new DeferredPromise<unknown>();

  // Do NOT await this line.
  const transaction = db
    .transaction()
    .execute((trx) => {
      connection.resolve(trx);
      return result.promise;
    })
    .catch(() => null);

  const trx = await connection.promise;

  return {
    trx,
    commit() {
      result.resolve(null);
      return transaction;
    },
    rollback() {
      result.reject(new Error("rollback"));
      return transaction;
    },
  };
}

// Helper for creating a deferred promise
class DeferredPromise<T> {
  readonly _promise: Promise<T>;

  _resolve?: (value: T | PromiseLike<T>) => void;
  _reject?: (reason?: unknown) => void;

  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._reject = reject;
      this._resolve = resolve;
    });
  }

  get promise(): Promise<T> {
    return this._promise;
  }

  resolve = (value: T | PromiseLike<T>): void => {
    if (this._resolve) {
      this._resolve(value);
    }
  };

  reject = (reason?: unknown): void => {
    if (this._reject) {
      this._reject(reason);
    }
  };
}

// Create a unique query ID
function createQueryId() {
  return randomString(8);
}

// Our alphabet for generating random strings
const CHARS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];

// Generate a random string of a given length
function randomString(length: number) {
  let chars = "";
  for (let i = 0; i < length; ++i) {
    chars += randomChar();
  }
  return chars;
}

// Select a random character from our alphabet
function randomChar() {
  return CHARS[~~(Math.random() * CHARS.length)];
}
