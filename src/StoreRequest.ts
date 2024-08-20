import { signalFactory } from 'signal-factory';
import {
  StoreRequest,
  StoreRequestOptions,
  StoreRequestState,
} from './StoreRequestTypes';
import { GLHeraClient } from './glheraClient';

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
  let unsubOnline: (() => void) | null = null;

  //
  //

  const { focusManager, onlineManager } = client;

  //
  //

  let _internalState: StoreRequestState<T> = {
    enabled: opts.enabled ?? false,
    lastFetchTime: new Date(0),
    pending: false,
    status: 'idle',
    fetchStatus: 'idle',
  };

  //
  //

  const state = signalFactory<StoreRequestState<T>>(_internalState);

  const set = state.set;
  // @ts-ignore
  delete state.set;

  //
  //

  let lastAbortController: AbortController | null = null;

  //
  //

  async function fetch(): Promise<void> {
    if (!_internalState.enabled) {
      return;
    }

    if (compare) {
      const compared = compare(source.get());
      if (Object.is(compared, lastCompared)) {
        return;
      }

      if (Array.isArray(compared) && Array.isArray(lastCompared)) {
        if (compared.length === lastCompared.length) {
          if (compared.every((v, i) => Object.is(v, lastCompared[i]))) {
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

  function updateState(newState: Partial<StoreRequestState<T>>) {
    _internalState = {
      ..._internalState,
      ...newState,
    };
    set(_internalState);
  }

  //
  //

  /** Does the fatch, but will not compare or check if is enabled */
  async function internalFetch() {
    if (onlineManager.get() === false) {
      updateState({
        fetchStatus: 'paused',
        pending: true,
        status: 'pending',
      });

      unsubOnline = onlineManager.subscribe((online) => {
        if (online) {
          unsubOnline!();
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

    updateState({
      status:
        _internalState.status === 'idle' ? 'pending' : _internalState.status,
      fetchStatus: 'fetching',
      pending: true,
      lastFetchTime: new Date(),
    });

    try {
      const dataFetched = await fetcher(source.get(), abortController.signal);

      if (abortController !== lastAbortController) {
        return;
      }

      updateState({
        data: dataFetched,
        status: 'success',
        fetchStatus: 'idle',
        pending: false,
        error: undefined,
      });
    } catch (err) {
      if (abortController !== lastAbortController) {
        return;
      }

      updateState({
        error: err,
        status: 'error',
        fetchStatus: 'idle',
        pending: false,
      });
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
    lastAbortController?.abort();
    lastAbortController = null;
    fetcher = null!;

    unsubSourceAndOnline();
  }

  //
  //

  function setInitial(initial: { data?: T; error?: any }) {
    updateState({
      lastFetchTime: new Date(),
    });

    if (initial.data !== undefined) {
      updateState({
        data: initial.data,
        status: 'success',
      });
    }

    if (initial.error !== undefined) {
      updateState({
        error: initial.error,
        status: 'error',
      });
    }
  }

  //
  //

  const output: StoreRequest<T, U> = {
    get: state.get,
    subscribe: state.subscribe,
    fetch,
    fetcher,
    setInitial,
    enable(value) {
      if (_internalState.enabled === value) {
        return;
      }

      updateState({
        enabled: value,
      });

      if (value) {
        fetch();
      }
    },
    destroy,
  };

  //
  //

  unsubSource = source.subscribe(() => {
    if (_internalState.enabled) {
      fetch();
    }
  });

  //
  //

  return output;
}
