import {
  createContext as reactCreateContext, createElement,
  useContext,
  ReactNode,
} from 'react'
import { Store, StoreCreator } from './index'

type Provider<Arg> = (props: Arg & { children?: ReactNode }) => JSX.Element

export default function createContext<T extends StoreCreator, Arg extends object>(
  createStore: (props: Arg) => Store<T>
): { Provider: Provider<Arg>, useStore(): Store<T> } {
  const context = reactCreateContext(undefined as unknown as Store<T>)

  const Provider: Provider<Arg> = (props) => {
    return createElement(
      context.Provider,
      { value: createStore(props) },
      props.children
    )
  }

  return {
    Provider,
    useStore: () => {
      const store = useContext(context)

      if (!store) {
        throw new Error(
          'Seems like you have not used store provider as an ancestor.'
        )
      }

      return store
    }
  }
}
