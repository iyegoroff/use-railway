import { pipeWith } from 'pipe-ts'
import { Result } from 'ts-railway'
import { Command, UpdateMap } from 'use-railway'

type State = 'loading' | { persistFailed: string } | number

type Action = {
  loaded: [count: number]
  persist: [count: number]
  persistFailed: [message: string]
}

type Injects = ReturnType<typeof import('../Persistence').Persistence>

export const init = (): Command<State, Action, Injects> => [
  'loading',
  ({ loaded }, { load }) => Result.map((value) => loaded(Number(value) || 0), load())
]

export const update: UpdateMap<State, Action, Injects> = {
  loaded: (_, count) => [count],

  persist: (state, count) => [
    state,
    ({ persistFailed }, { store }) =>
      pipeWith(store(JSON.stringify(count)), Result.mapError(persistFailed))
  ],

  persistFailed: (_, message) => [{ persistFailed: message }]
}
