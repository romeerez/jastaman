import {
  DependencyList,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import shallowEqual from './shallow'
import {
  EqualityChecker,
  Params,
  StateListener,
  StateSelector,
  StateSliceListener,
  StoreApi,
  StoreCreator,
} from './types'
import { createStore as vanillaCreateStore } from './vanilla'

export * from './types'
export { computed } from './vanilla'

export type Use<State extends object> = <Slice>(
  selector: (state: State) => Slice,
  deps?: ReadonlyArray<any>,
  equalityFn?: EqualityChecker<Slice>
) => Slice

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

  store.use = (selector, deps = [], equalityFn = Object.is) => {
    const [, forceUpdate] = useReducer((c) => c + 1, 0)
    const selectedState = useState(() => selector(store.state))
    let selected = selectedState[0]
    const setSelected = selectedState[1]
    const { prevState } = store

    const refs = useRef({
      deps,
      selector,
      equalityFn,
      selected,
      error: false,
      listener(state: State) {
        const selected = refs.current.selector(state)
        if (!refs.current.equalityFn(refs.current.selected, selected)) {
          refs.current.selected = selected
          setSelected(selected)
        }
        return selected
      },
    })

    refs.current.selector = selector
    refs.current.equalityFn = equalityFn

    if (!shallowEqual(refs.current.deps, deps)) {
      refs.current.deps = deps
      selected = refs.current.listener(store.state as any)
    }

    // re-run listener in render if error happened in the subscriber.
    if (refs.current.error) {
      refs.current.error = false
      selected = refs.current.listener(store.state as any)
    }

    refs.current.selected = selected

    useIsomorphicLayoutEffect(() => {
      const listener = (state: State) => {
        try {
          refs.current.listener(state)
        } catch (_) {
          refs.current.error = true
          forceUpdate()
        }
      }

      // state has changed before subscription
      if (store.prevState !== prevState) {
        listener(store.state as any)
      }

      return store.subscribe(listener as any)
    }, [])

    return selected
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
//
// export const useCreateStore = <T extends StoreCreator, State extends T['state'] = T['state']>(
//   creator: () => Store<T>
// ) => {
//   const store = useMemo(creator, [])
//
//   return store
// }
