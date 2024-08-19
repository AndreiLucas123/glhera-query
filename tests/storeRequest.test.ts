import { test, expect } from '@playwright/test';
import { setSignalFactory } from 'signal-factory';
import { atom } from 'signal-factory';
import { glheraClient, storeRequest, testingManager } from '../src';
import type { StoreRequestState } from '../src/StoreRequestTypes';

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

  function expectState(store: any, state: StoreRequestState<any>) {
    const current = store.get();

    delete current.lastFetchTime;
    delete state.lastFetchTime;

    if (current.error) {
      if (current.error instanceof Error) {
        current.error = current.error.message;
      }
    }

    expect(store.get()).toEqual(state);
  }

  //
  //

  test('When created with enabled false, it should not be peding and not fetch', async () => {
    const store = storeRequest(client, {
      fetcher: async () => ({ name: 'John' }),
      source,
    });

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'idle',
      fetchStatus: 'idle',
    });

    await store.fetch();

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'idle',
      fetchStatus: 'idle',
    });
  });

  //
  //

  test('When enabled is true, should fetch immediately', async () => {
    const store = storeRequest(client, {
      fetcher: async () => ({ name: 'John' }),
      enabled: true,
      source,
    });

    expectState(store, {
      enabled: true,
      pending: true,
      status: 'pending',
      fetchStatus: 'fetching',
    });
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

    expectState(store, {
      enabled: true,
      pending: true,
      status: 'pending',
      fetchStatus: 'fetching',
    });

    await Promise.resolve();

    expectState(store, {
      enabled: true,
      pending: false,
      status: 'error',
      error: 'Error fetching data',
      fetchStatus: 'idle',
    });
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

    expectState(store, {
      enabled: true,
      pending: true,
      status: 'pending',
      fetchStatus: 'fetching',
    });

    await Promise.resolve();

    expectState(store, {
      enabled: true,
      pending: false,
      status: 'error',
      error: 'Error fetching data',
      fetchStatus: 'idle',
    });

    const promise1 = store.fetch();

    expectState(store, {
      enabled: true,
      pending: true,
      status: 'error',
      error: 'Error fetching data',
      fetchStatus: 'fetching',
    });

    await promise1;

    expectState(store, {
      enabled: true,
      pending: false,
      error: undefined,
      status: 'success',
      fetchStatus: 'idle',
      data: {
        name: 'John',
      },
    });
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
        const waited = timeSignal.get();

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

    timeSignal.set(100);

    const promise2 = store.fetch();

    await promise2;

    expect(aborted).toBe(false);

    expect(store.get().data).toEqual({ name: 'John', waited: 100 });

    await promise1;

    expect(aborted).toBe(true);

    expectState(store, {
      enabled: true,
      pending: false,
      status: 'success',
      fetchStatus: 'idle',
      data: { name: 'John', waited: 100 },
    });
  });

  //
  //

  test('When change the source, it must not trigger a fetch unless enabled', async () => {
    const _source = atom({ name: 'John' });

    const store = storeRequest(client, {
      fetcher: async (sourceData, signal) => sourceData as any,
      source: _source,
    });

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'idle',
      fetchStatus: 'idle',
    });

    _source.set({ name: 'Doe' });

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'idle',
      fetchStatus: 'idle',
    });

    store.enable(true);

    expectState(store, {
      enabled: true,
      pending: true,
      status: 'pending',
      fetchStatus: 'fetching',
    });

    await Promise.resolve();

    expectState(store, {
      enabled: true,
      pending: false,
      status: 'success',
      fetchStatus: 'idle',
      data: { name: 'Doe' },
    });
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

    expect(store.get().lastFetchTime).toBeInstanceOf(Date);
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

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'success',
      fetchStatus: 'idle',
      data: 1,
    });
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

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'success',
      fetchStatus: 'idle',
      data: 1,
    });

    store.enable(true);

    expectState(store, {
      enabled: true,
      pending: true,
      status: 'success',
      fetchStatus: 'fetching',
      data: 1,
    });

    await Promise.resolve();

    expectState(store, {
      enabled: true,
      pending: false,
      status: 'success',
      fetchStatus: 'idle',
      data: 2,
    });
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

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'error',
      fetchStatus: 'idle',
      error: 'Some error',
    });
  });

  //
  //

  test('When the initial.data and initial.error is set, it must show both', async () => {
    let count = 1;
    const store = storeRequest(client, {
      fetcher: async () => ++count,
      source,
    });

    store.setInitial({ data: 1, error: 'Some error' });

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'error',
      fetchStatus: 'idle',
      data: 1,
      error: 'Some error',
    });
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

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'idle',
      fetchStatus: 'idle',
    });

    //
    //

    store.enable(true);
    await Promise.resolve();

    //
    //

    expectState(store, {
      data: { name: 'John' },
      enabled: true,
      pending: false,
      status: 'success',
      error: undefined,
      fetchStatus: 'idle',
    });

    //
    //

    source.set({ name: 'John' });

    //
    //

    expectState(store, {
      enabled: true,
      pending: false,
      status: 'success',
      fetchStatus: 'idle',
      data: { name: 'John' },
    });

    //
    //

    source.set({ name: 'Doe' });

    //
    //

    expectState(store, {
      data: { name: 'John' },
      enabled: true,
      pending: true,
      error: undefined,
      status: 'success',
      fetchStatus: 'fetching',
    });

    //
    //

    await Promise.resolve();

    //
    //

    expectState(store, {
      enabled: true,
      pending: false,
      status: 'success',
      fetchStatus: 'idle',
      data: { name: 'Doe' },
    });
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

    expectState(store, {
      enabled: false,
      pending: false,
      status: 'idle',
      fetchStatus: 'idle',
    });

    store.enable(true);

    //
    // Must be paused

    expectState(store, {
      enabled: true,
      pending: true,
      status: 'pending',
      fetchStatus: 'paused',
    });

    //
    // Turn online

    // @ts-ignore Testing has set
    client.onlineManager.set(true);

    expectState(store, {
      enabled: true,
      pending: true,
      status: 'pending',
      fetchStatus: 'fetching',
    });

    //
    // Wait a tick for the fetch promise resolves

    await Promise.resolve();

    //
    // Must be success

    expectState(store, {
      enabled: true,
      pending: false,
      status: 'success',
      fetchStatus: 'idle',
      data: { name: 'Jhon' },
    });
  });
});
