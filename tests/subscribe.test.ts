import { createStore } from '../src/index'

describe('subscribe()', () => {
  it('should be called if new state identity is different', () => {
    const spy = jest.fn()
    const initialState = { value: 1, other: 'a' }
    const store = createStore({ state: initialState })

    store.subscribe(spy)
    store.set({ ...store.state })
    expect(spy).toHaveBeenCalledWith(initialState, initialState)
  })

  it('should not be called when state slice is the same', () => {
    const spy = jest.fn()
    const initialState = { value: 1, other: 'a' }
    const store = createStore({ state: initialState })

    store.subscribe((s) => s.value, spy)
    store.set({ other: 'b' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('should be called when state slice changes', () => {
    const spy = jest.fn()
    const initialState = { value: 1, other: 'a' }
    const store = createStore({ state: initialState })

    store.subscribe((s) => s.value, spy)
    store.set({ value: initialState.value + 1 })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(initialState.value + 1, initialState.value)
  })

  it('should not be called when equality checker returns true', () => {
    const spy = jest.fn()
    const initialState = { value: 1, other: 'a' }
    const store = createStore({ state: initialState })

    store.subscribe((state) => state, () => true, spy)
    store.set({ value: initialState.value + 2 })
    expect(spy).not.toHaveBeenCalled()
  })

  it('should be called when equality checker returns false', () => {
    const spy = jest.fn()
    const initialState = { value: 1, other: 'a' }
    const store = createStore({ state: initialState })

    store.subscribe(
      (s) => s.value,
      () => false,
      spy,
    )
    store.set({ value: initialState.value + 2 })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(initialState.value + 2, initialState.value)
  })

  it('should unsubscribe correctly', () => {
    const spy = jest.fn()
    const initialState = { value: 1, other: 'a' }
    const store = createStore({ state: initialState })

    const unsub = store.subscribe((s) => s.value, spy)

    store.set({ value: initialState.value + 1 })
    unsub()
    store.set({ value: initialState.value + 2 })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(initialState.value + 1, initialState.value)
  })

  it('should keep consistent behavior with equality check', () => {
    const spy = jest.fn()
    const initialState = { value: 1, other: 'a' }
    const store = createStore({ state: initialState })

    const isRoughEqual = (x: number, y: number) => Math.abs(x - y) < 1
    store.set({ value: 0 })
    spy.mockReset()
    const spy2 = jest.fn()
    let prevValue = store.state.value
    const unsub = store.subscribe((s) => {
      if (isRoughEqual(prevValue, s.value)) {
        // skip assuming values are equal
        return
      }
      spy(s.value, prevValue)
      prevValue = s.value
    })
    const unsub2 = store.subscribe((s) => s.value, isRoughEqual, spy2)
    store.set({ value: 0.5 })
    store.set({ value: 1 })
    unsub()
    unsub2()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(1, 0)
    expect(spy2).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledWith(1, 0)
  })
})
