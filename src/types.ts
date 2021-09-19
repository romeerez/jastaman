export type StoreCreator = {
  state: object
}

export type Params<
  T extends StoreCreator,
  State extends T['state'] = T['state']
> = T & {
  state: State
  computed?: Partial<{
    [Key in keyof State]: [
      (state: State, prevState: State) => unknown,
      (state: State, prevState: State) => State[Key]
    ]
  }>
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
  >(
    partial: PartialState<T, K1, K2, K3, K4>
  ): void
}

export type ReplaceState<T extends object> = (
  state: T | ((prevState: T) => T)
) => void

export type StateListener<T extends object> = (
  state: T,
  previousState: T
) => void

export type StateSliceListener<T> = (slice: T, previousSlice: T) => void

export interface Subscribe<T extends object> {
  (listener: StateListener<T>): () => void
  <U>(
    selector: StateSelector<T, U>,
    listener: StateSliceListener<U>
  ): () => void
  <U>(
    selector: StateSelector<T, U>,
    equalityFn: EqualityChecker<U>,
    listener: StateSliceListener<U>
  ): () => void
}

export type Destroy = () => void

export type StateSelector<T extends object, U> = (state: T) => U

export type EqualityChecker<T> = (state: T, newState: T) => boolean

export type StoreApi<
  T extends StoreCreator,
  State extends T['state'] = T['state']
> = {
  set: SetState<State>
  replace: ReplaceState<State>
  state: State
  prevState: State
  subscribe: Subscribe<State>
  destroy: Destroy
} & Omit<T, 'state'>
