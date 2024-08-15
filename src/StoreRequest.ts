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
  opts: StoreRequestOptions<T, U>,
): StoreRequest<T, U>;

//
//

export function storeRequest<T, U>(
  opts: StoreRequestOptions<T, U>,
): StoreRequest<T, U> {
  //
  //

  let fetcher: (sourceData: U, signal: AbortSignal) => Promise<T> =
    opts.fetcher;

  const source = opts.source;

  const compare = opts.compare;
  let lastCompared: any = null;

  let unsubSource: (() => void) | null = null;

  //
  //

  const enabled = signalFactory<boolean>(opts.enabled ?? false);
  const data = signalFactory<T>(notFetchedSymbol);
  const pending = signalFactory<boolean>(false);
  // @ts-ignore
  const error = signalFactory<any>();
  const status = signalFactory<'idle' | 'pending' | 'error' | 'success'>(
    'idle',
  );
  const fetchStatus = signalFactory<'fetching' | 'paused' | 'idle'>('idle');

  let lastAbortController: AbortController | null = null;

  //
  //

  async function fetch(): Promise<void> {
    if (!enabled.value) {
      return;
    }

    const sourceValue = source.value;

    if (compare) {
      const compared = compare(sourceValue);
      if (compared === lastCompared) {
        return;
      }

      if (Array.isArray(compared) && Array.isArray(lastCompared)) {
        if (compared.length === lastCompared.length) {
          if (compared.every((v, i) => v === lastCompared[i])) {
            return;
          }
        }
      }

      lastCompared = compared;
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
      const dataFetched = await fetcher(sourceValue, abortController.signal);

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

  function destroy() {
    unsubEnabled();
    unsubSource?.();
    lastAbortController?.abort();
    lastAbortController = null;
    fetcher = null!;
  }

  //
  //

  function setInitial(initial: { data?: T; error?: any }) {
    output.lastFetchTime = new Date();

    if (initial.data !== undefined) {
      data.value = initial.data;
      status.value = 'success';
    }

    if (initial.error !== undefined) {
      error.value = initial.error;
      status.value = 'error';
    }
  }

  //
  //

  const output: StoreRequest<T, U> = {
    data: new Proxy(data, dataProxyHandler),
    pending,
    error,
    status,
    fetchStatus,
    enabled,
    fetch,
    fetcher,
    setInitial,
    destroy,
  };

  //
  //  Subscribe to the enabled signal

  const unsubEnabled = enabled.subscribe((_enabled) => {
    if (_enabled) {
      if (!unsubSource) {
        unsubSource = source.subscribe(fetch);
      }
    } else {
      if (unsubSource) {
        unsubSource();
        unsubSource = null;
      }
    }
  });

  //
  //

  return output;
}
