/** Carries a message that is safe to show to the user verbatim. */
export class PixenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PixenError'
  }
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.'

/**
 * Rust commands reject with a plain sentence and Pixen's own failures use
 * `PixenError`. Anything else is unexpected, so it is logged for developers
 * and replaced with a generic sentence rather than leaking internals.
 */
export const toUserMessage = (error: unknown, fallback = FALLBACK_MESSAGE): string => {
  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  if (error instanceof PixenError && error.message.trim()) {
    return error.message.trim()
  }

  console.error('[pixen]', error)

  return fallback
}
