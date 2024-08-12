//
//

export type QuerySignal<T = any> = {
  value: T;
};

//
//

export let signalFactory: (initial: any) => QuerySignal = () => {
  throw new Error('Signal factory not set');
};

//
//

export function setSignalFactory(factory: (initial: any) => QuerySignal) {
  signalFactory = factory;
}
