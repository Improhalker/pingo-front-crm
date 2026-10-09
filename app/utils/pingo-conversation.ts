// Local Pingo conversation. Plain data kept only in memory: no API, no generated answers, no
// persistence. Messages are stored as typed and must be rendered as text (never as HTML).
export const PINGO_MESSAGE_MAX_LENGTH = 2000

/** useState keys cleared by useSession on organization change, logout and identity change. */
export const PINGO_STATE_KEYS = ['pingo.conversation']

export interface PingoMessage {
  id: number
  author: 'user'
  text: string
}

export interface PingoConversationState {
  /** Identity + context the conversation belongs to; any change discards it. */
  contextKey: string | null
  open: boolean
  messages: PingoMessage[]
  draft: string
  nextId: number
}

export function createPingoConversation(
  contextKey: string | null = null,
): PingoConversationState {
  return { contextKey, open: false, messages: [], draft: '', nextId: 1 }
}

/** Builds the key from who is signed in and which context is open (an organization or the platform). */
export function pingoContextKey(
  userId: string | null | undefined,
  context: string | null | undefined,
): string | null {
  return userId && context ? `${userId}:${context}` : null
}

/** Opening or closing the panel never touches the conversation of the current context. */
export function setPingoOpen(state: PingoConversationState, open: boolean) {
  state.open = open
}

/** Adds the draft as a user message. Empty, whitespace-only or oversized drafts are refused. */
export function sendPingoMessage(state: PingoConversationState): boolean {
  const text = state.draft.trim()
  if (!text || text.length > PINGO_MESSAGE_MAX_LENGTH) return false
  state.messages.push({ id: state.nextId++, author: 'user', text })
  state.draft = ''
  return true
}

/** Keeps the conversation while the context is the same; otherwise closes and clears everything. */
export function syncPingoContext(
  state: PingoConversationState,
  contextKey: string | null,
): void {
  if (state.contextKey === contextKey) return
  Object.assign(state, createPingoConversation(contextKey))
}
