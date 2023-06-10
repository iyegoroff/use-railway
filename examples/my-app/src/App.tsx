import React from 'react'
import { Context } from './Context'
import { PersistentTodos } from './PersistentTodos'
import { FetchQuotes } from './FetchQuotes'
import { PersistentCounter } from './PersistentCounter'

const style = {
  borderColor: 'green',
  borderWidth: '5px',
  borderStyle: 'solid',
  padding: '15px',
  margin: '5px'
} as const

export const App = () => (
  <>
    <div style={style}>
      <h3>Persistent Counter</h3>
      <PersistentCounter />
    </div>
    <div style={style}>
      <h3>Context</h3>
      <Context />
    </div>
    <div style={style}>
      <h3>Persistent Todos</h3>
      <PersistentTodos />
    </div>
    <div style={style}>
      <h3>Fetch Quotes</h3>
      <FetchQuotes />
    </div>
  </>
)
