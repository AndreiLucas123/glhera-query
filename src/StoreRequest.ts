import { QuerySignal, signalFactory } from './signalFactory';

//
//

export type StoreRequest<T, U> = {
  /**
   * Signal that indicates the data fetched from the server.
   *
   * If tried to access the value before the data is fetched, it will throw an error.
   */
  data: QuerySignal<T>;

  /**
   * Signal that indicates if the status === 'pending'
   */
  pending: QuerySignal<boolean>;

  /**
   * Signal that indicates the error that occurred while fetching the data.
   */
  error: QuerySignal<any>;

  /**
   * Signal that indicates the status of the data
   *
   * - `idle` - The data has not been fetched yet and is not being fetched.
   * - `pending` - The data is being fetched. (Useful for loading spinners or skeletons)
   * - `error` - An error occurred while fetching the data.
   * - `success` - The data was fetched successfully.
   */
  status: QuerySignal<'idle' | 'pending' | 'error' | 'success'>;

  /**
   * Signal that indicates if the data is being fetched.
   * (Useful for changing the opacity of the data being displayed, or displaying a loading spinner without blocking the UI)
   *
   * - `idle` - The data is not being fetched.
   * - `fetching` - The data is being fetched.
   */
  fetchStatus: QuerySignal<'fetching' | 'idle'>;

  /**
   * Source of the data that will be used to fetch the data.
   *
   * This signal will be used to trigger a new fetch when the value changes.
   *
   * If the source is undefined, it will not fetch the data.
   */
  source: QuerySignal<U | undefined>;

  /**
   * Method called by `StoreRequest.fetch`
   */
  fetcher: (signal: AbortSignal, sourceData: U) => Promise<T>;

  /**
   * Will cancel the current fetch request if it is pending.
   *
   * Then it will fetch the data again and update the signals.
   *
   * If the source is undefined, it will not fetch the data.
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
const dataProxyHandler: ProxyHandler<QuerySignal> = {
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

export function storeRequest<T, U>(
  fetcher: (signal: AbortSignal, sourceData: U) => Promise<T>,
  initialData?: T,
  initialSource?: U,
): StoreRequest<T, U> {
  //
  //

  const data = signalFactory<T>(notFetchedSymbol);
  const pending = signalFactory<boolean>(false);
  const error = signalFactory<any>(null);
  const status = signalFactory<'idle' | 'pending' | 'error' | 'success'>(
    'idle',
  );
  const fetchStatus = signalFactory<'fetching' | 'idle'>('idle');

  let lastAbortController: AbortController | null = null;

  //
  //

  async function fetch(): Promise<void> {
    if (source.value === undefined) {
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
      error.value = null;
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

  const source = signalFactory<U>(initialSource);

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
    fetch,
    fetcher,
  };

  //
  //

  if (initialData !== undefined) {
    data.value = initialData;
    status.value = 'success';
    output.lastFetchTime = new Date();
  }

  //
  //

  return output;
}
