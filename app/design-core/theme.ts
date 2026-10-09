export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export const themeStorageKey = 'pingofin.theme'
// Operational default for the bootstrap; final product preference remains TBD.
export function validPreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}
export function resolveTheme(
  preference: ThemePreference,
  darkSystem: boolean,
): ResolvedTheme {
  return preference === 'system' ? (darkSystem ? 'dark' : 'light') : preference
}
export const themeInitializationScript = `(function(){var p='system';try{p=localStorage.getItem('${themeStorageKey}')||p}catch(e){}var t=p==='light'||p==='dark'?p:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})()`
