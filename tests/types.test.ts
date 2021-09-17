import {
  createStore,
  Destroy,
  EqualityChecker,
  PartialState,
  SetState,
  StateListener,
  StateSelector, Store,
  Subscribe,
} from '../src/index'

it('can use exposed types', () => {
  interface ExampleState {
    a: number
    b: number
    c: number
  }

  const listener: StateListener<ExampleState> = (state) => {
    console.log(state.a)
  }

  const selector: StateSelector<ExampleState, number> = (state) => state.a

  const partial: PartialState<ExampleState, 'a' | 'b'> = {
    a: 1,
    b: 2,
  }

  const partialFn: PartialState<ExampleState, 'a' | 'b'> = (state) => ({
    ...state,
    a: 2
  })

  const equalityFn: EqualityChecker<ExampleState> = (state, newState) =>
    state !== newState

  const store = createStore({
    state: {
      a: 1,
      b: 2,
      c: 3
    },
    numGet: () => store.state.a,
    numGetState: () => {
      // TypeScript can't get the type of storeApi when it trys to enforce the signature of numGetState.
      // Need to explicitly state the type of storeApi.getState().num or storeApi type will be type 'any'.
      const result: number = store.state.b
      return result
    },
    numSet: (a: number) => store.set({ a }),
    numSetState: (a: number) => store.set({ a })
  })

  function checkAllTypes(
    _state: ExampleState,
    _partialState: PartialState<ExampleState, 'a' | 'b'>,
    _setState: SetState<ExampleState>,
    _stateListener: StateListener<ExampleState>,
    _stateSelector: StateSelector<ExampleState, number>,
    _store: Store<{ state: ExampleState }>,
    _subscribe: Subscribe<ExampleState>,
    _destroy: Destroy,
    _equalityFn: EqualityChecker<ExampleState>,
  ) {
    expect(true).toBeTruthy()
  }

  checkAllTypes(
    store.state,
    Math.random() > 0.5 ? partial : partialFn,
    store.set,
    listener,
    selector,
    store,
    store.subscribe,
    store.destroy,
    equalityFn,
  )
})

type AssertEqual<Type, Expected> = Type extends Expected
  ? Expected extends Type
    ? true
    : never
  : never

it('should have correct (partial) types for set', () => {
  type Count = { count: number }

  const store = createStore({
    state: {
      count: 0,
    },
    // @ts-expect-error we shouldn't be able to set count to undefined
    a: () => store.set(() => ({ count: undefined })),
    // @ts-expect-error we shouldn't be able to set count to undefined
    b: () => store.set({ count: undefined }),
    c: () => store.set({ count: 1 }),
  })

  const set: AssertEqual<typeof store.set, SetState<Count>> = true
  expect(set).toEqual(true)

  // ok, should not error
  store.set({ count: 1 })
  store.set({})
  store.set(() => undefined)
  store.set((previous) => previous)

  // @ts-expect-error type undefined is not assignable to type number
  store.set({ count: undefined })
  // @ts-expect-error type undefined is not assignable to type number
  store.set((state) => ({ ...state, count: undefined }))
})

it('should allow for different partial keys to be returnable from set', () => {
  type State = { count: number; something: string }

  const store = createStore({
    state: {
      count: 0,
      something: 'foo',
    }
  })

  const set: AssertEqual<typeof store.set, SetState<State>> = true
  expect(set).toEqual(true)

  // ok, should not error
  store.set((previous) => {
    if (previous.count === 0) {
      return { count: 1 }
    }
    return { count: 0 }
  })
  store.set<'count', 'something'>((previous) => {
    if (previous.count === 0) {
      return { count: 1 }
    }
    if (previous.count === 1) {
      return previous
    }
    return { something: 'foo' }
  })

  // @ts-expect-error Type '{ something: boolean; count?: undefined; }' is not assignable to type 'State'.
  store.set<'count', 'something'>((previous) => {
    if (previous.count === 0) {
      return { count: 1 }
    }
    return { something: true }
  })
})
