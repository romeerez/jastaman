import shallowEqual from './shallow'
import {
  Destroy,
  EqualityChecker,
  Params,
  ReplaceState,
  SetState,
  StateListener,
  StateSelector,
  StateSliceListener,
  StoreApi,
  StoreCreator,
} from './types'

export const computed = <T>(): T => {
  return undefined as unknown as T
}

export const createStore = <
  T extends StoreCreator,
  State extends T['state'] = T['state']
>(
  params: Params<T, State>
): StoreApi<T, State> => {
  const state: State = { ...params.state }
  const listeners: Set<StateListener<State>> = new Set()

  const set: SetState<State> = (newState) => {
    if (typeof newState === 'function') newState = newState(state)

    store.prevState = { ...state }
    Object.assign(state, newState)
    listeners.forEach((listener) => listener(state, store.prevState))
  }

  const replace: ReplaceState<State> = (newState) => {
    if (typeof newState === 'function') newState = newState(state)

    for (const key in state) {
      delete state[key]
    }

    set(newState)
  }

  const subscribeWithSelector = <U>(
    selector: StateSelector<State, U>,
    equalityFn: EqualityChecker<U>,
    listener: StateSliceListener<U>
  ) => {
    let currentSlice = selector(state)
    const listenerToAdd = () => {
      const nextSlice = selector(state)
      if (!equalityFn(currentSlice, nextSlice)) {
        const previousSlice = currentSlice
        listener((currentSlice = nextSlice), previousSlice)
      }
    }

    listeners.add(listenerToAdd)
    return () => listeners.delete(listenerToAdd)
  }

  const subscribe = <U>(
    listenerOrSelector: StateListener<State> | StateSelector<State, U>,
    listenerOrEqualityFn?:
      | StateListener<State>
      | StateSliceListener<U>
      | EqualityChecker<U>,
    sliceListener?: StateSliceListener<U>
  ) => {
    if (sliceListener) {
      return subscribeWithSelector(
        listenerOrSelector as StateSelector<State, U>,
        listenerOrEqualityFn as EqualityChecker<U>,
        sliceListener
      )
    }

    if (listenerOrEqualityFn) {
      return subscribeWithSelector(
        listenerOrSelector as StateSelector<State, U>,
        Object.is,
        listenerOrEqualityFn as StateSliceListener<U>
      )
    }

    listeners.add(listenerOrSelector as StateListener<State>)
    return () => listeners.delete(listenerOrSelector as StateListener<State>)
  }

  const destroy: Destroy = () => listeners.clear()

  const { computed } = params
  for (let key in computed) {
    const [selector, computor] = computed[key] as [
      (state: State, prevState: State) => unknown,
      (state: State, prevState: State) => State[typeof key]
    ]

    let prevSelected = computor(state, state)
    state[key] = prevSelected
    const listener = (state: State, prevState: State) => {
      const selected = selector(state, prevState)
      if (!shallowEqual(selected, prevSelected)) {
        prevSelected = selected as State[typeof key]
        state[key] = computor(state, prevState)
      }
    }

    listeners.add(listener)
  }

  const store = {
    ...params,
    state,
    prevState: state,
    set,
    replace,
    subscribe,
    destroy,
  }

  return store
}
