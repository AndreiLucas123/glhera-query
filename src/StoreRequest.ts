import { Signal, signalFactory } from 'signal-factory';
import { StoreRequest, StoreRequestOptions } from './StoreRequestTypes';

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

export function storeRequest<T, U>(
  fetcher: (signal: AbortSignal, sourceData: U) => Promise<T>,
): StoreRequest<T, U>;
export function storeRequest<T, U>(
  opts: StoreRequestOptions<T, U>,
): StoreRequest<T, U>;

//
//

export function storeRequest<T, U>(
  opts:
    | ((signal: AbortSignal, sourceData: U) => Promise<T>)
    | StoreRequestOptions<T, U>,
): StoreRequest<T, U> {
  //
  //

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

  //
  //

  function destroy() {
    unsub1();
    unsub2();
    lastAbortController?.abort();
    fetcher = null!;
  }

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
    destroy,
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
  //  Subscribe to the source signal

  let ignoreSource = true;
  const unsub1 = source.subscribe(() => {
    if (ignoreSource || !enabled.value) {
      return;
    }

    fetch();
  });
  ignoreSource = false;

  //
  //  Subscribe to the enabled signal

  const unsub2 = enabled.subscribe(fetch);

  //
  //

  return output;
}
