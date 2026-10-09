import {
  createPingoConversation,
  pingoContextKey,
  sendPingoMessage,
  setPingoOpen,
  syncPingoContext,
} from '~/utils/pingo-conversation'
import type { PingoConversationState } from '~/utils/pingo-conversation'

/**
 * One in-memory conversation per signed-in identity and context, shared by the floating dock and the
 * /assistente page (only one of them is mounted at a time). Never written to storage; useSession
 * resets it (PINGO_STATE_KEYS) on organization change, logout and identity change.
 */
export function usePingoConversation(area: 'company' | 'platform' | 'preview') {
  const state = useState<PingoConversationState>('pingo.conversation', () =>
    createPingoConversation(),
  )
  const { user, organization } = useSession()
  const contextKey = computed(() =>
    area === 'preview'
      ? 'preview'
      : pingoContextKey(
          user.value?.id,
          area === 'platform' ? 'platform' : organization.value?.id,
        ),
  )
  watch(contextKey, (key) => syncPingoContext(state.value, key), {
    immediate: true,
  })
  const open = computed({
    get: () => state.value.open,
    set: (value: boolean) => setPingoOpen(state.value, value),
  })
  return {
    state,
    open,
    contextKey,
    send: () => sendPingoMessage(state.value),
  }
}
