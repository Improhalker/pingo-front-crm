import { describe, expect, it } from 'vitest'
import {
  reportChangeLabel,
  reportEntryLink,
  reportInstallmentLabel,
  reportMonthBounds,
  reportMonthRangeError,
  reportPeriodError,
  reportResultLabel,
  reportShareLabel,
  reportShiftMonth,
  reportToneOf,
} from '../app/utils/reports'

describe('report presentation (card 11)', () => {
  it('writes the result out and keeps the tone exact', () => {
    expect(reportToneOf('0.01')).toBe('positive')
    expect(reportToneOf('-0.01')).toBe('negative')
    expect(reportToneOf('0.00')).toBe('zero')
    expect(reportResultLabel('-10.00')).toBe('Negativo')
    expect(reportResultLabel('0.00')).toBe('Zerado')
  })

  it('compares a month with the previous one', () => {
    expect(reportChangeLabel(null)).toBe('Primeiro mês do período')
    expect(reportChangeLabel('220.00')).toBe(
      'R$ 220,00 a mais que o mês anterior',
    )
    expect(reportChangeLabel('-1234.56')).toBe(
      'R$ 1.234,56 a menos que o mês anterior',
    )
    expect(reportChangeLabel('0.00')).toBe('Igual ao mês anterior')
  })

  it('formats shares from basis points without floats', () => {
    expect(reportShareLabel(5555)).toBe('55,55%')
    expect(reportShareLabel(10000)).toBe('100,00%')
    expect(reportShareLabel(7)).toBe('0,07%')
  })

  it('labels the down payment apart from the instalments', () => {
    expect(
      reportInstallmentLabel({
        sequence: 1,
        number: 0,
        total: 4,
        is_down_payment: true,
      }),
    ).toBe('Entrada')
    expect(
      reportInstallmentLabel({
        sequence: 2,
        number: 1,
        total: 4,
        is_down_payment: false,
      }),
    ).toBe('Parcela 1 de 4')
    expect(
      reportInstallmentLabel({
        sequence: 1,
        number: 1,
        total: 1,
        is_down_payment: false,
      }),
    ).toBe('Parcela única')
  })

  it('validates periods like the server', () => {
    expect(reportPeriodError('2024-01-01', '2024-12-31')).toBe('')
    expect(reportPeriodError('2026-01-01', '2027-01-01')).toBe('')
    expect(reportPeriodError('2026-01-01', '2027-01-02')).toBe(
      'Escolha um período de até 366 dias.',
    )
    expect(reportPeriodError('2026-10-10', '2026-10-01')).toBe(
      'O fim do período não pode ser anterior ao início.',
    )
    expect(reportPeriodError('', '2026-10-01')).toBe('')
    expect(reportMonthRangeError('2025-11', '2026-10')).toBe('')
    expect(reportMonthRangeError('2025-10', '2026-10')).toBe(
      'Escolha até 12 meses.',
    )
    expect(reportMonthRangeError('2026-10', '2026-09')).toBe(
      'O mês final não pode ser anterior ao inicial.',
    )
  })

  it('moves across months and years', () => {
    expect(reportShiftMonth('2026-10', -5)).toBe('2026-05')
    expect(reportShiftMonth('2026-01', -1)).toBe('2025-12')
    expect(reportShiftMonth('2026-12', 1)).toBe('2027-01')
    expect(reportMonthBounds('2024-02')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    })
    expect(reportMonthBounds('2026-10').to).toBe('2026-10-31')
  })

  it('opens the authorized entry on the instalment', () => {
    expect(reportEntryLink(true, '12', '30')).toBe('/receitas/12?parcela=30')
    expect(reportEntryLink(false, '7')).toBe('/despesas/7')
  })
})
