import { test, expect } from '@playwright/test';
import { setSignalFactory } from 'signal-factory';
import { atom } from 'signal-factory';
import { glheraClient, storeRequest, testingManager } from '../src';

//
//

test.describe('storeRequest', () => {
  setSignalFactory(atom);

  const source = atom(1);

  const client = glheraClient({
    focusManager: testingManager(true),
    onlineManager: testingManager(true),
  });

  //
  //

  test('When created with enabled false, it should not be peding and not fetch', async () => {
    const store = storeRequest(client, {
      fetcher: async () => ({ name: 'John' }),
      source,
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
    const store = storeRequest(client, {
      fetcher: async () => ({ name: 'John' }),
      enabled: true,
      source,
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
    const store = storeRequest(client, {
      fetcher: async () => ({ name: 'John' }),
      source,
    });

    expect(() => store.data.value).toThrowError('Data not fetched yet');
  });

  //
  //

  test('When is throws, must ajust the signals accordingly', async () => {
    const store = storeRequest(client, {
      fetcher: async () => {
        throw new Error('Error fetching data');
      },
      enabled: true,
      source,
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

    const store = storeRequest(client, {
      fetcher: async () => {
        if (count === 0) {
          count++;
          throw new Error('Error fetching data');
        }
        return { name: 'John' };
      },
      enabled: true,
      source,
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
    const timeSignal = atom(300);

    //
    //

    const store = storeRequest(client, {
      fetcher: async (_, signal) => {
        const waited = timeSignal.value;

        await new Promise((resolve) => setTimeout(resolve, waited));

        if (signal.aborted) {
          aborted = true;
        }
        return { name: 'John', waited };
      },
      enabled: true,
      source,
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
    const _source = atom({ name: 'John' });

    const store = storeRequest(client, {
      fetcher: async (sourceData, signal) => sourceData as any,
      source: _source,
    });

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    _source.value = { name: 'Doe' };

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
    const store = storeRequest(client, {
      fetcher: async () => ++count,
      enabled: true,
      source,
    });

    await Promise.resolve();

    expect(store.lastFetchTime).toBeInstanceOf(Date);
  });

  //
  //

  test('When the initialData is set, it must be success', async () => {
    let count = 1;
    const store = storeRequest(client, {
      fetcher: async () => ++count,
      source,
    });

    store.setInitial({ data: 1 });

    expect(store.data.value).toEqual(1);
    expect(store.lastFetchTime).toBeInstanceOf(Date);
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('When the initialData is set, it must be success and must fetch after enabled', async () => {
    let count = 1;
    const store = storeRequest(client, {
      fetcher: async () => ++count,
      source,
    });

    store.setInitial({ data: 1 });

    expect(store.data.value).toEqual(1);
    expect(store.lastFetchTime).toBeInstanceOf(Date);
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');

    store.enabled.value = true;

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('fetching');

    await Promise.resolve();

    expect(store.data.value).toEqual(2);
    expect(store.lastFetchTime).toBeInstanceOf(Date);
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
  });

  //
  //

  test('When the initialError is set, it must be error', async () => {
    let count = 1;
    const store = storeRequest(client, {
      fetcher: async () => ++count,
      source,
    });

    store.setInitial({ error: 'Some error' });

    expect(store.lastFetchTime).toBeInstanceOf(Date);
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe('Some error');
    expect(store.status.value).toBe('error');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('When the initial.data and initial.error is set, it must show error', async () => {
    let count = 1;
    const store = storeRequest(client, {
      fetcher: async () => ++count,
      source,
    });

    store.setInitial({ data: 1, error: 'Some error' });

    expect(store.data.value).toEqual(1);
    expect(store.lastFetchTime).toBeInstanceOf(Date);
    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe('Some error');
    expect(store.status.value).toBe('error');
    expect(store.fetchStatus.value).toBe('idle');
  });

  //
  //

  test('StoreRequestOptions.compare should avoid fetch', async () => {
    const source = atom({ name: 'John' });

    const store = storeRequest(client, {
      fetcher: async (source) => source,
      source,
      compare: (sourceData) => [sourceData.name],
    });

    //
    //

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    //
    //

    store.enabled.value = true;
    await Promise.resolve();

    //
    //

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');

    //
    //

    source.value = { name: 'John' };

    //
    //

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
    expect(store.data.value).toEqual({ name: 'John' });

    //
    //

    source.value = { name: 'Doe' };

    //
    //

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('fetching');
    expect(store.data.value).toEqual({ name: 'John' });

    //
    //

    await Promise.resolve();

    //
    //

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
    expect(store.data.value).toEqual({ name: 'Doe' });
  });

  //
  //

  test('When online is false, the fetch must be paused', async () => {
    const client = glheraClient({
      focusManager: testingManager(true),
      onlineManager: testingManager(false),
    });

    const source = atom({ name: 'Jhon' });

    const store = storeRequest(client, {
      fetcher: async (source) => source,
      source,
    });

    //
    // Initial state must be idle

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('idle');
    expect(store.fetchStatus.value).toBe('idle');

    store.enabled.value = true;

    //
    // Must be paused

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('paused');
    // Must throw if try to access data
    expect(() => store.data.value).toThrowError('Data not fetched yet');

    //
    // Turn online

    client.onlineManager.value = true;

    expect(store.pending.value).toBe(true);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('pending');
    expect(store.fetchStatus.value).toBe('fetching');
    // Must throw if try to access data
    expect(() => store.data.value).toThrowError('Data not fetched yet');

    //
    // Wait a tick for the fetch promise resolves

    await Promise.resolve();

    //
    // Must be success

    expect(store.pending.value).toBe(false);
    expect(store.error.value).toBe(undefined);
    expect(store.status.value).toBe('success');
    expect(store.fetchStatus.value).toBe('idle');
    expect(store.data.value).toEqual({ name: 'Jhon' });
  });
});
