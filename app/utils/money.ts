// Money helpers working on decimal strings and integer cents only (never floating point for values).
const MAX_CENTS = 99_999_999_999n // R$ 999.999.999,99, the limit accepted by the API

export type MoneyParse =
  { ok: true; value: string } | { ok: false; error: string }

/**
 * Normalizes what a person types (pt-BR) into the API's canonical string, refusing instead of rounding.
 * "1.000,50" → "1000.50"; "1000,5" → "1000.50"; "1000" → "1000.00"; "1.5" → "1.50"; "1.000" → "1000.00".
 */
export function parseMoneyInput(input: string): MoneyParse {
  const text = input
    .trim()
    .replace(/^R\$\s*/i, '')
    .replace(/\s/g, '')
  if (!text) return { ok: false, error: 'Informe o valor.' }
  let integer: string
  let decimals = ''
  if (text.includes(',')) {
    const [whole, fraction, ...rest] = text.split(',')
    if (rest.length || !/^\d{1,3}(\.\d{3})*$|^\d+$/.test(whole ?? ''))
      return { ok: false, error: 'Use um valor como 1.000,50.' }
    integer = whole!.replace(/\./g, '')
    decimals = fraction ?? ''
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    integer = text.replace(/\./g, '') // dots as thousands separators
  } else if (/^\d+(\.\d+)?$/.test(text)) {
    ;[integer, decimals = ''] = text.split('.') as [string, string?]
  } else {
    return { ok: false, error: 'Use apenas números, por exemplo 1.000,50.' }
  }
  if (!/^\d*$/.test(decimals))
    return { ok: false, error: 'Use apenas números, por exemplo 1.000,50.' }
  if (decimals.length > 2)
    return { ok: false, error: 'Use no máximo duas casas decimais.' }
  const cents =
    BigInt(integer || '0') * 100n + BigInt(decimals.padEnd(2, '0') || '0')
  if (cents <= 0n)
    return { ok: false, error: 'O valor precisa ser maior que zero.' }
  if (cents > MAX_CENTS)
    return { ok: false, error: 'O valor máximo aceito é R$ 999.999.999,99.' }
  return { ok: true, value: centsToString(cents) }
}

export function toCents(value: string): bigint {
  const match = /^(-)?(\d+)\.(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid money string: ${value}`)
  const cents = BigInt(match[2]!) * 100n + BigInt(match[3]!)
  return match[1] ? -cents : cents
}

export function centsToString(cents: bigint): string {
  const sign = cents < 0n ? '-' : ''
  const abs = cents < 0n ? -cents : cents
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`
}

/** "1000.50" → "1.000,50", for showing a normalized value back in an input. */
export function formatMoneyInput(value: string): string {
  return formatMoney(value).replace('R$ ', '')
}

/** "1000.50" → "R$ 1.000,50" (formatting only; the server owns every calculation). */
export function formatMoney(value: string): string {
  const cents = toCents(value)
  const sign = cents < 0n ? '-' : ''
  const abs = cents < 0n ? -cents : cents
  const integer = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}R$ ${integer},${(abs % 100n).toString().padStart(2, '0')}`
}
