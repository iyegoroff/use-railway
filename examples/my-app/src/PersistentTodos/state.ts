import {
  array,
  boolean,
  literal,
  map,
  number,
  object,
  optional,
  Spectype,
  string,
  template,
  tuple,
  union
} from 'spectypes'
import { Command, UpdateMap } from 'use-railway'
import { Result } from 'ts-railway'
import { mapOf } from 'fun-constructors'
import { pipeWith } from 'pipe-ts'

type LoadedState = Spectype<typeof checkState>

type State = 'loading' | { persistFailed: string } | LoadedState

type Action = {
  loaded: [state: LoadedState]
  persist: [state: LoadedState]
  persistFailed: [message: string]
}

type Injects = ReturnType<typeof import('../Persistence').Persistence>

const checkState = object({
  nextId: number,
  filter: union(literal('done'), literal('active'), literal('all')),
  nextTodoText: optional(string),
  editedId: optional(template(number)),
  todos: map(
    array(
      tuple(
        template(number),
        object({
          done: boolean,
          text: string
        })
      )
    ),
    mapOf
  )
})

const defaultState: State = { nextId: 0, filter: 'all', todos: new Map() }

export const init = (): Command<State, Action, Injects> => [
  'loading',
  ({ loaded }, { load }) =>
    pipeWith(
      load(),
      Result.flatMap((value) =>
        value === undefined ? Result.success(defaultState) : checkState(value)
      ),
      Result.map(loaded),
      Result.mapError(() => loaded(defaultState))
    )
]

export const update: UpdateMap<State, Action, Injects> = {
  loaded: (_, state) => [state],

  persist: (initial, state) => [
    initial,
    ({ persistFailed }, { store }) =>
      pipeWith(
        JSON.stringify(state, (__, val: unknown) =>
          val instanceof Map ? [...(val as Map<unknown, unknown>)] : val
        ),
        store,
        Result.mapError(persistFailed)
      )
  ],

  persistFailed: (_, message) => [{ persistFailed: message }]
}
