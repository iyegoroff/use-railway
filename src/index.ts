import { DeepReadonly } from 'ts-deep-readonly'
import { AsyncResult, Result, SomeResult } from 'ts-railway'

/** @internal */
export const dispatch = <Action extends TupleMap>(
  actions: ActionMap<Action>,
  effectResult: EffectResult<Action> | undefined
) => {
  if (effectResult !== undefined) {
    const match = (descriptor: ActionDescriptor<Action> | UndefinedVoid) => {
      if (descriptor !== undefined) {
        const [name, ...params] = descriptor
        actions[name](...params)
      }
    }

    const matcher = {
      success: match,
      failure: match
    }

    if ('then' in effectResult) {
      void AsyncResult.match(matcher, effectResult)
    } else {
      Result.match(matcher, effectResult)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type EffectCallback = () => void | (() => void)

export const createRailway = ({
  useRef,
  useEffect,
  useLayoutEffect,
  useState
}: {
  useRef: <T>(initial: T) => { current: T }
  useEffect: (effect: EffectCallback, deps?: readonly unknown[]) => void
  useLayoutEffect: (effect: EffectCallback, deps?: readonly unknown[]) => void
  useState: <T>(initial: T | (() => T)) => [T, (value: T) => void]
}) => {
  function useRailwayImpl<
    Init extends () => readonly [
      State,
      ...((
        actionCreators: Readonly<
          Record<
            string,
            (...actionArgs: readonly never[]) => readonly [string, ...(readonly never[])]
          >
        >,
        injectMap: InjectMap
      ) => EffectResult<Record<string, readonly never[]>>)[]
    ],
    UpdateMap extends Readonly<
      Record<
        string,
        (
          state: never,
          ...args: never[]
        ) => readonly [
          State,
          ...((
            actionCreators: Readonly<
              Record<
                string,
                (...actionArgs: readonly never[]) => readonly [string, ...(readonly never[])]
              >
            >,
            injectMap: InjectMap
          ) => EffectResult<Record<string, readonly never[]>>)[]
        ]
      >
    >,
    State extends Parameters<UpdateMap[keyof UpdateMap]>[0],
    InjectMap extends UnknownMap
  >(
    init: Init,
    update: UpdateMap,
    injects: InjectMap
  ): readonly [
    PrettyDeepReadonly<State>,
    Readonly<Record<string, (...args: readonly never[]) => undefined>>
  ] {
    const [[initialState, ...initialEffects]] = useState(init)
    const [state, setState] = useState(initialState)
    const mutState = useRef(state)
    const isRunning = useRef(true)
    const isInit = useRef(false)
    const effects = useRef(initialEffects)
    const deps = useRef(injects)

    useLayoutEffect(() => {
      deps.current = injects
    }, [injects])

    const [actionCreators] = useState(() =>
      Object.fromEntries(
        Object.entries(update).map(([tag]) => [
          tag,
          (...args: readonly never[]) => [tag, ...args] as const
        ])
      )
    )

    const [actions] = useState(() =>
      Object.fromEntries(
        Object.entries(update).map(([tag, up]) => [
          tag,
          (...args: readonly never[]): undefined => {
            if (isRunning.current) {
              const effs = effects.current

              while (!isInit.current && effs.length > 0) {
                dispatch(actions, effs.pop()?.(actionCreators, deps.current))
              }

              isInit.current = true

              const [nextState, ...nextEffects] = up(mutState.current, ...args)

              if (!Object.is(nextState, mutState.current)) {
                mutState.current = nextState
                setState(nextState)
              }

              effs.unshift(...nextEffects)

              while (effs.length > 0) {
                dispatch(actions, effs.shift()?.(actionCreators, deps.current))
              }
            }
          }
        ])
      )
    )

    useEffect(() => {
      isRunning.current = true

      const effs = effects.current

      while (effs.length > 0) {
        dispatch(actions, effs.pop()?.(actionCreators, deps.current))
      }

      isInit.current = true

      return () => {
        isRunning.current = false
        isInit.current = false
        effects.current = []
      }
    }, [actions, actionCreators])

    return [state, actions]
  }

  function useRailway<
    Init extends () => readonly [
      State,
      ...((actionCreators: Creators, injects: InjectMap) => EffectResult<Action>)[]
    ],
    UpdateMap extends Readonly<
      Record<
        string,
        (
          state: never,
          ...args: never[]
        ) => readonly [
          State,
          ...((actionCreators: Creators, injects: InjectMap) => EffectResult<Action>)[]
        ]
      >
    >,
    State extends Parameters<UpdateMap[keyof UpdateMap]>[0],
    Actions extends {
      readonly [Key in keyof UpdateMap]: Parameters<UpdateMap[Key]> extends [unknown, ...infer Rest]
        ? (...args: Rest) => undefined
        : never
    },
    Creators extends {
      readonly [Key in keyof UpdateMap]: Parameters<UpdateMap[Key]> extends [unknown, ...infer Rest]
        ? (...args: Rest) => readonly [Key, ...Rest]
        : never
    },
    Action extends {
      readonly [Key in keyof UpdateMap]: Parameters<UpdateMap[Key]> extends [unknown, ...infer Rest]
        ? Rest
        : never
    },
    InjectMap extends UnknownMap = NeverMap
  >(
    init: Init,
    update: UpdateMap,
    injects?: InjectMap
  ): readonly [PrettyDeepReadonly<State>, Actions]

  function useRailway<
    Init extends () => readonly [
      State,
      ...((
        actionCreators: Readonly<
          Record<
            string,
            (...actionArgs: readonly never[]) => readonly [string, ...(readonly never[])]
          >
        >,
        injectMap: UnknownMap
      ) => EffectResult<Record<string, readonly never[]>>)[]
    ],
    UpdateMap extends Readonly<
      Record<
        string,
        (
          state: never,
          ...args: never[]
        ) => readonly [
          State,
          ...((
            actionCreators: Readonly<
              Record<
                string,
                (...actionArgs: readonly never[]) => readonly [string, ...(readonly never[])]
              >
            >,
            injectMap: UnknownMap
          ) => EffectResult<Record<string, readonly never[]>>)[]
        ]
      >
    >,
    State extends Parameters<UpdateMap[keyof UpdateMap]>[0],
    InjectMap extends UnknownMap
  >(
    init: Init,
    update: UpdateMap,
    injects?: InjectMap
  ): readonly [
    PrettyDeepReadonly<State>,
    Readonly<Record<string, (...args: readonly never[]) => undefined>>
  ] {
    return useRailwayImpl(init, update, injects ?? {})
  }

  return useRailway
}

type PrettyType<V> = V extends (...args: never[]) => unknown
  ? V
  : Extract<{ [K in keyof V]: V[K] }, unknown>

type PrettyDeepReadonly<T> = DeepReadonly<T>

type NeverMap = Readonly<Record<string, never>>

type UnknownMap = Readonly<Record<string, unknown>>

type TupleMap = Readonly<Record<string, readonly unknown[]>>

export type ActionMap<Action extends TupleMap> = PrettyType<
  Readonly<{
    [Key in keyof Action]: (...args: Action[Key]) => undefined
  }>
>

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type UndefinedVoid = undefined | void

type ActionCreators<Action extends TupleMap> = PrettyType<
  Readonly<{
    [Key in keyof Action]: (...args: Action[Key]) => readonly [action: Key, ...params: Action[Key]]
  }>
>

type ActionDescriptor<Action extends TupleMap> = {
  [Key in keyof Action]: readonly [action: Key, ...params: Action[Key]]
}[keyof Action]

type EffectResult<Action extends TupleMap> = SomeResult<
  ActionDescriptor<Action> | UndefinedVoid,
  ActionDescriptor<Action>
>

export type Effect<Action extends TupleMap, InjectMap extends UnknownMap = NeverMap> = (
  actionCreators: ActionCreators<Action>,
  injects: DeepReadonly<InjectMap>
) => EffectResult<Action>

export type Command<
  State,
  Action extends TupleMap,
  InjectMap extends UnknownMap = NeverMap
> = readonly [State, ...(readonly Effect<Action, DeepReadonly<InjectMap>>[])]

export type UpdateMap<
  State,
  Action extends TupleMap,
  InjectMap extends UnknownMap = NeverMap
> = UpdateMapImpl<DeepReadonly<State>, Action, InjectMap, Action>

type UpdateMapImpl<
  State,
  Action extends TupleMap,
  InjectMap extends UnknownMap,
  CombinedAction extends Action
> = PrettyType<
  Readonly<{
    [Key in keyof Action]: (
      state: State,
      ...args: Action[Key]
    ) => Command<State, CombinedAction, InjectMap>
  }>
>
