// One Idempotency-Key per logical attempt of a financial write. Retrying the same payload (lost response,
// double click, timeout) reuses the key, so the server returns the first result instead of writing twice;
// any change in the payload starts a new attempt with a new key.
export function createIdempotentAttempt(newKey = () => crypto.randomUUID()) {
  let current: { key: string; body: string } | null = null
  return {
    keyFor(payload: unknown) {
      const body = JSON.stringify(payload)
      if (!current || current.body !== body) current = { key: newKey(), body }
      return current.key
    },
    /** After a confirmed result: the next submission is a new operation. */
    reset() {
      current = null
    },
  }
}
