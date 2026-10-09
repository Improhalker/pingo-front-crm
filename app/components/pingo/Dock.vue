<script setup lang="ts">
// Floating Pingo (bottom-right). Desktop: non-modal panel next to the launcher, the page stays
// usable. Mobile (≤ 640px): modal full-height sheet that follows the virtual keyboard (dvh).
// Escape closes, focus moves to the composer on open and back to the launcher on close.
import { useMediaQuery } from '@vueuse/core'
import { X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { pingoAssets } from '~/config/visual-references'

const props = defineProps<{ area: 'company' | 'platform' }>()
const { open } = usePingoConversation(props.area)
const mobile = useMediaQuery('(max-width: 640px)')
const conversation = useTemplateRef<{ focusComposer: () => void }>(
  'conversation',
)
function focusComposer(event: Event) {
  event.preventDefault()
  conversation.value?.focusComposer()
}
function keepOpenOnDesktop(event: Event) {
  if (!mobile.value) event.preventDefault()
}
</script>

<template>
  <DialogRoot v-model:open="open" :modal="mobile">
    <DialogTrigger
      class="pingo-launcher"
      :aria-label="open ? 'Fechar Pingo' : 'Abrir Pingo'"
      :title="open ? 'Fechar Pingo' : 'Abrir Pingo'"
    >
      <PingoVisual
        :src="pingoAssets.normal.src"
        alt=""
        :width="40"
        :height="40"
      />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay v-if="mobile" class="pingo-dock-overlay" />
      <DialogContent
        class="pingo-dock-panel"
        :class="{ 'is-mobile': mobile }"
        @open-auto-focus="focusComposer"
        @interact-outside="keepOpenOnDesktop"
        @focus-outside="keepOpenOnDesktop"
      >
        <header class="pingo-dock-head">
          <PingoVisual
            :src="pingoAssets.normal.src"
            alt=""
            :width="40"
            :height="40"
          />
          <div class="pingo-dock-identity">
            <DialogTitle class="pingo-dock-title">Pingo</DialogTitle>
            <DialogDescription class="pingo-dock-description">
              {{
                area === 'platform'
                  ? 'Prévia na administração'
                  : 'Respostas em preparação'
              }}
            </DialogDescription>
          </div>
          <DialogClose class="pingo-dock-close" aria-label="Fechar Pingo">
            <X :size="20" />
          </DialogClose>
        </header>
        <PingoConversation
          ref="conversation"
          class="pingo-dock-conversation"
          :area="area"
          variant="panel"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.pingo-launcher {
  position: fixed;
  right: max(var(--space-6), env(safe-area-inset-right));
  bottom: max(var(--space-6), env(safe-area-inset-bottom));
  z-index: var(--layer-chat);
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--elevation-2);
  transition:
    transform var(--motion-fast) var(--motion-ease),
    box-shadow var(--motion-fast) var(--motion-ease);
}
.pingo-launcher:hover {
  transform: translateY(-2px);
}
.pingo-launcher[data-state='open'] {
  background: var(--color-brand-subtle-bg);
  border-color: var(--color-brand-subtle-fg);
}
.pingo-launcher img {
  object-fit: contain;
}
@media (max-width: 640px) {
  .pingo-launcher {
    right: max(var(--space-4), env(safe-area-inset-right));
    bottom: max(var(--space-4), env(safe-area-inset-bottom));
  }
}
@media (prefers-reduced-motion: reduce) {
  .pingo-launcher:hover {
    transform: none;
  }
}
</style>

<style>
/* Teleported to <body>: global, uniquely prefixed. */
.pingo-dock-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--layer-overlay);
  background: var(--color-overlay);
}
.pingo-dock-panel {
  position: fixed;
  right: max(var(--space-6), env(safe-area-inset-right));
  bottom: calc(
    max(var(--space-6), env(safe-area-inset-bottom)) + 56px + var(--space-3)
  );
  z-index: var(--layer-overlay);
  width: min(380px, calc(100vw - var(--space-8)));
  height: min(640px, calc(100dvh - 140px));
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  box-shadow: var(--elevation-3);
  overflow: hidden;
}
.pingo-dock-panel[data-state='open'] {
  animation: pingo-dock-in var(--motion-base) var(--motion-ease);
}
.pingo-dock-panel[data-state='closed'] {
  animation: pingo-dock-out var(--motion-fast) var(--motion-ease);
}
@keyframes pingo-dock-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@keyframes pingo-dock-out {
  to {
    opacity: 0;
    transform: translateY(8px);
  }
}
.pingo-dock-panel.is-mobile {
  inset: 0;
  width: 100%;
  height: 100dvh;
  border: 0;
  border-radius: 0;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
.pingo-dock-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}
.pingo-dock-head img {
  object-fit: contain;
  flex: none;
}
.pingo-dock-identity {
  flex: 1;
  min-width: 0;
}
.pingo-dock-title {
  margin: 0;
  font-size: var(--type-body);
  font-weight: var(--weight-strong);
}
.pingo-dock-description {
  margin: 0;
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.pingo-dock-close {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-secondary);
}
.pingo-dock-close:hover {
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
}
.pingo-dock-conversation {
  flex: 1;
  padding: var(--space-3) var(--space-4) var(--space-4);
}
</style>
