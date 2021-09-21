import {
  DependencyList,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
} from 'react'
import shallowEqual from './shallow'
import {
  EqualityChecker,
  Params,
  PartialState,
  StateListener,
  StateSelector,
  StateSliceListener,
  StoreApi,
  StoreCreator,
} from './types'
import { createStore as vanillaCreateStore } from './vanilla'

export * from './types'
export { computed } from './vanilla'

export interface Use<State extends object> {
  <Slice>(
    selector: (state: State) => Slice,
    deps?: DependencyList,
    equalityFn?: EqualityChecker<Slice>
  ): Slice
  <Key extends keyof State>(key: Key): State[Key]
  <Key extends keyof State>(...keys: Key[]): Pick<State, Key>
}

export interface UseEffect<T extends object> {
  (listener: StateListener<T>, deps?: DependencyList): void
  <U>(
    selector: StateSelector<T, U>,
    listener: StateSliceListener<U>,
    deps?: DependencyList
  ): void
  <U>(
    selector: StateSelector<T, U>,
    equalityFn: EqualityChecker<U>,
    listener: StateSliceListener<U>,
    deps?: DependencyList
  ): void
}

export type Store<T extends StoreCreator> = StoreApi<T> & {
  use: Use<T['state']>
  useEffect: UseEffect<T['state']>
}

// For server-side rendering: https://github.com/pmndrs/zustand/pull/34
// Deno support: https://github.com/pmndrs/zustand/issues/347
const isSSR =
  typeof window === 'undefined' ||
  !window.navigator ||
  /ServerSideRendering|^Deno\//.test(window.navigator.userAgent)

const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect

export const createStore = <
  T extends StoreCreator,
  State extends T['state'] = T['state']
>(
  params: T & Params<T, State>
): Store<T> => {
  const store = vanillaCreateStore(params) as unknown as Store<T>

  store.use = (...args: any[]): any => {
    if (typeof args[0] === 'string') {
      const { length } = args
      if (length === 1) {
        return use((state) => state[args[0] as keyof T['state']], args)
      }

      return use(
        (state) => {
          const slice: Partial<T['state']> = {}
          for (let i = 0; i < length; i++) {
            slice[args[i] as keyof T['state']] =
              state[args[i] as keyof T['state']]
          }
          return slice
        },
        args,
        shallowEqual
      )
    }

    return use(args[0], args[1], args[2])
  }

  const use = <Slice>(
    selector: (state: T['state']) => Slice,
    deps: DependencyList = [],
    equalityFn: EqualityChecker<Slice> = Object.is
  ) => {
    const [ref, forceUpdate] = useReducer(
      (refs) => ({ current: refs.current }),
      undefined as unknown as {
        current: {
          deps: DependencyList
          selector: (state: T['state']) => Slice
          equalityFn: EqualityChecker<Slice>
          selected: Slice
          error: boolean
          listener(state: State): true | undefined
        }
      },
      () => ({
        current: {
          deps,
          selector,
          equalityFn,
          selected: selector(store.state),
          error: false,
          listener(state: State): true | undefined {
            const selected = ref.current.selector(state)
            if (!ref.current.equalityFn(ref.current.selected, selected)) {
              ref.current.selected = selected
              return true
            }
          },
        },
      })
    )

    ref.current.selector = selector
    ref.current.equalityFn = equalityFn

    if (!shallowEqual(ref.current.deps, deps)) {
      ref.current.deps = deps
      ref.current.listener(store.state as any)
    }

    // re-run listener in render if error happened in the subscriber.
    if (ref.current.error) {
      ref.current.error = false
      ref.current.listener(store.state as any)
    }

    const { prevState } = store
    useIsomorphicLayoutEffect(() => {
      const listener = (state: State) => {
        try {
          if (ref.current.listener(state)) {
            forceUpdate()
          }
        } catch (_) {
          ref.current.error = true
          forceUpdate()
        }
      }

      // state has changed before subscription
      if (store.prevState !== prevState) {
        listener(store.state as any)
      }

      return store.subscribe(listener as any)
    }, [])

    return ref.current.selected
  }

  store.useEffect = <U>(
    a: StateListener<T['state']> | StateSelector<T['state'], U>,
    b?:
      | StateListener<T['state']>
      | StateSliceListener<U>
      | EqualityChecker<U>
      | DependencyList,
    c?: StateSliceListener<U> | DependencyList,
    d?: DependencyList
  ) => {
    const deps = d || (Array.isArray(c) && c) || (Array.isArray(b) && b) || []

    useEffect(() => {
      if (d || typeof c === 'function') {
        const selector = a as StateSelector<T['state'], U>
        const listener = c as StateSliceListener<U>
        const slice = selector(store.state)
        listener(slice, slice)

        return store.subscribe(selector, b as EqualityChecker<U>, listener)
      }

      if (typeof b === 'function') {
        const selector = a as StateSelector<T['state'], U>
        const listener = b as StateSliceListener<U>
        const slice = selector(store.state)
        listener(slice, slice)

        return store.subscribe(selector, listener)
      }

      a(store.state, store.state)
      return store.subscribe(a)
    }, deps)
  }

  return store
}

export const useCreateStore = <
  T extends StoreCreator,
  State extends T['state'] = T['state']
>(
  data: () => Params<T, State>,
  options?: {
    setOnChange?: Partial<State>
  }
) => {
  const store = useMemo(() => createStore(data()), [])

  useEffect(
    () => {
      if (options?.setOnChange) {
        store.set(options.setOnChange as PartialState<State>)
      }
    },
    options?.setOnChange ? Object.values(options.setOnChange) : []
  )

  return store
}
