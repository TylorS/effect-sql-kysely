// Helper for creating a deferred promise
export class DeferredPromise<T> {
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
