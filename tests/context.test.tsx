import { Component as ClassComponent, useEffect, useState } from 'react'
import { render } from '@testing-library/react'
import createContext from '../src/context'
import { createStore, Store } from '../src/index'

type CounterState = {
  count: number
  inc: () => void
}

it('creates and uses context store', async () => {
  const { Provider, useStore } = createContext(() => {
    const store = createStore({
      count: 0,
      inc() {
        store.set((state) => ({ count: state.count + 1 }))
      },
    })
    return store
  })

  function Counter() {
    const store = useStore()
    const count = store.use(state => state.count)
    useEffect(store.inc, [])
    return <div>count: {count * 1}</div>
  }

  const { findByText } = render(
    <Provider>
      <Counter />
    </Provider>
  )

  await findByText('count: 1')
})

it('uses context store api', async () => {
  const { Provider, useStore } = createContext(() => {
    const store = createStore({
      count: 0,
      inc() {
        store.set((state) => ({ count: state.count + 1 }))
      },
    })
    return store
  })


  function Counter() {
    const store = useStore()
    const [count, setCount] = useState(0)
    useEffect(
      () => {
        store.subscribe(
          (state) => state.count,
          (count) => setCount(count),
        )
      }, [store]
    )

    useEffect(() => {
      store.set({ count: store.state.count + 1 })
    }, [store])

    useEffect(() => {
      if (count === 1) {
        store.destroy()
        store.set({ count: store.state.count + 1 })
      }
    }, [store, count])

    return <div>count: {count * 1}</div>
  }

  const { findByText } = render(
    <Provider>
      <Counter />
    </Provider>
  )

  await findByText('count: 1')
})

it('throws error when not using provider', async () => {
  console.error = jest.fn()

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

  const { useStore } = createContext(() => createStore({}))
  function Component() {
    useStore()
    return <div>no error</div>
  }

  const { findByText } = render(
    <ErrorBoundary>
      <Component />
    </ErrorBoundary>
  )
  await findByText('errored')
})
