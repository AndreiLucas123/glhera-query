import { test, expect } from '@playwright/test';
import { setSignalFactory, storeRequest } from '../src';

//
//

test.describe('storeRequest', () => {
  const signalFactory = (initial: any) => {
    return {
      value: initial,
    };
  };
  setSignalFactory(signalFactory);

  //
  //

  test('When fetch is successful, must return the data', async () => {
    const store = storeRequest(async () => ({ name: 'John' }));

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
    const store = storeRequest(async () => ({ name: 'John' }));

    expect(() => store.data.value).toThrowError('Data not fetched yet');
  });
});
