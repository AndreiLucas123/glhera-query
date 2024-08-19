import { ReadableSignal, signalFactory } from 'signal-factory';

/**
 * A manager that handles the focus and online state of the browser.
 */
export interface GLHeraManager extends ReadableSignal<boolean> {
  /**
   * Listens to changes in the signal.
   * @returns A function to stop listening to changes.
   */
  listen: () => () => void;
}

/**
 * Manages the focus state of the browser.
 */
export function focusManager(): GLHeraManager {
  const getVisibilityState = () =>
    globalThis.document?.visibilityState !== 'hidden';

  //
  //

  const isFocused = signalFactory<boolean>(getVisibilityState());

  //
  //

  return {
    get() {
      return isFocused.get();
    },
    subscribe: isFocused.subscribe,
    listen() {
      const listener = () => isFocused.set(getVisibilityState());

      window.addEventListener('visibilitychange', listener, false);
      return () => window.removeEventListener('visibilitychange', listener);
    },
  };
}

/**
 * Manages the online/offline state of the browser.
 */
export function onlineManager(): GLHeraManager {
  const isOnline = signalFactory<boolean>(navigator.onLine);

  //
  //

  return {
    get() {
      return isOnline.get();
    },
    subscribe: isOnline.subscribe,
    listen() {
      const listenerOn = () => isOnline.set(true);

      window.addEventListener('online', listenerOn, false);
      window.addEventListener('offline', listenerOn, false);
      return () => {
        window.removeEventListener('online', listenerOn);
        window.removeEventListener('offline', listenerOn);
      };
    },
  };
}

/**
 * Creates a manager to replace `focusManager` and `onlineManager` in tests or when the browser does not support them.
 * @param initial - The initial value of the signal.
 * @returns A manager that always returns the initial value.
 */
export function testingManager(initial: boolean): GLHeraManager {
  const signal = signalFactory<boolean>(initial);

  //
  // @ts-ignore
  signal.listen = () => () => {};

  //
  //

  return signal as any;
}
