import type { QuerySignal } from './signalFactory';

//
//

export type StoreRequest<T> = {
  data: QuerySignal<T | null>;
  loading: QuerySignal<boolean>;
  error: QuerySignal<any>;
};

//
//

export { setSignalFactory, type QuerySignal } from './signalFactory';
