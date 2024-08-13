# glhera-query

**glhera-query** é uma biblioteca frontend para sincronizar data de fetch como do [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) mais conhecido como **React Query**

A diferença entre o **glhera-query** e o **TanStack Query** é que o **glhera-query** é **signal based** e não faz cache por padrão (somente em queries infinitas) e o cache para queries infinitas é diferente

Por conta de ser **signal based** e não fazer cache o **glhera-query** pode ser extremamente simples e mais fácil de usar do que o **TanStack Query**

Para entender o porquê não fazer cache torna mais fácil de usar é só entender que no **TanStack Query** ele precisa de [keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), essas chaves são necessárias para fazer cache, quando não se depende de `cache`, uma grande complexidade da aplicação é removida, tornando tudo mais fácil e simples de se usar

## Diferenças do **TanStack Query**

- Só faz cache para **queries infinitas** com **key based** como no **TanStack Query**
- O mecanismo de resincronização (stale queries, windows focus refetching) das queries não é automatico, ele deve ser configurado por query

### Recursos do **TanStack Query** considerados desnecessários para o **glhera-query**

Pode ser **legal** ter um recurso adicional, mas requer `bundle` e custa recursos, especialmente se não usado

> Notas: Não consideramos que esses recursos sejam desnecessários para todas as aplicações, alguns dos recursos do **TanStack Query** podem ser cruciais dependendo da aplicação que está sendo feita

- Não precisa de uma query ser `enabled`, pois o `fetch` é chamado **manualmente** ou **sincronizado**
- `prefetching`
- `mutations`
- cache com keys

Por conta dessas diferenças, para que um app usando **glhera-query** faça grande parte do que um app com o **TanStack Query** (desconsiderando cache) é muito mais simples e depende de menos bundle

## Recursos sendo implementados

- [x] Cancellable fetch (Abort Signal)
- [ ] Refetch stale. Copiar o [onlineManager](https://tanstack.com/query/latest/docs/reference/onlineManager)?
- [ ] Infinite Queries
- [ ] Scroll Restoration? (Is needed?)
- [ ] [Retry](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries)
- [ ] [Window Focus Refetching](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching) Copiar o [focusManager](https://tanstack.com/query/latest/docs/reference/focusManager)?

### Configurando reatividade (signals)

Possui o método `setSignalFactory` para configurar o tipo de signal que será usado pela aplicação, podendo variar entre `Vue`, `Angular`, `SolidJS`, `PreactJS Signals`

```ts
//
// Preact Signals: mais simples de todos, de onde a api foi inspirada
setSignalFactory(signal);

//
// Vue: adiciona o método subscribe ao ref criado com watch
setSignalFactory((initial) => {
  const signal = ref(initial);

  signal.subscribe = (cb: (newVal) => void) => {
    cb(signal.value);
    return watch(signal, cb);
  };

  return signal;
});

//
// Svelte: você pode usar o factory abaixo

const signal = <T>(initial: T) => {
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

// Depois só definir setSignalFactory
setSignalFactory(signal);

//
// Solid: cria um wrapper com createRoot e createEffect
setSignalFactory((initial) => {
  const [value, setValue] = createSignal(initial);

  return {
    get value() {
      return value();
    },
    set value(newValue) {
      setValue(newValue);
    },

    subscribe(callback: (value) => void) {
      let dispose;
      createRoot((disposer) => {
        dispose = disposer;
        createEffect(() => callback(value()));
      });
      return dispose;
    },
  };
});
```

### Angular signals

Você não pode usar com angular signals porque não é possível se subscrever a um signal como nos outros frameworks, para se inscrever precisa do `effect` que precisa do [`injector`](https://angular.dev/guide/signals#injection-context), como `setSignalFactory` não pode acessar o `injector` acaba não sendo possível usar **Angular Signals**

### React

React não tem suporte nativo para signals, porém é possível usar [@preact/signals-react](https://www.npmjs.com/package/@preact/signals-react)
