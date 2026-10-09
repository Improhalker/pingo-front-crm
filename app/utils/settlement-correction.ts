// Review of a receipt/payment correction before confirming (card 09). Display only: the server recalculates
// everything inside the transaction and refuses a stale version.
import { centsToString, toCents } from './money'

export interface CorrectionEffect {
  /** corrected − original: negative means less money received/paid. */
  difference: string
  settledBefore: string
  settledAfter: string
  remainingBefore: string
  remainingAfter: string
  /** Largest corrected amount this instalment accepts. */
  limit: string
  exceeds: boolean
}

export function correctionEffect(
  installmentAmount: string,
  installmentSettled: string,
  originalAmount: string,
  correctedAmount: string,
): CorrectionEffect {
  const amount = toCents(installmentAmount)
  const before = toCents(installmentSettled)
  const original = toCents(originalAmount)
  const corrected = toCents(correctedAmount)
  const after = before - original + corrected
  return {
    difference: centsToString(corrected - original),
    settledBefore: centsToString(before),
    settledAfter: centsToString(after),
    remainingBefore: centsToString(amount - before),
    remainingAfter: centsToString(amount - after),
    limit: centsToString(amount - (before - original)),
    exceeds: after > amount,
  }
}
