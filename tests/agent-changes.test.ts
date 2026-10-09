import { describe, expect, it, vi } from 'vitest'
import { validateAgentChanges } from '../shared/utils/agent-changes'
import { checkMasterSession } from '../server/utils/master-session'

function example(summary = 'Histórico criado.') {
  return {
    schemaVersion: 1,
    changes: [
      {
        id: 'test-change',
        occurredAt: '2026-10-05T21:04:00.000Z',
        agent: 'Agente de teste',
        summary,
      },
    ],
    details: [],
  }
}

describe('agent change log contract', () => {
  it('allows exactly 300 Unicode characters and rejects 301', () => {
    expect(
      validateAgentChanges(example('🟣'.repeat(300))).changes,
    ).toHaveLength(1)
    expect(() => validateAgentChanges(example('🟣'.repeat(301)))).toThrow(
      '300 caracteres',
    )
  })

  it.each(['', '   ', ' texto '])(
    'rejects empty/untrimmed summary %j',
    (summary) => {
      expect(() => validateAgentChanges(example(summary))).toThrow(
        'texto obrigatório',
      )
    },
  )

  it('rejects duplicate change IDs, invalid dates, and unknown fields', () => {
    const duplicate = example()
    duplicate.changes.push({ ...duplicate.changes[0]! })
    expect(() => validateAgentChanges(duplicate)).toThrow('duplicado')
    const invalid = example()
    invalid.changes[0]!.occurredAt = 'ontem'
    expect(() => validateAgentChanges(invalid)).toThrow('ISO UTC')
    expect(() =>
      validateAgentChanges({
        ...example(),
        secret: 'do not allow fields outside the contract',
      }),
    ).toThrow('campo desconhecido')
  })

  it('requires matching detail objects and keeps each detail section short', () => {
    const change = { ...example().changes[0]!, detailsId: 'detail-test' }
    const detail = {
      id: 'detail-test',
      changeId: change.id,
      sections: [{ title: 'Acesso', text: 'Somente master.' }],
    }
    expect(
      validateAgentChanges({
        schemaVersion: 1,
        changes: [change],
        details: [detail],
      }).details,
    ).toHaveLength(1)
    expect(() =>
      validateAgentChanges({
        schemaVersion: 1,
        changes: [change, { ...change, id: 'other-change' }],
        details: [detail],
      }),
    ).toThrow('outra alteração')
    expect(() =>
      validateAgentChanges({
        schemaVersion: 1,
        changes: [change],
        details: [],
      }),
    ).toThrow('inexistente')
    expect(() =>
      validateAgentChanges({
        schemaVersion: 1,
        changes: [change],
        details: [{ ...detail, changeId: 'other-change' }],
      }),
    ).toThrow('correspondente')
    detail.sections[0]!.text = 'x'.repeat(301)
    expect(() =>
      validateAgentChanges({
        schemaVersion: 1,
        changes: [change],
        details: [detail],
      }),
    ).toThrow('300 caracteres')
  })
})

describe('master-only delivery of frontend JSON', () => {
  it('rejects visitors before making an upstream request', async () => {
    const read = vi.fn()
    expect(
      await checkMasterSession(
        'http://localhost:8000',
        undefined,
        'http://localhost:3000',
        read,
      ),
    ).toBe('unauthenticated')
    expect(read).not.toHaveBeenCalled()
  })

  it.each([
    {
      data: {
        is_platform_administrator: false,
        organizations: [{ role: 'ADMIN' }],
      },
    },
    {
      data: {
        is_platform_administrator: false,
        organizations: [{ role: 'OPERATOR' }],
      },
    },
    { data: { is_platform_administrator: 'true' } },
    { data: { role: 'MASTER' } },
    {},
    null,
  ])(
    'does not grant master access to other roles or malformed responses %j',
    async (response) => {
      expect(
        await checkMasterSession(
          'http://localhost:8000',
          'session=test',
          'http://localhost:3000',
          vi.fn().mockResolvedValue(response),
        ),
      ).toBe('forbidden')
    },
  )

  it('accepts only the verified master and forwards the session without tenant headers', async () => {
    const read = vi
      .fn()
      .mockResolvedValue({ data: { is_platform_administrator: true } })
    expect(
      await checkMasterSession(
        'http://localhost:8000/',
        'session=test',
        'http://localhost:3000',
        read,
      ),
    ).toBe('allowed')
    expect(read).toHaveBeenCalledWith('http://localhost:8000/api/v1/auth/me', {
      headers: {
        Accept: 'application/json',
        Cookie: 'session=test',
        Origin: 'http://localhost:3000',
        Referer: 'http://localhost:3000/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      retry: 0,
      timeout: 5000,
      redirect: 'error',
    })
  })

  it.each([
    [401, 'unauthenticated'],
    [419, 'unauthenticated'],
    [403, 'forbidden'],
    [500, 'unavailable'],
  ])('fails closed on upstream %i', async (statusCode, expected) => {
    const read = vi.fn().mockRejectedValue({ statusCode })
    expect(
      await checkMasterSession(
        'http://localhost:8000',
        'session=test',
        'http://localhost:3000',
        read,
      ),
    ).toBe(expected)
  })

  it('fails closed on connection loss', async () => {
    expect(
      await checkMasterSession(
        'http://localhost:8000',
        'session=test',
        'http://localhost:3000',
        vi.fn().mockRejectedValue(new Error('offline')),
      ),
    ).toBe('unavailable')
  })
})
