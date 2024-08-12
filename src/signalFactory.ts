//
//

export type QuerySignal<T = any> = {
  value: T;
};

//
//

export let signalFactory: <T>(initial: any) => QuerySignal<T> = () => {
  throw new Error('Signal factory not set');
};

//
//

export function setSignalFactory(factory: (initial: any) => QuerySignal): void {
  signalFactory = factory;
}
