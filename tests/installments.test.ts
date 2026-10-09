import { describe, expect, it } from 'vitest'
import {
  addMonthsKeepingDay,
  buildPreview,
  scheduleDifference,
  splitCents,
} from '../app/utils/installments'
import { correctionEffect } from '../app/utils/settlement-correction'

describe('instalment preview (card 10)', () => {
  it('splits whole cents and leaves the remainder on the last part', () => {
    expect(splitCents('100.00', 3)).toEqual(['33.33', '33.33', '33.34'])
    expect(splitCents('0.05', 3)).toEqual(['0.01', '0.01', '0.03'])
    expect(splitCents('800.00', 4)).toEqual([
      '200.00',
      '200.00',
      '200.00',
      '200.00',
    ])
  })

  it('uses the last day of shorter months and returns to the original day', () => {
    expect(
      [0, 1, 2, 3].map((n) => addMonthsKeepingDay('2027-01-31', n)),
    ).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'])
    expect(addMonthsKeepingDay('2028-01-30', 1)).toBe('2028-02-29')
    expect(addMonthsKeepingDay('2026-12-15', 1)).toBe('2027-01-15')
  })

  it('builds the acceptance schedule: 1200 with 400 down and four instalments of 200', () => {
    const lines = buildPreview({
      total: '1200.00',
      downPayment: '400.00',
      count: 4,
      firstDue: '2026-11-10',
      method: 'PIX',
      reminderDaysBefore: 2,
      downPaymentDue: '2026-10-08',
      downPaymentMethod: 'CASH',
    })
    expect(lines.map((line) => line.amount)).toEqual([
      '400.00',
      '200.00',
      '200.00',
      '200.00',
      '200.00',
    ])
    expect(lines[0]!.down_payment).toBe(true)
    expect(lines.slice(1).map((line) => line.due_date)).toEqual([
      '2026-11-10',
      '2026-12-10',
      '2027-01-10',
      '2027-02-10',
    ])
    expect(lines[1]!.reminder_date).toBe('2026-11-08')
    expect(
      scheduleDifference(
        '1200.00',
        lines.map((line) => line.amount),
      ),
    ).toBe('0.00')
    expect(scheduleDifference('1200.00', ['400.00', '799.99'])).toBe('0.01')
  })

  it('refuses a down payment equal to or above the total', () => {
    expect(() =>
      buildPreview({
        total: '100.00',
        downPayment: '100.00',
        count: 2,
        firstDue: '2026-11-10',
        method: 'PIX',
        reminderDaysBefore: null,
        downPaymentDue: '2026-10-08',
        downPaymentMethod: 'PIX',
      }),
    ).toThrow()
  })
})

describe('correction review (card 09)', () => {
  it('shows the effect of correcting 500 to 400 on a 500 instalment', () => {
    expect(correctionEffect('500.00', '500.00', '500.00', '400.00')).toEqual({
      difference: '-100.00',
      settledBefore: '500.00',
      settledAfter: '400.00',
      remainingBefore: '0.00',
      remainingAfter: '100.00',
      limit: '500.00',
      exceeds: false,
    })
  })

  it('flags a correction above what the instalment allows', () => {
    const effect = correctionEffect('500.00', '450.00', '400.00', '460.00')
    expect(effect.limit).toBe('450.00')
    expect(effect.exceeds).toBe(true)
  })
})
