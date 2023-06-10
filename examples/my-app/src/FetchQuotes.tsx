import React, { memo } from 'react'
import { object, string } from 'spectypes'
import { Command, UpdateMap, useRailway } from './use-railway'
import { gap } from './gap'
import { AsyncResult, Result } from 'ts-railway'
import { errorMessage } from './util'
import { pipeWith } from 'pipe-ts'

type State = {
  status: 'idle' | 'loading' | { error: string }
  quotes: string[]
}

type Action = {
  requestQuote: []
  success: [quote: string]
  failure: [error: unknown]
  clear: []
}

type Injects = { fetchQuote: () => AsyncResult<string> }

const init = (requestQuoteOnInit: boolean): Command<State, Action, Injects> => {
  const state: State = { status: 'idle', quotes: [] }

  return requestQuoteOnInit
    ? [state, ({ requestQuote }) => Result.success(requestQuote())]
    : [state]
}

const update: UpdateMap<State, Action, Injects> = {
  requestQuote: (state) => [
    { ...state, status: 'loading' },
    ({ success, failure }, { fetchQuote }) =>
      pipeWith(fetchQuote(), AsyncResult.map(success), AsyncResult.mapError(failure))
  ],

  success: ({ quotes }, quote) => [{ status: 'idle', quotes: [...quotes, quote] }],

  failure: ({ quotes }, error) => [{ status: { error: errorMessage(error) }, quotes }],

  clear: (state) => [state.quotes.length === 0 ? state : { ...state, quotes: [] }]
}

const checkBody = object({
  quote: string
})

const fetchQuote = () =>
  fetch('https://api.kanye.rest')
    .then((response) => response.json())
    .then(checkBody)
    .then(Result.map(({ quote }) => quote))

export const FetchQuotes = memo(function FetchQuotes() {
  const [{ status, quotes }, actions] = useRailway(() => init(true), update, { fetchQuote })
  const [message, color] = typeof status === 'string' ? [status, 'black'] : [status.error, 'red']

  return (
    <div>
      <button onClick={actions.requestQuote}>request quote</button>
      {gap}
      <button onClick={actions.clear}>clear</button>
      {gap}
      <div style={{ color }}>{message}</div>
      <ul>
        {quotes.map((quote, idx) => (
          <li key={idx}>{quote}</li>
        ))}
      </ul>
    </div>
  )
})
