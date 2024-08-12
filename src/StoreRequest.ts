import { QuerySignal } from './signalFactory';

//
//

export type StoreRequest<T> = {
  /**
   * Signal that indicates the data fetched from the server.
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
   * Method called by `StoreRequest.fetch`
   */
  fetcher: () => Promise<T>;

  /**
   * Will cancel the current fetch request if it is pending.
   *
   * Then it will fetch the data again and update the signals.
   */
  fetch: () => Promise<T>;

  /**
   * Data from the last fetch that executed
   */
  lastFetchTime?: Date;
};
