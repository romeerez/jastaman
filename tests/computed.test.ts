import { createStore, computed } from '../src/index'

test('computed fields', () => {
  let sumCalculated = 0
  let produceCalculated = 0

  const store = createStore({
    state: {
      a: 1,
      b: 2,
      c: 2,
      sumAandB: computed<number>(),
      productAandC: computed<number>(),
    },
    computed: {
      sumAandB: [
        ({ a, b }) => [a, b],
        ({ a, b }) => {
          sumCalculated++
          return a + b
        }
      ],
      productAandC: [
        ({ a, c }) => [a, c],
        ({ a, c }) => {
          produceCalculated++
          return a * c
        }
      ],
    },
    lalala: 123
  })
  
  expect(store.state.sumAandB).toBe(3)
  expect(store.state.productAandC).toBe(2)
  expect(sumCalculated).toBe(1)
  expect(produceCalculated).toBe(1)

  store.set({ a: 3 })
  expect(store.state.sumAandB).toBe(5)
  expect(store.state.productAandC).toBe(6)
  expect(sumCalculated).toBe(2)
  expect(produceCalculated).toBe(2)

  store.set({ b: 3 })
  expect(store.state.sumAandB).toBe(6)
  expect(store.state.productAandC).toBe(6)
  expect(sumCalculated).toBe(3)
  expect(produceCalculated).toBe(2)
})