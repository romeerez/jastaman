# Jastaman

Just another state manager for React

Main goal is to create as concise library as possible

Inspired by [Zustand](https://github.com/pmndrs/zustand) and has similar API.
Jastaman passes the same tests, has the same possibilities except middleware yet, performs faster.

## Table of Contents
* [Basic usage](#basic-usage)
* [API overview](#api-overview)
  - [Create store](#create-store)
    * [Simply create](#simply-create)
    * [useCreateStore hook](#usecreatestore-hook)
    * [Placing store in react context](#placing-store-in-react-context)
  - [Computed fields](#computed-derived-fields)
  - [Store instance API](#store-instance-api)
    * [store.use](#storeuse)
    * [store.state](#storestate)
    * [store.prevState](#storeprevstate)
    * [store.set](#storeset)
    * [store.replace](#storereplace)
    * [store.subscribe](#storesubscribe)
    * [store.destroy](#storedestroy)
    * [store.useEffect](#storeuseeffect)
- [Middleware: immer, persist](#middleware)
- [Performance](#performance)

## Basic usage

Defining a store looks similar to Zustand, with few differences:
* state of the store is separated into `state`
* to mutate store state use `set` function from store instance
* current state of the store is accessible by `store.state`

In this way typescript can infer state type so it can be used in store methods, while in Zustand it is required to define type for the store explicitly.

State passed to the `set` function is partial object as well as in Zustand.

```ts
import { createStore } from 'jastaman'

export const store = createStore({
  state: {
    penguins: 0,
    lamas: 0,
    parrots: 0,
  },
  addPenguin: () => store.set(state => ({ penguins: state.penguins + 1 })),
  addLama: () => store.set({ penguins: 0 }),
  hasPenguins: () => store.state.penguins.length > 0
})
```

Use store in component:

```tsx
import store from './store-from-above'

function Animals() {
  // get value just like in other state managers
  const penguins1 = store.use(state => state.penguins)
  
  // short syntax for one value (TypeScript knows the type)
  const penguins2 = store.use('penguins')
  
  // get multiple values at once (TypeScript is fine here as well)
  const { penguins, lamas, parrots } = store.use('penguins', 'lamas', 'parrots')
  
  return <h1>{penguins} penguins, {lamas} lamas and {parrots} parrots</h1>
}

function Controls() {
  // no need to use hooks to get store methods as we know they won't ever change
  return (
    <>
      <button onClick={store.addPenguin}>add penguin</button>
      <button onClick={store.addLama}>add lama</button>
    </>
  )
}
```

## Api Overview

### Create store

#### Simply create

Store can be created into a variable, it can be exported and imported across the project.

This is not recommended if you have plans for server rendering, because single store in this case will be used for different requests

```tsx
import { createStore } from 'jastaman'

const store = createStore({
  state: {
    count: 123,
  },
  increment: () => store.set(state => ({ count: count + 1 }))
})

function Component() {
  const count = store.use('count')
  
  return (
    <div>
      count: {count}
      <button onClick={store.increment}>+</button>
    </div>
  )
}
```

TypeScript store type can be set explicitly, otherwise it will be inferred:

```ts
import { createStore } from 'jastaman'

type CounterStore = {
  state: {
    count: number
  },
  increment(): void
}

const store = createStore<CounterStore>({
  state: {
    count: 123,
  },
  increment: () => store.set(state => ({ count: count + 1 }))
})
```

#### useCreateStore hook

This hook can be used, for example, when you want to put multiple stores into one React Context.

In such case, top component will create multiple stores with hooks and put them into single context.

```ts
import { useCreateStore } from 'jastaman'

function Component() {
  const store = useCreateStore(() => ({
    state: {
      value: 123
    }
  }))
  
  const value = store.use('value')
  // ...
}
```

`useCreateStore` is a shortcut for `useMemo`, above example is the same as:
```tsx
import { createStore } from 'jastaman'
import { useMemo } from 'react'

function Component() {
  const store = useMemo(() => {
    return createStore({
      state: {
        value: 123
      }
    })
  }, [])
  
  const value = store.use('value')
  // ...
}
```

`useCreateStore` optionally accepts option `setOnChange`

`setOnChange` can be used to set state from outside of the store to the state.

For example, here react-query result is saved to the store and keeps it updated.
```ts
import { useCreateStore } from 'jastaman'
import { useQuery } from 'react-query'

function Component() {
  const { data, isLoading, error } = useQuery('key', () =>
    fetch('...')
  )
  
  const store = useCreateStore(() => ({
    state: {
      data,
      isLoading,
      error,
    }
  }), {
    setOnChange: { data, isLoading, error }
  })
}
```

#### Placing store in React Context

```tsx
import { createContext, createStore } from 'jastaman'

const { Provider: MyStoreProvider, useStore: useMyStore } = createContext(
  // callback is accepting inital data and returns the store
  ({ one, two }: { one: number; two: number }) =>
    createStore({
      state: {
        one,
        two,
      }
    })
)

const TopLevelComponent = () => {
  return (
    // Provider is accepting inital data as props
    <MyStoreProvider one={1} two={2}>
      <Component />
    </MyStoreProvider>
  )
}

const Component = () => {
  const store = useMyStore()
  const { one, two } = store.use('one', 'two')
  // ...
}
```

### Computed (derived) fields

Computed fields are for the case when some state can be calculated from another state.

Especially it is useful when complex calculation is required, consuming CPU and time.

In this example imagine we have a data tree and we need to calculate statistics for it:

```ts
import { createStore, computed } from 'jastaman'

const store = createStore({
  state: {
    largeAndDeepDataTree: [{ ... }, { ... }],
    someProperty: 123,
    
    // define a computed field in this way
    // only for TypeScript
    // and only if store type is not provided explicitly
    statistics: computed<number>(),
  },
  computed: {
    statistics: [
      // first function is a selector - return array of fields which calculation depends on
      (state) => [state.largeAndDeepDataTree],
      // second function is to calculate the value
      (state) => calculateStatistics(state.largeAndDeepDataTree)
    ]
  },
})

const ShowStatistics = () => {
  const statistics = store.use('statistics')
  
  const updateData = (someData) => {
    // After setting data statistics will be recalculated
    // component will re-render with new statistics
    store.set({ largeAndDeepDataTree: someData })
  }
  
  const updateSomeProperty = (value) => {
    // This property is not selected by computed field, so this won't trigger recalculation
    // component will not re-render
    store.set({ someProperty: value })
  }
  
  // show statistics
}
```

### Store instance API

#### store.use

When it is used with function it can accept up to 3 arguments:

```ts
store.use(selector, deps, equalityFn)
```

Outside variables should be listed in deps, example:

```ts
import { createStore } from 'jastaman'

const store = createStore({
  state: {
    items: {
      1: { title: 'one' },
      2: { title: 'two' },
    }
  }
})

const Component = ({ id }: { id: number }) => {
  // id is outside variable for selector and should be listed in array after selector
  const item = store.use(state => state.items[id], [id])
}
```

Third argument is to check if selected value was changed, by default it is `Object.is`.

Use it to return array or object from `use`:

```tsx
import { shallowEqual } from 'jastaman'

const Component = ({ id }: { id: number }) => {
  // return array
  const [a, b, c] = store.use(state => [state.a, state.b, state.c], [], shallowEqual)
  
  // return object
  const { a, b, c } = store.use(state => ({ a: state.a, b: state.b, c: state.c }), [], shallowEqual)
}
```

You can pass state key or multiple keys instead of selector:

```ts
import { createStore } from 'jastaman'

const store = createStore({
  state: {
    a: 1,
    b: 2,
    c: 3,
  }
})

const Component = ({ id }: { id: number }) => {
  // single value
  const a = store.use('a')
  
  // multiple values
  const { a, b, c } = store.use('a', 'b', 'c')
}
```

#### store.state

Current state of the store

Variable reference remains the same after `set` or `replace`:
```ts
import { createStore } from 'jastaman'

const store = createStore({
  state: {
    a: 1
  }
})

const state = store.state
store.set({ a: 2 })

state.a === 2 // state was mutated
state === store.state // reference remains the same
```

#### store.prevState

When store is initialized prevState === state, and then it is updated before `set` or `replace`

#### store.set

Assign new data to the store state

```ts
const store = createStore({
  state: {
    a: 1,
    b: 2,
    data: [] as number[],
  }
})

// { a: 2 } gets merged into state
store.set({ a: 2 })

store.state.a === 2
store.state.b === 2

// accepts callback
store.set((state) => ({ data: [ ...state.data, 1 ] }))

// above is just the same as:
store.set(() => ({ data: [ ...store.state.data, 1 ] }))
```

#### store.replace

Replace state instead of merging, accepts object or callback like `set`

```ts
const store = createStore({
  state: {
    a: 1,
    b: 2 as number | undefined, // mark the field as optional
  }
})

store.replace({ a: 2 })
store.state.b === undefined // b is gone
```

#### store.subscribe

Subscribe to store updates

With 1 argument invokes listener on any change
prevState === state if there were no updates yet

```ts
store.subscribe((state, prevState) => {})
```

With 2 arguments `subscribe` invokes listener only when selected values change

listener receives selected slice, not whole state, in this case single value
```ts
const selector = (state) => state.foo
store.subscribe(selector, (slice, prevSlice) => {})
```

With 3 arguments first is selector, second is equality function and third is listener

By default equality function is `Object.is`, which is almost identical to `===`

```ts
import { shallowEqual } from 'jastaman'

store.subscribe(selector, shallowEqual, (slice, prevSlice) => {})
```

#### store.destroy

Remove all event listeners of the store

#### store.useEffect

It is a React hook, accepts the same arguments as `store.subscribe` + optional dependencies array

It can be used if you want to update state of one store based on state of another store

```ts
import { useCreateStore } from 'jastaman'
import { shallowEqual } from 'jastaman'

const Component = () => {
  const store = useCreateStore(() => ({
    state: {
      a: 1,
      b: 2,
      c: 3
    }
  }))
  
  store.useEffect(
    (state) => [state.a, state.b],
    shallowEqual,
    (slice, prevSlice) => {
      console.log('a or b changed!')
      console.log(`new values: [${slice.a}, ${slice.b}]`)
      console.log(`previous values: [${prevSlice.a}, ${prevSlice.b}]`)
    }
  )
}
```

## Middleware

Not implemented yet

## Performance

In Zustand it is recommended to memoize selectors with `useCallback`

```js
const fruit = useStore(useCallback(state => state.fruits[id], [id]))
```

But in Jastaman `useCallback` around selector won't have any effect, still you need to pass array of dependencies if selector depends on outside variable:

```js
const fruit = store.use(state => state.fruits[id], [id])
```

Without outside variables no need to provide array:

```js
const fruit = store.use(state => state.fruit)
```

Benchmark results on my machine for [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark):

(source and results are not published yet)

<p align="center">
  <img src="bench-results.png" />
</p>
