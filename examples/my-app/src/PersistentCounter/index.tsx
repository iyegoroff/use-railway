import React, { memo } from 'react'
import { useRailway } from '../use-railway'
import { Counter } from '../Counter'
import { Persistence } from '../Persistence'
import { init, update } from './state'

const injects = Persistence('counter')

export const PersistentCounter = memo(function PersistentCounter() {
  const [state, actions] = useRailway(init, update, injects)

  // eslint-disable-next-line no-null/no-null
  return state === 'loading' ? null : typeof state === 'number' ? (
    <Counter initial={state} onStateChange={actions.persist} />
  ) : (
    <div>{state.persistFailed}</div>
  )
})
