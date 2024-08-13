import { test, expect } from '@playwright/test';
import { setSignalFactory, storeRequest } from '../src';

//
//

test.describe('storeRequest', () => {
  const signalFactory = <T>(initial: T) => {
    const callbacks = new Set<(value: T) => void>();
    let value = initial;

    const subscribe = (callback: (value: T) => void) => {
      callback(value);
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    };

    return {
      get value() {
        return value;
      },
      set value(newValue) {
        value = newValue;
        for (const callback of callbacks) {
          callback(value);
        }
      },
      subscribe,
    };
  };

  setSignalFactory(signalFactory);

  //
  //

  test('When fetch is successful, must return the data', async () => {
    const store = storeRequest(
      async () => ({ name: 'John' }),
      signalFactory(null),
    );

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    await store.fetch();

    expect(store.data.value).toEqual({ name: 'John' });

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('If try to access data before a fetch, must trow a error', async () => {
    const store = storeRequest(
      async () => ({ name: 'John' }),
      signalFactory(null),
    );

    expect(() => store.data.value).toThrowError('Data not fetched yet');
  });

  //
  //

  test('When is fetching, it must be pending', async () => {
    const store = storeRequest(
      async () => ({ name: 'John' }),
      signalFactory(null),
    );

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    const promise = store.fetch();

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('fetching');

    await promise;
  });

  //
  //

  test('When is throws, must ajust the signals accordingly', async () => {
    const store = storeRequest(async () => {
      throw new Error('Error fetching data');
    }, signalFactory(null));

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    const promise = store.fetch();

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('fetching');

    await promise;

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBeInstanceOf(Error);
    expect(store.status.value).toBe('error');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('When is throws, but tries again must display accordingly', async () => {
    let count = 0;

    const store = storeRequest(async () => {
      if (count === 0) {
        count++;
        throw new Error('Error fetching data');
      }
      return { name: 'John' };
    }, signalFactory(null));

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    const promise = store.fetch();

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('fetching');

    await promise;

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBeInstanceOf(Error);
    expect(store.status.value).toBe('error');
    expect(store.fetchStatus.value).toBe('idle');

    const promise2 = store.fetch();

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBeInstanceOf(Error);
    expect(store.status.value).toBe('error');
    expect(store.fetchStatus.value).toBe('fetching');

    await promise2;

    expect(store.data.value).toEqual({ name: 'John' });
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('Should cancel the fetch accordingly', async () => {
    let aborted = false;
    const timeSignal = signalFactory(300);

    //
    //

    const store = storeRequest(async (signal) => {
      const waited = timeSignal.value;

      await new Promise((resolve) => setTimeout(resolve, waited));

      if (signal.aborted) {
        aborted = true;
      }
      return { name: 'John', waited };
    }, signalFactory(null));

    //
    //

    expect(aborted).toBe(false);

    const promise1 = store.fetch();

    expect(aborted).toBe(false);

    timeSignal.value = 100;

    const promise2 = store.fetch();

    await promise2;

    expect(aborted).toBe(false);

    expect(store.data.value).toEqual({ name: 'John', waited: 100 });

    await promise1;

    expect(aborted).toBe(true);

    expect(store.data.value).toEqual({ name: 'John', waited: 100 });
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('When change the source, it must trigger a fetch', async () => {
    const source = signalFactory({ name: 'John' });

    const store = storeRequest(
      async (signal, sourceData) => sourceData as any,
      source,
    );

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    store.source.value = { name: 'Doe' };

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(null);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('fetching');

    await Promise.resolve();

    expect(store.data.value).toEqual({ name: 'Doe' });
  });
});
