export type StoreCreator = {
  state: object
}

// types inspired by setState from React, see:
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/6c49e45842358ba59a508e13130791989911430d/types/react/v16/index.d.ts#L489-L495
// this hacky code is needed for type checking set({ value: undefined }), which is allowed with Partial, but should not be
export type PartialState<
  T extends object,
  K1 extends keyof T = keyof T,
  K2 extends keyof T = K1,
  K3 extends keyof T = K2,
  K4 extends keyof T = K3
  > =
  | (Pick<T, K1> | Pick<T, K2> | Pick<T, K3> | Pick<T, K4> | T)
  | ((state: T) => Pick<T, K1> | Pick<T, K2> | Pick<T, K3> | Pick<T, K4> | T)

export type SetState<T extends object> = {
  <
    K1 extends keyof T,
    K2 extends keyof T = K1,
    K3 extends keyof T = K2,
    K4 extends keyof T = K3
  >(partial: PartialState<T, K1, K2, K3, K4>): void
}

export type ReplaceState<T extends object> = (
  state: T | ((prevState: T) => T),
) => void;

export type StateListener<T extends object> = (state: T, previousState: T) => void

export type StateSliceListener<T> = (slice: T, previousSlice: T) => void

export interface Subscribe<T extends object> {
  (listener: StateListener<T>): () => void
  <U>(
    selector: StateSelector<T, U>,
    listener: StateSliceListener<U>,
  ): () => void
  <U>(
    selector: StateSelector<T, U>,
    equalityFn: EqualityChecker<U>,
    listener: StateSliceListener<U>,
  ): () => void
}

export type Destroy = () => void

export type StateSelector<T extends object, U> = (state: T) => U

export type EqualityChecker<T> = (state: T, newState: T) => boolean

export type StoreApi<T extends StoreCreator> = {
  set: SetState<T['state']>
  replace: ReplaceState<T['state']>
  state: T['state']
  prevState: T['state']
  subscribe: Subscribe<T['state']>
  destroy: Destroy
} & Omit<T, 'state'>

export const createStore = <T extends StoreCreator>(
  storeCreator: T
): StoreApi<T> => {
  type State = T['state']

  const state: State = { ...storeCreator.state }
  const listeners: Set<StateListener<State>> = new Set()

  const set: SetState<State> = (newState) => {
    if (typeof newState === 'function') newState = newState(state)

    store.prevState = { ...state }
    Object.assign(state, newState);
    listeners.forEach((listener) => listener(state, store.prevState))
  }

  const replace: ReplaceState<State> = (newState) => {
    if (typeof newState === 'function') newState = newState(state);

    for (const key in state) {
      delete state[key];
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
    listenerOrEqualityFn?: StateListener<State> | StateSliceListener<U> | EqualityChecker<U>,
    sliceListener?: StateSliceListener<U>
  ) => {
    if (sliceListener) {
      return subscribeWithSelector(
        listenerOrSelector as StateSelector<State, U>,
        listenerOrEqualityFn as EqualityChecker<U>,
        sliceListener,
      )
    }

    if (listenerOrEqualityFn) {
      return subscribeWithSelector(
        listenerOrSelector as StateSelector<State, U>,
        Object.is,
        listenerOrEqualityFn as StateSliceListener<U>,
      )
    }

    listeners.add(listenerOrSelector as StateListener<State>)
    return () => listeners.delete(listenerOrSelector as StateListener<State>)
  }

  const destroy: Destroy = () => listeners.clear()

  const store = {
    ...storeCreator,
    state,
    prevState: state,
    set,
    replace,
    subscribe,
    destroy
  }

  return store
}
