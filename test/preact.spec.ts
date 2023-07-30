import { h } from 'preact'
import { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'preact/hooks'
import { render, cleanup, waitFor, fireEvent, renderHook, act } from '@testing-library/preact'
import { Command, Effect, UpdateMap, createRailway } from '../src'
import { AsyncResult, Result } from 'ts-railway'

const useRailway = createRailway({ useEffect, useRef, useState, useLayoutEffect })

describe('example test', () => {
  afterEach(cleanup)

  type State = number
  type Action = { inc: [] }
  type Injects = Record<string, never>

  const init = (): Command<State, Action, Injects> => [0]

  const update: UpdateMap<State, Action, Injects> = {
    inc: (state) => [state + 1]
  }

  test('renderHook & act example', async () => {
    const { result } = renderHook(() => useRailway(init, update))

    await act(() => {
      result.current[1].inc()
    })

    expect(result.current[0]).toBe(1)
  })
})

describe('useRailway', () => {
  afterEach(cleanup)

  test('should rerender less times than the amount of action calls', () => {
    let renders = 0
    const states: number[] = []

    type State = number
    type Action = { inc: [] }
    type Injects = Record<string, never>

    const init = () => [0] as const
    const update: UpdateMap<State, Action, Injects> = {
      inc: (state) => [
        state + 1,
        () => {
          states.push(state + 1)

          return Result.success(undefined)
        }
      ]
    }

    const Counter = () => {
      const [state, actions] = useRailway(init, update)

      useEffect(() => {
        actions.inc()
        actions.inc()
        actions.inc()
        actions.inc()
        actions.inc()
      }, [actions])

      renders++

      return h('div', { ['data-testid']: 'result', key: '' }, state)
    }

    const { getByTestId } = render(h(Counter, {}))
    expect(getByTestId('result').textContent).toEqual('5')
    expect(states).toEqual([1, 2, 3, 4, 5])
    expect(renders).toBeLessThan(states.length)
  })

  test('should preserve effect order', () => {
    function last<T>(arr: readonly T[]) {
      return arr[arr.length - 1]
    }

    type State = readonly number[]
    type Action = {
      push: [value: number]
      condPush: []
    }
    type Injects = Record<string, never>

    const init = (): Command<State, Action, Injects> => [
      [],
      ({ push }) => Result.success(push(0)),
      ({ push }) => Result.success(push(1)),
      ({ push }) => Result.success(push(5))
    ]

    const update: UpdateMap<State, Action, Injects> = {
      condPush: (state) => {
        const value = last(state)

        if (value === 1) {
          return [[...state, 2, 3, 4]]
        }

        if (value === 20) {
          return [[...state, 21, 22]]
        }

        return [state]
      },
      push: (state, value) => [[...state, value], ({ condPush }) => Result.success(condPush())]
    }

    const List = () => {
      const [state, actions] = useRailway(init, update)

      useEffect(() => {
        actions.push(10)
        actions.push(20)
        actions.push(30)
      }, [actions])

      return h('div', { ['data-testid']: 'result', key: '' }, state.join())
    }

    const { getByTestId } = render(h(List, {}))
    expect(getByTestId('result').textContent).toEqual('0,1,2,3,4,5,10,20,21,22,30')
  })

  test('should preserve effect order when adding single effect', () => {
    type State = readonly number[]
    type Action = { push: [value: number, effects: number[]] }
    type Injects = Record<string, never>

    const init = (): Command<State, Action, Injects> => [
      [],
      ({ push }) => Result.success(push(0, [1, 2]))
    ]
    const update: UpdateMap<State, Action, Injects> = {
      push: (state, value, [first, ...rest]) => {
        const nextState = [...state, value]
        return first === undefined
          ? [nextState]
          : [nextState, ({ push }) => Result.success(push(first, rest))]
      }
    }

    const List = () => {
      const [state, actions] = useRailway(init, update)

      useLayoutEffect(() => {
        actions.push(3, [4, 5])
        actions.push(6, [7, 8])
      }, [actions])

      useEffect(() => {
        actions.push(9, [10, 11])
        actions.push(12, [13, 14])
      }, [actions])

      return h('div', { ['data-testid']: 'result', key: '' }, state.join())
    }

    const { getByTestId } = render(h(List, {}))
    expect(getByTestId('result').textContent).toEqual('0,1,2,3,4,5,6,7,8,9,10,11,12,13,14')
  })

  test('should preserve effect order when adding multiple effects', () => {
    type State = readonly number[]
    type Action = { push: [value: number | undefined, effects?: number[][]] }
    type Injects = Record<string, never>

    const init = (): Command<State, Action, Injects> => [
      [],
      ({ push }) =>
        Result.success(
          push(0, [
            [1, 2],
            [3, 4]
          ])
        )
    ]

    const update: UpdateMap<State, Action, Injects> = {
      push: (state, value, effects) => [
        value === undefined ? state : [...state, value],
        ...(value === undefined ? [] : effects ?? []).map(
          ([first, ...rest]): Effect<Action, Injects> =>
            ({ push }) =>
              Result.success(push(first, [rest]))
        )
      ]
    }

    const List = () => {
      const [state, actions] = useRailway(init, update)

      useLayoutEffect(() => {
        actions.push(5, [
          [6, 7],
          [8, 9]
        ])
        actions.push(10, [
          [11, 12],
          [13, 14]
        ])
      }, [actions])

      useEffect(() => {
        actions.push(15, [
          [16, 17],
          [18, 19]
        ])
        actions.push(20, [
          [21, 22],
          [23, 24]
        ])
      }, [actions])

      return h('div', { ['data-testid']: 'result', key: '' }, state.join())
    }

    const { getByTestId } = render(h(List, {}))
    expect(getByTestId('result').textContent).toEqual(
      '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24'
    )
  })

  test('should handle async effects', async () => {
    type State = 'idle' | 'loading' | { text: string }
    type Action = { start: []; done: [text: string] }
    type Injects = { fetch: () => AsyncResult<string, never> }

    const init = () => ['idle'] as const
    const update: UpdateMap<State, Action, Injects> = {
      start: () => ['loading', ({ done }, { fetch }) => AsyncResult.map(done, fetch())],

      done: (_, text) => [{ text }]
    }

    const fetch = () =>
      new Promise<Result<string, never>>((resolve) => {
        setTimeout(() => resolve(Result.success('some text')), 500)
      })

    const Async = () => {
      const [state, actions] = useRailway(init, update, { fetch })

      useEffect(() => {
        actions.start()
      }, [actions])

      return h('div', { ['data-testid']: 'result', key: '' }, JSON.stringify(state))
    }

    const { getByTestId } = render(h(Async, {}))

    await waitFor(() => {
      expect(getByTestId('result').textContent).toEqual('{"text":"some text"}')
    })
  })

  test('should cleanup on unmount', async () => {
    type State = number
    type Action = { inc: [] }
    type Injects = { delay: () => AsyncResult<unknown, never> }

    const init = () => [0] as const
    const update: UpdateMap<State, Action, Injects> = {
      inc: (state) => [state + 1, ({ inc }, { delay }) => AsyncResult.map(inc, delay())]
    }

    const delay = () =>
      new Promise<Result<unknown, never>>((resolve) => {
        setTimeout(() => resolve(Result.success(undefined)), 100)
      })

    const Counter = () => {
      const [state, actions] = useRailway(init, update, { delay })

      useEffect(() => {
        actions.inc()
      }, [actions])

      return h('div', { ['data-testid']: 'result', key: '' }, state)
    }

    const App = () => {
      const [stepOne, setStepOne] = useState(false)
      const [stepTwo, setStepTwo] = useState(false)

      useEffect(() => {
        setTimeout(() => setStepOne(true), 350)
        setTimeout(() => setStepTwo(true), 650)
      }, [])

      return stepTwo
        ? h('div', { ['data-testid']: 'two', key: '' }, 'two')
        : stepOne
        ? h('div', { ['data-testid']: 'one', key: '' }, 'one')
        : h(Counter, {})
    }

    const { getByTestId } = render(h(App, {}))

    const result = getByTestId('result')

    await waitFor(() => {
      expect(result.textContent).toEqual('4')
      expect(getByTestId('two').textContent).toEqual('two')
    })
  })

  test('should trigger initial effects', () => {
    type State = number
    type Action = { inc: [] }
    type Injects = Record<string, never>

    const init = (): Command<State, Action, Injects> => [
      0,
      ({ inc }) => Result.success(inc()),
      ({ inc }) => Result.success(inc()),
      ({ inc }) => Result.success(inc())
    ]

    const update: UpdateMap<State, Action, Injects> = {
      inc: (state) => [state + 1]
    }

    const Counter = () => {
      const [state] = useRailway(init, update)

      return h('div', { ['data-testid']: 'result', key: '' }, state)
    }

    const { getByTestId } = render(h(Counter, {}))
    expect(getByTestId('result').textContent).toEqual('3')
  })

  test('should listen inject changes', async () => {
    type State = number
    type Action = { start: []; done: [amount: number] }
    type Injects = { amount: () => Result<number, never> }

    const init = (): Command<State, Action, Injects> => [
      0,
      ({ done }, { amount }) => Result.map(done, amount())
    ]

    const update: UpdateMap<State, Action, Injects> = {
      start: (state) => [state, ({ done }, { amount }) => Result.map(done, amount())],

      done: (_, amount) => [amount]
    }

    const Setter = () => {
      const [amount, setAmount] = useState(() => () => Result.success(3))
      const [state, { start }] = useRailway(init, update, { amount })

      const incAmount = useCallback(
        () =>
          setAmount((a) => {
            const next = a().success + 3

            return () => Result.success(next)
          }),
        []
      )

      return h('div', {}, [
        h('button', { ['data-testid']: 'start', onClick: start }),
        h('button', { ['data-testid']: 'inc-amount', onClick: incAmount }),
        h('div', { ['data-testid']: 'result', key: '' }, state)
      ])
    }

    const { getByTestId } = render(h(Setter, {}))

    const start = getByTestId('start')
    const incAmount = getByTestId('inc-amount')

    fireEvent.click(start)
    fireEvent.click(incAmount)

    await new Promise((resolve) => {
      setTimeout(() => {
        fireEvent.click(start)
        resolve(undefined)
      }, 300)
    })

    await waitFor(() => {
      expect(getByTestId('result').textContent).toEqual('6')
    })
  })

  test('should update injects prior to everything else', async () => {
    type State = number
    type Action = { start: [number] }
    type Injects = { amount: number }

    const init = (): Command<State, Action, Injects> => [0]

    const update: UpdateMap<State, Action, Injects> = {
      start: (_state, num) => [
        num,
        (_, { amount }) => {
          if (num !== amount) {
            throw new Error(`${num} !== ${amount}`)
          }

          return Result.success(undefined)
        }
      ]
    }

    const Setter = ({ amount }: { amount: number }) => {
      const [state, { start }] = useRailway(init, update, { amount })

      useLayoutEffect(() => {
        start(amount)
      }, [amount, start])

      return h('div', { ['data-testid']: 'result', key: '' }, state)
    }

    const App = () => {
      const [state, setState] = useState(1)

      useEffect(() => {
        setTimeout(() => setState(2), 100)
      }, [])

      return h(Setter, { amount: state })
    }

    const { getByTestId } = render(h(App, {}))

    await waitFor(() => {
      expect(getByTestId('result').textContent).toEqual('2')
    })
  })

  test('should queue effects during commit phase', () => {
    let effectCount = 0

    type State = number
    type Action = { inc: [] }
    type Injects = Record<string, never>

    const init = () => [0] as const
    const update: UpdateMap<State, Action, Injects> = {
      inc: (state) => [
        state + 1,
        () => {
          effectCount++

          return Result.success(undefined)
        }
      ]
    }

    const Counter = () => {
      const [hasClicked, setHasClicked] = useState(false)
      const [state, actions] = useRailway(init, update)

      useLayoutEffect(() => {
        if (hasClicked) {
          actions.inc()
        }
      }, [hasClicked, actions])

      const handleClick = useCallback(() => {
        setHasClicked(true)
        actions.inc()
      }, [actions])

      return h('div', {}, [
        h('div', { ['data-testid']: 'result', key: '' }, state),
        h('button', { ['data-testid']: 'button', onClick: handleClick })
      ])
    }

    const { getByTestId } = render(h(Counter, {}))

    expect(getByTestId('result').textContent).toEqual('0')

    const button = getByTestId('button')

    fireEvent.click(button)

    expect(getByTestId('result').textContent).toEqual('2')
    expect(effectCount).toEqual(2)
  })

  test('should run intial effects prior to effects triggered from useLayoutEffect', () => {
    type State = string[]
    type Action = { add: [value: string] }
    type Injects = Record<string, never>

    const init = (value: string): Command<State, Action, Injects> => [
      [value],
      ({ add }) => Result.success(add('init 1')),
      ({ add }) => Result.success(add('init 2')),
      ({ add }) => Result.success(add('init 3'))
    ]

    const update: UpdateMap<State, Action, Injects> = {
      add: (state, value) => [[...state, value]]
    }

    const Counter = () => {
      const [state, actions] = useRailway(() => init('first'), update)

      useEffect(() => {
        actions.add('useEffect 1')
        actions.add('useEffect 2')
        actions.add('useEffect 3')
      }, [actions])

      useLayoutEffect(() => {
        actions.add('useLayoutEffect 1')
        actions.add('useLayoutEffect 2')
        actions.add('useLayoutEffect 3')
      }, [actions])

      return h('div', { ['data-testid']: 'result', key: '' }, state.join())
    }

    const App = () => h(Counter, {})

    const { getByTestId } = render(h(App, {}))
    expect(getByTestId('result').textContent).toEqual(
      'first,init 1,init 2,init 3,useLayoutEffect 1,useLayoutEffect 2,useLayoutEffect 3,' +
        'useEffect 1,useEffect 2,useEffect 3'
    )
  })

  test('should not rerender when setting same state', async () => {
    let renders = 0

    type State = number[]
    type Action = { clear: [] }
    type Injects = Record<string, never>

    const init = () => [[1, 2, 3]] as const
    const update: UpdateMap<State, Action, Injects> = {
      clear: (state) => [state.length === 0 ? state : []]
    }

    const Counter = () => {
      const [state, actions] = useRailway(init, update)

      renders++

      return h('div', {}, [
        h('button', { ['data-testid']: 'button', onClick: actions.clear }),
        h('div', { ['data-testid']: 'result', key: '' }, state)
      ])
    }

    const { getByTestId } = render(h(Counter, {}))

    const button = getByTestId('button')

    await new Promise((resolve) => {
      setTimeout(() => resolve(fireEvent.click(button)), 100)
    })

    await new Promise((resolve) => {
      setTimeout(() => resolve(fireEvent.click(button)), 300)
    })

    await waitFor(() => {
      expect(renders).toBeLessThan(3)
    })
  })

  test('should call init only once', async () => {
    let renders = 0
    let initCreatorCalls = 0
    let initCalls = 0

    type State = number
    type Action = { inc: [] }
    type Injects = Record<string, never>

    const init = () => {
      initCalls++
      return [0] as const
    }
    const update: UpdateMap<State, Action, Injects> = {
      inc: (state) => [state + 1]
    }

    const createInit = () => {
      initCreatorCalls++

      return () => init()
    }

    const Counter = () => {
      const [state, actions] = useRailway(createInit(), update)

      useEffect(() => {
        actions.inc()
      }, [actions])

      useEffect(() => {
        setTimeout(actions.inc, 100)
      }, [actions])

      useEffect(() => {
        setTimeout(actions.inc, 200)
      }, [actions])

      renders++

      return h('div', { ['data-testid']: 'result', key: '' }, state)
    }

    const { getByTestId } = render(h(Counter, {}))

    await waitFor(() => {
      expect(getByTestId('result').textContent).toEqual(`${renders - 1}`)
      expect(initCreatorCalls).toEqual(renders)
      expect(initCalls).toEqual(1)
    })
  })

  test('should ignore update object changes', async () => {
    let newUpdateWasCalled = false
    let setNewUpdateWasCalled = false

    type State = number
    type Action = { inc: [] }
    type Injects = Record<string, never>

    const init = () => [0] as const

    const oldUpdate: UpdateMap<State, Action, Injects> = {
      inc: (state) => [state + 1]
    }

    const newUpdate: UpdateMap<State, Action, Injects> = {
      inc: (state) => {
        newUpdateWasCalled = true
        return [state + 100]
      }
    }

    const Counter = () => {
      const [update, setUpdate] = useState(oldUpdate)
      const [state, actions] = useRailway(init, update)

      useEffect(() => {
        actions.inc()
      }, [actions])

      useEffect(() => {
        setTimeout(() => {
          setNewUpdateWasCalled = true
          setUpdate(newUpdate)
        }, 100)
      }, [])

      useEffect(() => {
        setTimeout(actions.inc, 200)
      }, [actions])

      return h('div', { ['data-testid']: 'result', key: '' }, state)
    }

    const { getByTestId } = render(h(Counter, {}))

    await waitFor(() => {
      expect(getByTestId('result').textContent).toEqual(`2`)
      expect(setNewUpdateWasCalled).toBeTruthy()
      expect(newUpdateWasCalled).toBeFalsy()
    })
  })
})
