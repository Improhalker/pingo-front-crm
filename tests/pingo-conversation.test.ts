import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PINGO_MESSAGE_MAX_LENGTH,
  PINGO_STATE_KEYS,
  createPingoConversation,
  pingoContextKey,
  sendPingoMessage,
  setPingoOpen,
  syncPingoContext,
} from '../app/utils/pingo-conversation'

afterEach(() => vi.unstubAllGlobals())

describe('Pingo panel open/close', () => {
  it('starts closed and opening or closing keeps the conversation and draft', () => {
    const state = createPingoConversation('u1:org1')
    expect(state.open).toBe(false)
    state.draft = 'Primeira mensagem'
    sendPingoMessage(state)
    state.draft = 'rascunho'
    setPingoOpen(state, true)
    expect(state.open).toBe(true)
    setPingoOpen(state, false)
    expect(state.open).toBe(false)
    expect(state.messages.map((m) => m.text)).toEqual(['Primeira mensagem'])
    expect(state.draft).toBe('rascunho')
  })
})

describe('Pingo messages', () => {
  it('refuses empty, whitespace-only and oversized drafts without changing anything', () => {
    const state = createPingoConversation('u1:org1')
    for (const draft of [
      '',
      '   ',
      '\n\t ',
      'x'.repeat(PINGO_MESSAGE_MAX_LENGTH + 1),
    ]) {
      state.draft = draft
      expect(sendPingoMessage(state)).toBe(false)
    }
    expect(state.messages).toEqual([])
  })

  it('stores markup as literal text, trimmed, and clears the draft', () => {
    const state = createPingoConversation('u1:org1')
    state.draft = '  <img src=x onerror=alert(1)> <b>negrito</b>  '
    expect(sendPingoMessage(state)).toBe(true)
    expect(state.messages).toEqual([
      {
        id: 1,
        author: 'user',
        text: '<img src=x onerror=alert(1)> <b>negrito</b>',
      },
    ])
    expect(state.draft).toBe('')
  })

  it('never adds an answer, analysis or entry: only what the person typed', () => {
    const state = createPingoConversation('u1:org1')
    for (const text of ['Quanto tenho a receber?', 'Registre R$ 50,00']) {
      state.draft = text
      sendPingoMessage(state)
    }
    expect(state.messages).toHaveLength(2)
    expect(state.messages.every((m) => m.author === 'user')).toBe(true)
  })
})

describe('Pingo context lifetime', () => {
  it('keys the conversation by identity and context, never without both', () => {
    expect(pingoContextKey('u1', 'org1')).toBe('u1:org1')
    expect(pingoContextKey('u1', 'platform')).toBe('u1:platform')
    expect(pingoContextKey(null, 'org1')).toBeNull()
    expect(pingoContextKey('u1', undefined)).toBeNull()
    expect(pingoContextKey('u1', 'org1')).not.toBe(
      pingoContextKey('u2', 'org1'),
    )
  })

  it('keeps the conversation in the same context and clears it on organization, identity or logout changes', () => {
    const state = createPingoConversation(pingoContextKey('u1', 'org1'))
    state.draft = 'Olá'
    sendPingoMessage(state)
    state.draft = 'meio escrito'
    setPingoOpen(state, true)

    syncPingoContext(state, pingoContextKey('u1', 'org1'))
    expect(state.messages).toHaveLength(1)

    for (const next of [
      pingoContextKey('u1', 'org2'),
      pingoContextKey('u2', 'org2'),
      pingoContextKey(null, null),
    ]) {
      state.draft = 'rascunho'
      state.messages.push({ id: 99, author: 'user', text: 'antiga' })
      setPingoOpen(state, true)
      syncPingoContext(state, next)
      expect(state).toEqual(createPingoConversation(next))
    }
  })

  it('is reset by the session through its useState key', () => {
    expect(PINGO_STATE_KEYS).toEqual(['pingo.conversation'])
  })
})

describe('Pingo persistence', () => {
  it('never writes to browser storage', () => {
    const storage = () => ({
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
    const local = storage()
    const session = storage()
    vi.stubGlobal('localStorage', local)
    vi.stubGlobal('sessionStorage', session)
    const state = createPingoConversation('u1:org1')
    state.draft = 'mensagem'
    sendPingoMessage(state)
    setPingoOpen(state, true)
    syncPingoContext(state, 'u1:org2')
    for (const store of [local, session])
      expect(store.setItem).not.toHaveBeenCalled()
  })
})
