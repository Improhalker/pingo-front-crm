import type { MaybeRefOrGetter } from 'vue'

export interface PageCrumb {
  label: string
  to?: string
}
export interface PageHeading {
  title: string
  crumbs?: PageCrumb[]
}

/**
 * The page title is rendered as the single <h1> inside the shell navbar (direction B). Pages declare
 * it here; the document title follows it.
 */
export function usePageHeading(heading?: MaybeRefOrGetter<PageHeading>) {
  const state = useState<PageHeading>('page.heading', () => ({ title: '' }))
  if (heading !== undefined) {
    watchEffect(() => {
      state.value = toValue(heading)
    })
    useHead(() => ({
      title: state.value.title ? `${state.value.title} · PingoFin` : 'PingoFin',
    }))
  }
  return state
}
