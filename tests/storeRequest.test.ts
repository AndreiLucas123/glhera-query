import { test, expect } from '@playwright/test';
import { setSignalFactory } from 'signal-factory';
import { signal } from 'signal-factory/vanilla';
import { storeRequest } from '../src';

//
//

test.describe('storeRequest', () => {
  setSignalFactory(signal);

  //
  //

  test('When created with enabled false, it should not be peding and not fetch', async () => {
    const store = storeRequest({
      fetcher: async () => ({ name: 'John' }),
    });

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    await store.fetch();

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('When enabled is true, should fetch immediately', async () => {
    const store = storeRequest({
      fetcher: async () => ({ name: 'John' }),
      enabled: true,
      source: 1,
    });

    expect(store.enabled.value).toBe(true);
    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('fetching');
  });

  //
  //

  test('If try to access data before a fetch, must trow a error', async () => {
    const store = storeRequest(async () => ({ name: 'John' }));

    expect(() => store.data.value).toThrowError('Data not fetched yet');
  });

  //
  //

  test('When is throws, must ajust the signals accordingly', async () => {
    const store = storeRequest({
      fetcher: async () => {
        throw new Error('Error fetching data');
      },
      enabled: true,
    });
    -expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('fetching');

    await Promise.resolve();

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBeInstanceOf(Error);
    expect(store.status.value).toBe('error');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('When is throws, but tries again must display accordingly', async () => {
    let count = 0;

    const store = storeRequest({
      fetcher: async () => {
        if (count === 0) {
          count++;
          throw new Error('Error fetching data');
        }
        return { name: 'John' };
      },
      enabled: true,
    });

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('fetching');

    await Promise.resolve();

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBeInstanceOf(Error);
    expect(store.status.value).toBe('error');
    expect(store.fetchStatus.value).toBe('idle');

    const promise1 = store.fetch();

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBeInstanceOf(Error);
    expect(store.status.value).toBe('error');
    expect(store.fetchStatus.value).toBe('fetching');

    await promise1;

    expect(store.data.value).toEqual({ name: 'John' });
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('Should cancel the fetch accordingly', async () => {
    let aborted = false;
    const timeSignal = signal(300);

    //
    //

    const store = storeRequest({
      fetcher: async (signal) => {
        const waited = timeSignal.value;

        await new Promise((resolve) => setTimeout(resolve, waited));

        if (signal.aborted) {
          aborted = true;
        }
        return { name: 'John', waited };
      },
      enabled: true,
    });

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
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('When change the source, it must trigger a fetch', async () => {
    const store = storeRequest(async (signal, sourceData) => sourceData as any);

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    store.source.value = { name: 'Doe' };

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    store.enabled.value = true;

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('fetching');

    await Promise.resolve();

    expect(store.data.value).toEqual({ name: 'Doe' });
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('The fetch date must be set', async () => {
    let count = 0;
    const store = storeRequest({ fetcher: async () => ++count, enabled: true });

    await Promise.resolve();

    expect(store.lastFetchTime).toBeInstanceOf(Date);
  });

  //
  //

  test('When the initialData is set, it must be success', async () => {
    let count = 1;
    const store = storeRequest({
      fetcher: async () => ++count,
      enabled: true,
      data: 1,
    });

    expect(store.data.value).toEqual(1);
    expect(store.lastFetchTime).toBeInstanceOf(Date);
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('When the initialError is set, it must be error', async () => {
    let count = 1;
    const store = storeRequest({
      fetcher: async () => ++count,
      source: 1,
      error: 'Some error',
    });

    expect(store.lastFetchTime).toBeInstanceOf(Date);
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe('Some error');
    expect(store.status.value).toBe('error');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('When the initialData and initialError is set, it must throws', async () => {
    let count = 1;

    expect(() => {
      const store = storeRequest({
        fetcher: async () => ++count,
        source: 1,
        data: 1,
        error: 'Some error',
      });
    }).toThrowError('data and error cannot be defined at the same time');
  });
});
