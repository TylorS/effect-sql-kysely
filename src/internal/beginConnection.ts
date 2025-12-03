import type { Kysely } from "kysely";
import { DeferredPromise } from "./DeferredPromise.js";

export async function beginConnection<DB>(db: Kysely<DB>) {
  const connection = new DeferredPromise<Kysely<DB>>();
  const result = new DeferredPromise<unknown>();

  // Do NOT await this line.
  const transaction = db
    .connection()
    .execute((conn) => {
      connection.resolve(conn);
      return result.promise;
    })
    .catch(connection.reject);

  const conn = await connection.promise;

  return {
    conn,
    success() {
      result.resolve(null);
      return transaction;
    },
    fail(cause: unknown) {
      result.reject(cause);
      return transaction;
    },
  };
}
