// Created per Nuxt application, never as mutable module-global state.
export function createLatestRequest() {
  let generation = 0
  let controller: AbortController | undefined
  function cancel() {
    generation++
    controller?.abort()
    controller = undefined
  }
  function begin() {
    cancel()
    controller = new AbortController()
    const current = generation
    return {
      signal: controller.signal,
      isCurrent: () => current === generation,
    }
  }
  return { begin, cancel }
}
