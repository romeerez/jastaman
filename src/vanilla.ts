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
  state: PickData<T> | ((prevState: PickData<T>) => PickData<T>),
) => void;

export type StateListener<T extends object> = (state: PickData<T>, previousState: PickData<T>) => void

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

export type StateSelector<T extends object, U> = (state: PickData<T>) => U

export type EqualityChecker<T> = (state: T, newState: T) => boolean

type KeysOfType<Record, Type> = {
  [Key in keyof Record]: Record[Key] extends Type ? Key : never;
}[keyof Record];

export type PickData<T extends object> = Omit<T, KeysOfType<T, Function>>

export type PickMethods<T extends object> = Pick<T, KeysOfType<T, Function>>

export type StoreApi<T extends object> = {
  set: SetState<PickData<T>>
  replace: ReplaceState<T>
  state: PickData<T>
  prevState: PickData<T>
  subscribe: Subscribe<T>
  destroy: Destroy
} & PickMethods<T>

export const createStore = <T extends object>(
  dataAndMethods: T
): StoreApi<T> => {
  type State = PickData<T>

  const state = {} as State;
  const listeners: Set<StateListener<T>> = new Set()

  const set: SetState<T> = (newState) => {
    if (typeof newState === 'function') newState = newState(state as T)

    store.prevState = { ...state }
    Object.assign(state, newState);
    listeners.forEach((listener) => listener(state, store.prevState))
  }

  const replace: ReplaceState<T> = (newState) => {
    if (typeof newState === 'function') newState = newState(state);

    for (const key in state) {
      delete state[key as keyof PickData<T>];
    }

    set(newState)
  }

  const subscribeWithSelector = <U>(
    selector: StateSelector<T, U>,
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
    listenerOrSelector: StateListener<T> | StateSelector<T, U>,
    listenerOrEqualityFn?: StateListener<T> | StateSliceListener<U> | EqualityChecker<U>,
    sliceListener?: StateSliceListener<U>
  ) => {
    if (sliceListener) {
      return subscribeWithSelector(
        listenerOrSelector as StateSelector<T, U>,
        listenerOrEqualityFn as EqualityChecker<U>,
        sliceListener,
      )
    }

    if (listenerOrEqualityFn) {
      return subscribeWithSelector(
        listenerOrSelector as StateSelector<T, U>,
        Object.is,
        listenerOrEqualityFn as StateSliceListener<U>,
      )
    }

    listeners.add(listenerOrSelector as StateListener<T>)
    return () => listeners.delete(listenerOrSelector as StateListener<T>)
  }

  const destroy: Destroy = () => listeners.clear()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store: any = {
    state,
    prevState: state,
    set,
    replace,
    subscribe,
    destroy
  }

  for (const key in dataAndMethods) {
    const value = dataAndMethods[key];
    if (typeof value === 'function') {
      (store)[key] = value
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (state as any)[key] = value;
    }
  }

  return store
}
