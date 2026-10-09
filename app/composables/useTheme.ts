import {
  resolveTheme,
  validPreference,
  themeStorageKey,
} from '~/design-core/theme'
import type { ThemePreference } from '~/design-core/theme'

export function useTheme() {
  const preference = useState<ThemePreference>(
    'theme.preference',
    () => 'system',
  )
  const resolved = useState<'light' | 'dark'>('theme.resolved', () => 'light')
  return {
    preference,
    resolved,
    setPreference: (value: string) => {
      preference.value = validPreference(value)
    },
  }
}
export function installTheme() {
  const { preference, resolved } = useTheme()
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  try {
    preference.value = validPreference(localStorage.getItem(themeStorageKey))
  } catch {
    /* Storage can be unavailable. */
  }
  function apply() {
    resolved.value = resolveTheme(preference.value, media.matches)
    document.documentElement.dataset.theme = resolved.value
    document.documentElement.style.colorScheme = resolved.value
  }
  apply()
  watch(preference, () => {
    try {
      localStorage.setItem(themeStorageKey, preference.value)
    } catch {
      /* Visual preference is optional. */
    }
    apply()
  })
  media.addEventListener('change', apply)
  useNuxtApp().vueApp.onUnmount(() =>
    media.removeEventListener('change', apply),
  )
}
