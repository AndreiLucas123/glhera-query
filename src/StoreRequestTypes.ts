import type { Signal } from 'signal-factory';

//
//

export type InitialStoreRequestData<T> = {
  data?: T;
  error?: any;
};

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
   * - `paused` - The data is not being being fetched because the network (onlineManager) when tried fetch was offline.
   * - `fetching` - The data is being fetched.
   */
  fetchStatus: Signal<'fetching' | 'paused' | 'idle'>;

  /**
   * Method called by `StoreRequest.fetch`
   */
  fetcher: (sourceData: U, signal: AbortSignal) => Promise<T>;

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

  /**
   * Set the initial data or error state.
   *
   * When provided data, it will set the status to 'success'.
   *
   * If both are provided, the error will be used.
   * @param initial Initial data or error state.
   */
  setInitial(initial: InitialStoreRequestData<T>): void;

  /**
   * Will destroy the signals and the fetcher.
   */
  destroy: () => void;
};

//
//

export type StoreRequestOptions<T, U> = {
  /**
   * Method that will fetch the data from the server.
   */
  fetcher: (sourceData: U, signal: AbortSignal) => Promise<T>;

  /**
   * Will compare the sourceData with the previous sourceData.
   *
   * If compare returns a array, it will compare each element of the array with the previous sourceData like useEffect()
   *
   * If the sourceData is different from the previous sourceData, it will fetch the data again.
   */
  compare?: (sourceData: U) => any;

  /**
   * Signal source of the data that will trigger to fetch the data.
   */
  source: Signal<U>;

  /**
   * Initial enabled state.
   * @default false
   */
  enabled?: boolean;
};
