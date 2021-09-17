import {
  createStore,
  Destroy,
  EqualityChecker,
  PartialState, PickData,
  SetState,
  StateListener,
  StateSelector, Store,
  StoreApi,
  Subscribe,
} from '../src/index'

it('can use exposed types', () => {
  interface ExampleState {
    num: number
    numGet: () => number
    numGetState: () => number
    numSet: (v: number) => void
    numSetState: (v: number) => void
  }

  const listener: StateListener<ExampleState> = (state) => {
    console.log(state.num)
  }

  const selector: StateSelector<ExampleState, number> = (state) => state.num

  const partial: PartialState<ExampleState, 'num' | 'numGet'> = {
    num: 2,
    numGet: () => 2,
  }

  const partialFn: PartialState<ExampleState, 'num' | 'numGet'> = (state) => ({
    ...state,
    num: 2,
  })

  const equalityFn: EqualityChecker<ExampleState> = (state, newState) =>
    state !== newState

  const store: Store<ExampleState> = createStore({
    num: 1,
    numGet: () => store.state.num,
    numGetState: () => {
      // TypeScript can't get the type of storeApi when it trys to enforce the signature of numGetState.
      // Need to explicitly state the type of storeApi.getState().num or storeApi type will be type 'any'.
      const result: number = store.state.num
      return result
    },
    numSet: (v) => {
      store.set({ num: v })
    },
    numSetState: (v) => {
      store.set({ num: v })
    },
  })

  function checkAllTypes(
    _state: PickData<ExampleState>,
    _partialState: PartialState<ExampleState, 'num' | 'numGet'>,
    _setState: SetState<PickData<ExampleState>>,
    _stateListener: StateListener<ExampleState>,
    _stateSelector: StateSelector<ExampleState, number>,
    _store: Store<ExampleState>,
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
    count: 0,
    // @ts-expect-error we shouldn't be able to set count to undefined
    a: () => store.set(() => ({ count: undefined })),
    // @ts-expect-error we shouldn't be able to set count to undefined
    b: () => store.set({ count: undefined }),
    c: () => store.set({ count: 1 }),
  })

  const set: AssertEqual<typeof store.set, SetState<PickData<Count>>> = true
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
    count: 0,
    something: 'foo',
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
