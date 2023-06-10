import React, { memo, useEffect } from 'react'
import { useRailway } from '../use-railway'
import { init, update, CounterState } from './state'

type CounterProps = {
  readonly initial: CounterState
  readonly onStateChange: (state: CounterState) => void
}

export const Counter = memo(function Counter({ initial, onStateChange }: CounterProps) {
  const [state, actions] = useRailway(() => init(initial), update)

  useEffect(() => {
    onStateChange(state)
  }, [state, onStateChange])

  return (
    <>
      <div>{state}</div>
      <button onClick={actions.inc}>inc</button>
      <button onClick={actions.dec}>dec</button>
    </>
  )
})
