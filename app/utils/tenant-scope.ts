export interface RequestTicket {
  signal: AbortSignal
  isCurrent: () => boolean
}

// Every company-data request joins the scope of the open organization. reset() (organization change or
// end of session) aborts all of them at once, so a late response can never reach another context.
// Created per Nuxt application, never as mutable module-global state.
export function createTenantScope() {
  let generation = 0
  let controller = new AbortController()
  return {
    /** Ticket for the current organization, optionally combined with a page's latest-request lane. */
    join(lane?: RequestTicket): RequestTicket {
      const current = generation
      return {
        signal: lane
          ? AbortSignal.any([controller.signal, lane.signal])
          : controller.signal,
        isCurrent: () => current === generation && (lane?.isCurrent() ?? true),
      }
    },
    reset() {
      generation++
      controller.abort()
      controller = new AbortController()
    },
  }
}
