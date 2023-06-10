import { Result } from 'ts-railway'
import { errorMessage } from './util'

export const Persistence = (key: string) => ({
  load: () => Result.success(localStorage.getItem(key) ?? undefined),

  store: (value: string) => {
    try {
      return Result.success(localStorage.setItem(key, value))
    } catch (error) {
      return Result.failure(errorMessage(error))
    }
  }
})
