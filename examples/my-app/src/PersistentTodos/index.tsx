import React, { memo } from 'react'
import { useRailway } from '../use-railway'
import { init, update } from './state'
import { Todos } from '../Todos'
import { Persistence } from '../Persistence'

const injects = Persistence('todos')

export const PersistentTodos = memo(function PersistentTodos() {
  const [state, actions] = useRailway(init, update, injects)

  // eslint-disable-next-line no-null/no-null
  return state === 'loading' ? null : 'persistFailed' in state ? (
    <div>{state.persistFailed}</div>
  ) : (
    <Todos initial={state} onStateChange={actions.persist} />
  )
})
