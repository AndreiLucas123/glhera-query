import { signalFactory } from 'signal-factory';
import { StoreRequest, StoreRequestOptions } from './StoreRequestTypes';
import { GLHeraClient } from './glheraClient';

//
//

const notFetchedSymbol = Symbol.for('notFetched');

//
//

export function storeRequest<T, U>(
  client: GLHeraClient,
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
  let unsubEnabled: (() => void) | null = null;
  let unsubOnline: (() => void) | null = null;

  //
  //

  const { focusManager, onlineManager } = client;

  //
  //

  const enabled = signalFactory<boolean>(opts.enabled ?? false);
  const data = signalFactory<T>(notFetchedSymbol as any);
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
    if (!enabled.get()) {
      return;
    }

    if (compare) {
      const compared = compare(source.get());
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

    return internalFetch();
  }

  //
  //

  /** Does the fatch, but will not compare or check if is enabled */
  async function internalFetch() {
    if (onlineManager.get() === false) {
      fetchStatus.set('paused');
      pending.set(true);
      status.set('pending');
      unsubOnline = onlineManager.subscribe((online) => {
        if (online) {
          internalFetch();
        }
      });
      return;
    }

    if (lastAbortController) {
      lastAbortController.abort();
    }

    const abortController = new AbortController();
    lastAbortController = abortController;

    fetchStatus.set('fetching');
    pending.set(true);

    // Only update the status if it is idle
    if (status.get() === 'idle') {
      status.set('pending');
    }

    try {
      output.lastFetchTime = new Date();
      const dataFetched = await fetcher(source.get(), abortController.signal);

      if (abortController !== lastAbortController) {
        return;
      }

      data.set(dataFetched);
      error.set(undefined);
      status.set('success');
    } catch (err) {
      if (abortController !== lastAbortController) {
        return;
      }

      error.set(err);
      status.set('error');
    } finally {
      if (abortController !== lastAbortController) {
        return;
      }

      fetchStatus.set('idle');
      pending.set(false);
    }
  }

  //
  //

  function unsubSourceAndOnline() {
    if (unsubSource) {
      unsubSource();
      unsubSource = null;
    }
    if (unsubOnline) {
      unsubOnline();
      unsubOnline = null;
    }
  }

  //
  //

  function destroy() {
    unsubEnabled!();
    unsubEnabled = null;

    lastAbortController?.abort();
    lastAbortController = null;
    fetcher = null!;

    unsubSourceAndOnline();
  }

  //
  //

  function setInitial(initial: { data?: T; error?: any }) {
    output.lastFetchTime = new Date();

    if (initial.data !== undefined) {
      data.set(initial.data);
      status.set('success');
    }

    if (initial.error !== undefined) {
      error.set(initial.error);
      status.set('error');
    }
  }

  //
  //

  const oldDataGet = data.get;

  data.get = () => {
    if (oldDataGet() === notFetchedSymbol) {
      throw new Error('Data not fetched yet');
    }

    return oldDataGet();
  };

  //
  //

  const output: StoreRequest<T, U> = {
    data,
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

  unsubEnabled = enabled.subscribe((_enabled) => {
    if (_enabled) {
      if (!unsubSource) {
        unsubSource = source.subscribe(fetch);
      }
    } else {
      unsubSourceAndOnline();
    }
  });

  //
  //

  return output;
}
