<script setup lang="ts">
// Shared Pingo conversation (floating dock and /assistente). Local messages only: there is no API,
// no generated answer and no financial entry. Messages render with text interpolation, never HTML.
import { SendHorizontal } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { pingoAssets } from '~/config/visual-references'
import { PINGO_MESSAGE_MAX_LENGTH } from '~/utils/pingo-conversation'

const props = defineProps<{
  area: 'company' | 'platform' | 'preview'
  variant: 'panel' | 'page'
}>()
const { state, send } = usePingoConversation(props.area)
const id = useId()
const transcript = useTemplateRef<HTMLElement>('transcript')
const composer = useTemplateRef<HTMLTextAreaElement>('composer')
const notice = ref('')

const copy = computed(() =>
  props.area === 'platform'
    ? {
        intro:
          'Na administração, o Pingo é uma prévia. Ele não acessa os dados das empresas.',
        sent: 'Mensagem guardada nesta conversa. O Pingo ainda não responde e nada foi alterado na plataforma.',
        suggestions: [
          'Cadastrar uma nova empresa',
          'Suspender o acesso de uma empresa',
          'Entender o que a administração vê',
        ],
      }
    : {
        intro:
          'Um espaço para entender e organizar seu financeiro, sempre por aqui.',
        sent: 'Mensagem guardada nesta conversa. O Pingo ainda não responde e nenhum lançamento foi registrado.',
        suggestions: [
          'Entender minhas entradas e saídas',
          'Organizar os próximos vencimentos',
          'Revisar minhas despesas',
        ],
      },
)
const remaining = computed(
  () => PINGO_MESSAGE_MAX_LENGTH - state.value.draft.length,
)

async function submit() {
  if (!send()) return
  notice.value = copy.value.sent
  await nextTick()
  transcript.value?.scrollTo({ top: transcript.value.scrollHeight })
  composer.value?.focus()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
function suggest(text: string) {
  state.value.draft = text
  composer.value?.focus()
}
function focusComposer() {
  composer.value?.focus()
}
defineExpose({ focusComposer })
</script>

<template>
  <div class="conversation" :class="`is-${variant}`">
    <div
      ref="transcript"
      class="transcript"
      role="log"
      aria-label="Conversa com o Pingo"
      aria-live="polite"
      aria-relevant="additions"
      tabindex="0"
    >
      <div v-if="!state.messages.length" class="empty">
        <PingoVisual
          :src="pingoAssets.normal.src"
          :alt="pingoAssets.normal.alt"
          :width="variant === 'page' ? 144 : 64"
          :height="variant === 'page' ? 144 : 64"
        />
        <h3>Oi! Eu sou o Pingo.</h3>
        <p>{{ copy.intro }}</p>
        <p class="small text-secondary">
          As respostas ainda estão em preparação. Você já pode escrever: a
          conversa fica só aqui e some ao sair.
        </p>
      </div>
      <div v-for="message in state.messages" :key="message.id" class="message">
        <span class="message-author">Você</span>
        <p>{{ message.text }}</p>
      </div>
    </div>

    <div
      v-if="!state.messages.length"
      class="suggestions"
      role="group"
      aria-label="Ideias para começar"
    >
      <button
        v-for="suggestion in copy.suggestions"
        :key="suggestion"
        type="button"
        class="suggestion"
        @click="suggest(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>
    <p v-if="notice" class="notice-line small" role="status">{{ notice }}</p>

    <form class="composer" @submit.prevent="submit">
      <label :for="`${id}-message`" class="field-label"
        >Mensagem para o Pingo</label
      >
      <div class="composer-row">
        <textarea
          :id="`${id}-message`"
          ref="composer"
          v-model="state.draft"
          class="control"
          :rows="variant === 'page' ? 3 : 2"
          :maxlength="PINGO_MESSAGE_MAX_LENGTH"
          :aria-describedby="`${id}-help`"
          @keydown="onKeydown"
        />
        <Button
          type="submit"
          size="icon"
          class="send"
          :disabled="!state.draft.trim()"
        >
          <SendHorizontal :size="20" />
          <span class="sr-only">Enviar mensagem</span>
        </Button>
      </div>
      <p :id="`${id}-help`" class="small text-secondary">
        Enter envia; Shift + Enter quebra a linha.
        <span v-if="remaining < 200">Restam {{ remaining }} caracteres.</span>
      </p>
    </form>
  </div>
</template>

<style scoped>
.conversation {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
}
.transcript {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-surface-secondary);
}
.is-panel .transcript {
  padding: var(--space-3);
}
.is-panel .empty {
  gap: var(--space-1);
}
.is-page .transcript {
  min-height: 300px;
  max-height: 460px;
  padding: var(--space-6);
}
.empty {
  margin: auto;
  max-width: 44ch;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
}
.empty img {
  object-fit: contain;
}
.message {
  align-self: flex-end;
  max-width: min(85%, 60ch);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-popover) var(--radius-popover) var(--radius-inner)
    var(--radius-popover);
  background: var(--color-brand-subtle-bg);
  color: var(--color-brand-subtle-fg);
}
.message p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.message-author {
  display: block;
  font-size: var(--type-secondary);
  font-weight: var(--weight-strong);
}
.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.suggestion {
  min-height: var(--control-height-compact);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
  text-align: left;
  transition: background-color var(--motion-fast) var(--motion-ease);
}
.suggestion:hover {
  background: var(--color-surface-secondary);
}
.notice-line {
  color: var(--color-status-info-fg);
}
.composer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.composer-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}
.composer-row textarea {
  resize: none;
  max-height: 160px;
}
.send {
  width: var(--control-height);
  height: var(--control-height);
  flex: none;
}
</style>
