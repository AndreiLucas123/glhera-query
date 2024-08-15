import { Signal, signalFactory } from 'signal-factory';

//
//

export type StoreRequest<T, U> = {
  /**
   * Signal that indicates if the store is enabled and will fetch the data.
   */
  enabled: Signal<any>;

  /**
   * Signal that indicates the data fetched from the server.
   *
   * If tried to access the value before the data is fetched, it will throw an error.
   */
  data: Signal<T>;

  /**
   * Signal that indicates if the status === 'pending'
   */
  pending: Signal<boolean>;

  /**
   * Signal that indicates the error that occurred while fetching the data.
   */
  error: Signal<any>;

  /**
   * Signal that indicates the status of the data
   *
   * - `idle` - The data has not been fetched yet and is not being fetched.
   * - `pending` - The data is being fetched. (Useful for loading spinners or skeletons)
   * - `error` - An error occurred while fetching the data.
   * - `success` - The data was fetched successfully.
   */
  status: Signal<'idle' | 'pending' | 'error' | 'success'>;

  /**
   * Signal that indicates if the data is being fetched.
   * (Useful for changing the opacity of the data being displayed, or displaying a loading spinner without blocking the UI)
   *
   * - `idle` - The data is not being fetched.
   * - `fetching` - The data is being fetched.
   */
  fetchStatus: Signal<'fetching' | 'idle'>;

  /**
   * Source of the data that will be used to fetch the data.
   *
   * This signal will be used to trigger a new fetch when the value changes.
   *
   * If the source is undefined, it will not fetch the data.
   */
  source: Signal<U | undefined>;

  /**
   * Method called by `StoreRequest.fetch`
   */
  fetcher: (signal: AbortSignal, sourceData: U) => Promise<T>;

  /**
   * Will cancel the current fetch request if it is pending.
   *
   * Then it will fetch the data again and update the signals.
   *
   * If the enabled signal is false, it will not fetch the data.
   *
   * Will not throw an error if the fetch fails. The error will be stored in the `error` signal.
   */
  fetch: () => Promise<void>;

  /**
   * Data from the last fetch that executed
   */
  lastFetchTime?: Date;
};

//
//
const dataProxyHandler: ProxyHandler<Signal> = {
  get(target, property, receiver) {
    if (property === 'value') {
      if (target.value === notFetchedSymbol) {
        throw new Error('Data not fetched yet');
      }
    }
    return Reflect.get(target, property, receiver);
  },
};

//
//

const notFetchedSymbol = Symbol.for('notFetched');

//
//

export type StoreRequestOptions<T, U> = {
  fetcher: (signal: AbortSignal, sourceData: U) => Promise<T>;
  data?: T;
  source?: U;
  error?: any;
  enabled?: boolean;
};

//
//

export function storeRequest<T, U>(
  fetcher: (signal: AbortSignal, sourceData: U) => Promise<T>,
): StoreRequest<T, U>;
export function storeRequest<T, U>(
  opts: StoreRequestOptions<T, U>,
): StoreRequest<T, U>;

//

export function storeRequest<T, U>(
  opts:
    | ((signal: AbortSignal, sourceData: U) => Promise<T>)
    | StoreRequestOptions<T, U>,
): StoreRequest<T, U> {
  let fetcher: (signal: AbortSignal, sourceData: U) => Promise<T>;

  if (typeof opts === 'function') {
    fetcher = opts;
    opts = { fetcher };
  } else {
    fetcher = opts.fetcher;

    if (!fetcher) {
      throw new Error('fetcher is required');
    }

    if (opts.data !== undefined && opts.error !== undefined) {
      throw new Error('data and error cannot be defined at the same time');
    }
  }

  //
  //

  const enabled = signalFactory<boolean>(opts.enabled ?? false);
  const data = signalFactory<T>(notFetchedSymbol);
  const pending = signalFactory<boolean>(false);
  const error = signalFactory<any>(opts.error);
  const status = signalFactory<'idle' | 'pending' | 'error' | 'success'>(
    'idle',
  );
  const fetchStatus = signalFactory<'fetching' | 'idle'>('idle');

  let lastAbortController: AbortController | null = null;

  //
  //

  async function fetch(): Promise<void> {
    if (!enabled.value) {
      return;
    }

    if (lastAbortController) {
      lastAbortController.abort();
    }

    const abortController = new AbortController();
    lastAbortController = abortController;

    fetchStatus.value = 'fetching';
    pending.value = true;

    // Only update the status if it is idle
    if (status.value === 'idle') {
      status.value = 'pending';
    }

    try {
      output.lastFetchTime = new Date();
      const dataFetched = await fetcher(abortController.signal, source.value);

      if (abortController !== lastAbortController) {
        return;
      }

      data.value = dataFetched;
      error.value = undefined;
      status.value = 'success';
    } catch (err) {
      if (abortController !== lastAbortController) {
        return;
      }

      error.value = err;
      status.value = 'error';
    } finally {
      if (abortController !== lastAbortController) {
        return;
      }

      fetchStatus.value = 'idle';
      pending.value = false;
    }
  }

  //
  //

  const source = signalFactory<U>(opts.source);

  let ignoreSource = true;
  source.subscribe(() => {
    if (ignoreSource) {
      return;
    }

    fetch();
  });
  ignoreSource = false;

  //
  //

  const output: StoreRequest<T, U> = {
    data: new Proxy(data, dataProxyHandler),
    pending,
    error,
    status,
    fetchStatus,
    source,
    enabled,
    fetch,
    fetcher,
  };

  //
  //

  if (opts.data !== undefined) {
    data.value = opts.data;
    status.value = 'success';
    output.lastFetchTime = new Date();
  }

  //
  //

  if (opts.error !== undefined) {
    error.value = opts.error;
    status.value = 'error';
    output.lastFetchTime = new Date();
  }

  //
  //

  return output;
}
