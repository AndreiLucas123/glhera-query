import { signalFactory } from 'signal-factory';

/**
 * A manager that handles the focus and online state of the browser.
 */
export type Manager = {
  /**
   * The current value of the signal.
   */
  value: boolean;
  /**
   * Subscribes to the signal.
   * @returns A function to unsubscribe from the signal.
   */
  subscribe: (callback: (value: boolean) => void) => () => void;
  /**
   * Listens to changes in the signal.
   * @returns A function to stop listening to changes.
   */
  listen: () => () => void;
};

/**
 * Manages the focus state of the browser.
 */
export function focusManager(): Manager {
  const getVisibilityState = () =>
    globalThis.document?.visibilityState !== 'hidden';

  //
  //

  const isFocused = signalFactory<boolean>(getVisibilityState());

  //
  //

  return {
    get value() {
      return isFocused.value;
    },
    subscribe: isFocused.subscribe,
    listen() {
      const listener = () => (isFocused.value = getVisibilityState());

      window.addEventListener('visibilitychange', listener, false);
      return () => window.removeEventListener('visibilitychange', listener);
    },
  };
}

/**
 * Manages the online/offline state of the browser.
 */
export function onlineManager(): Manager {
  const isOnline = signalFactory<boolean>(navigator.onLine);

  //
  //

  return {
    get value() {
      return isOnline.value;
    },
    subscribe: isOnline.subscribe,
    listen() {
      const listenerOn = () => (isOnline.value = true);

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
export function testingManager(initial: boolean): Manager {
  const signal = signalFactory<boolean>(initial);

  //
  //

  return {
    get value() {
      return signal.value;
    },
    subscribe: signal.subscribe,
    listen() {
      return () => {};
    },
  };
}
