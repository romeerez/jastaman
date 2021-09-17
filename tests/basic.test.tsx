import {
  Component as ClassComponent,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import ReactDOM from 'react-dom'
import { createStore, EqualityChecker, StateSelector, SetState } from '../src/index'

it('uses the store', async () => {
  const store = createStore({
    state: {
      count: 0,
    },
    inc: () => store.set((state) => ({ count: state.count + 1 }))
  })

  function Counter() {
    const count = store.use(state => state.count)
    useEffect(store.inc, [])
    return <div>count: {count}</div>
  }

  const { findByText } = render(<Counter />)

  await findByText('count: 1')
})

it('uses the store with a selector and equality checker', async () => {
  const store = createStore({ state: { item: { value: 0 } } })
  let renderCount = 0

  function Component() {
    // Prevent re-render if new value === 1.
    const item = store.use(
      (s) => s.item,
      [],
      (_, newItem) => newItem.value === 1
    )
    return (
      <div>
        renderCount: {++renderCount}, value: {item.value}
      </div>
    )
  }

  const { findByText } = render(<Component />)

  await findByText('renderCount: 1, value: 0')

  // This will not cause a re-render.
  act(() => store.set({ item: { value: 1 } }))
  await findByText('renderCount: 1, value: 0')

  // This will cause a re-render.
  act(() => store.set({ item: { value: 2 } }))
  await findByText('renderCount: 2, value: 2')
})

it('only re-renders if selected state has changed', async () => {
  const store = createStore({
    state: {
      count: 0
    },
    inc: () => store.set((state) => ({ count: state.count + 1 }))
  })
  let counterRenderCount = 0
  let controlRenderCount = 0

  function Counter() {
    const count = store.use((state) => state.count)
    counterRenderCount++
    return <div>count: {count}</div>
  }

  function Control() {
    controlRenderCount++
    return <button onClick={store.inc}>button</button>
  }

  const { getByText, findByText } = render(
    <>
      <Counter />
      <Control />
    </>
  )

  fireEvent.click(getByText('button'))

  await findByText('count: 1')

  expect(counterRenderCount).toBe(2)
  expect(controlRenderCount).toBe(1)
})

it('re-renders with useLayoutEffect', async () => {
  const store = createStore({ state: { state: false } })

  function Component() {
    const state = store.use(state => state.state)
    useLayoutEffect(() => {
      store.set({ state: true })
    }, [])
    return <>{`${state}`}</>
  }

  const container = document.createElement('div')
  ReactDOM.render(<Component />, container)
  expect(container.innerHTML).toBe('true')
  ReactDOM.unmountComponentAtNode(container)
})

it('can batch updates', async () => {
  const store = createStore({
    state: {
      count: 0,
    },
    inc() {
      store.set((state) => ({ count: state.count + 1 }))
    },
  })

  function Counter() {
    const count = store.use(state => state.count)
    useEffect(() => {
      ReactDOM.unstable_batchedUpdates(() => {
        store.inc()
        store.inc()
      })
    }, [])
    return <div>count: {count}</div>
  }

  const { findByText } = render(<Counter />)

  await findByText('count: 2')
})

it('can update the selector', async () => {
  type State = { one: string; two: string }
  type Props = { selector: StateSelector<State, string> }
  const store = createStore({
    state: {
      one: 'one',
      two: 'two',
    }
  })

  function Component({ selector }: Props) {
    return <div>{store.use(selector, [selector])}</div>
  }

  const { findByText, rerender } = render(<Component selector={(s) => s.one} />)
  await findByText('one')

  rerender(<Component selector={(s) => s.two} />)
  await findByText('two')
})

it('can update the equality checker', async () => {
  type State = { value: number }
  type Props = { equalityFn: EqualityChecker<number> }
  const store = createStore<{ state: State }>({ state: { value: 0 } })
  const selector: StateSelector<State, number> = (s) => s.value

  let renderCount = 0
  function Component({ equalityFn }: Props) {
    const value = store.use(selector, [equalityFn], equalityFn)
    return (
      <div>
        renderCount: {++renderCount}, value: {value}
      </div>
    )
  }

  // Set an equality checker that always returns false to always re-render.
  const { findByText, rerender } = render(
    <Component equalityFn={() => false} />
  )
  await findByText('renderCount: 1, value: 0')

  // This will not cause a re-render because value was not changed
  act(() => store.set({ value: 0 }))
  await findByText('renderCount: 1, value: 0')

  // Set an equality checker that always returns true to never re-render.
  rerender(<Component equalityFn={() => true} />)

  // This will NOT cause a re-render due to the equality checker.
  await findByText('renderCount: 2, value: 0')
  act(() => store.set({ value: 1 }))
  await findByText('renderCount: 2, value: 0')
})

it('can call store.use with progressively more arguments', async () => {
  type State = { value: number }
  type Props = {
    selector?: StateSelector<State, number>
    equalityFn?: EqualityChecker<number>
  }

  const store = createStore<{ state: State }>({ state: { value: 0 } })

  let renderCount = 0
  function Component({ selector, equalityFn }: Props) {
    const value = store.use(selector as any, [], equalityFn)
    return (
      <div>
        renderCount: {++renderCount}, value: {JSON.stringify(value)}
    </div>
  )
  }

  // Render with selector.
  const { findByText, rerender } = render(<Component selector={(s) => s.value} />)
  await findByText('renderCount: 1, value: 0')

  // Render with selector and equality checker.
  rerender(
    <Component
      selector={(s) => s.value}
      equalityFn={(oldV, newV) => oldV > newV}
    />
  )

  // Should not cause a re-render because new value is less than previous.
  await findByText('renderCount: 2, value: 0')
  act(() => store.set({ value: -1 }))
  await findByText('renderCount: 2, value: 0')

  act(() => store.set({ value: 1 }))
  await findByText('renderCount: 3, value: 1')
})

it('can throw an error in selector', async () => {
  console.error = jest.fn()
  type State = { value?: string }

  const store = createStore<{ state: State }>({ state: { value: 'foo' } })
  const selector: StateSelector<State, string | void> = (s) =>
    // @ts-expect-error This function is supposed to throw an error
    s.value.toUpperCase()

  class ErrorBoundary extends ClassComponent<{}, { hasError: boolean }> {
    constructor(props: {}) {
      super(props)
      this.state = { hasError: false }
    }
    static getDerivedStateFromError() {
      return { hasError: true }
    }
    render() {
      return this.state.hasError ? <div>errored</div> : this.props.children
    }
  }

  function Component() {
    store.use(selector)
    return <div>no error</div>
  }

  const { findByText } = render(
    <ErrorBoundary>
      <Component />
    </ErrorBoundary>
  )
  await findByText('no error')

  act(() => {
    store.set({ value: undefined })
  })
  await findByText('errored')
})

it('can throw an error in equality checker', async () => {
  console.error = jest.fn()
  type State = { value?: string }

  const store = createStore<{ state: State }>({ state: { value: 'foo' } })
  const selector: StateSelector<State, State> = (s) => s
  const equalityFn: EqualityChecker<State> = (a, b) =>
    // @ts-expect-error This function is supposed to throw an error
    a.value.trim() === b.value?.trim()

  class ErrorBoundary extends ClassComponent<{}, { hasError: boolean }> {
    constructor(props: {}) {
      super(props)
      this.state = { hasError: false }
    }
    static getDerivedStateFromError() {
      return { hasError: true }
    }
    render() {
      return this.state.hasError ? <div>errored</div> : this.props.children
    }
  }

  function Component() {
    store.use(selector, [], equalityFn)
    return <div>no error</div>
  }

  const { findByText } = render(
    <ErrorBoundary>
      <Component />
    </ErrorBoundary>
  )
  await findByText('no error')

  act(() => {
    store.set({ value: undefined })
  })
  await findByText('errored')
})

it('can get the state', () => {
  const store = createStore({
    state: {
      value: 1,
    },
    getState: () => store.state,
  })

  expect(store.state.value).toBe(1)
  expect(store.getState().value).toBe(1)
})

it('can set the state', () => {
  type State = {
    state: {
      value: number
    }
    setState: SetState<State['state']>
  }

  const { set, setState, state } = createStore<State>({
    state: {
      value: 1,
    },
    setState(v) {
      set(v)
    },
  })

  setState({ value: 2 })
  expect(state.value).toBe(2)
  setState((s) => ({ value: ++s.value }))
  expect(state.value).toBe(3)
})

it('can set the store without merging', () => {
  const { replace, state } = createStore<{ state: { a?: number, b?: number } }>({
    state: { a: 1 },
  })

  // Should override the state instead of merging.
  replace({ b: 2 })
  expect(state).toEqual({ b: 2 })
})

it('can destroy the store', () => {
  const store = createStore({
    state: {
      value: 1,
    }
  })

  store.subscribe(() => {
    throw new Error('did not clear listener on destroy')
  })
  store.destroy()

  store.set({ value: 2 })
  expect(store.state.value).toEqual(2)
})

it('only calls selectors when necessary', async () => {
  type State = { a: number; b: number }
  const store = createStore<{ state: State }>({ state: { a: 0, b: 0 } })
  let inlineSelectorCallCount = 0
  let staticSelectorCallCount = 0

  function staticSelector(s: State) {
    staticSelectorCallCount++
    return s.a
  }

  function Component() {
    const selector = (s: State) => (inlineSelectorCallCount++, s.b)
    store.use(selector, [selector])
    store.use(staticSelector)
    return (
      <>
        <div>inline: {inlineSelectorCallCount}</div>
        <div>static: {staticSelectorCallCount}</div>
      </>
    )
  }

  const { rerender, findByText } = render(<Component />)
  await findByText('inline: 1')
  await findByText('static: 1')

  rerender(<Component />)
  await findByText('inline: 2')
  await findByText('static: 1')

  act(() => store.set({ a: 1, b: 1 }))
  await findByText('inline: 4')
  await findByText('static: 2')
})

it('ensures parent components subscribe before children', async () => {
  type State = {
    children: { [key: string]: { text: string } }
  }
  type Props = { id: string }
  const store = createStore<{ state: State }>({
    state: {
      children: {
        '1': { text: 'child 1' },
        '2': { text: 'child 2' },
      },
    }
  })

  function changeState() {
    store.set({
      children: {
        '3': { text: 'child 3' },
      },
    })
  }

  function Child({ id }: Props) {
    const text = store.use((s) => s.children[id]?.text)
    return <div>{text}</div>
  }

  function Parent() {
    const childStates = store.use((s) => s.children)
    return (
      <>
        <button onClick={changeState}>change state</button>
        {Object.keys(childStates).map((id) => (
          <Child id={id} key={id} />
        ))}
      </>
    )
  }

  const { getByText, findByText } = render(<Parent />)

  fireEvent.click(getByText('change state'))

  await findByText('child 3')
})

// https://github.com/pmndrs/zustand/issues/84
it('ensures the correct subscriber is removed on unmount', async () => {
  const store = createStore({ state: { count: 0 } })

  function increment() {
    store.set(({ count }) => ({ count: count + 1 }))
  }

  function Count() {
    const c = store.use((s) => s.count)
    return <div>count: {c}</div>
  }

  function CountWithInitialIncrement() {
    useLayoutEffect(increment, [])
    return <Count />
  }

  function Component() {
    const [Counter, setCounter] = useState(() => CountWithInitialIncrement)
    useLayoutEffect(() => {
      setCounter(() => Count)
    }, [])
    return (
      <>
        <Counter />
      <Count />
      </>
    )
  }

  const { findAllByText } = render(<Component />)

  expect((await findAllByText('count: 1')).length).toBe(2)

  act(increment)

  expect((await findAllByText('count: 2')).length).toBe(2)
})

// https://github.com/pmndrs/zustand/issues/86
it('ensures a subscriber is not mistakenly overwritten', async () => {
  const store = createStore({ state: { count: 0 } })

  function Count1() {
    const c = store.use((s) => s.count)
    return <div>count1: {c}</div>
  }

  function Count2() {
    const c = store.use((s) => s.count)
    return <div>count2: {c}</div>
  }

  // Add 1st subscriber.
  const { findAllByText, rerender } = render(<Count1 />)

  // Replace 1st subscriber with another.
  rerender(<Count2 />)

  // Add 2 additional subscribers.
  rerender(
    <>
      <Count2 />
      <Count1 />
      <Count1 />
    </>
  )

  // Call all subscribers
  act(() => store.set({ count: 1 }))

  expect((await findAllByText('count1: 1')).length).toBe(2)
  expect((await findAllByText('count2: 1')).length).toBe(1)
})
