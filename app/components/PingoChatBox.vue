<script setup lang="ts">
// Full-page presentation of the same in-memory conversation used by the floating dock.
import { Badge } from '~/components/ui/badge'
import { pingoAssets } from '~/config/visual-references'

withDefaults(defineProps<{ area?: 'company' | 'preview' }>(), {
  area: 'company',
})
</script>

<template>
  <section class="pingo-chat card" aria-labelledby="pingo-chat-title">
    <header class="chat-heading">
      <div class="chat-identity">
        <PingoVisual
          :src="pingoAssets.normal.src"
          alt=""
          :width="56"
          :height="56"
        />
        <div>
          <h2 id="pingo-chat-title">Converse com o Pingo</h2>
          <p class="small text-secondary">
            Seu financeiro em dia, sem complicação.
          </p>
        </div>
      </div>
      <Badge>Respostas em preparação</Badge>
    </header>
    <PingoConversation :area="area" variant="page" />
  </section>
</template>

<style scoped>
.pingo-chat {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.chat-heading,
.chat-identity {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.chat-heading {
  justify-content: space-between;
  flex-wrap: wrap;
}
.chat-identity {
  min-width: 0;
}
.chat-identity img {
  object-fit: contain;
  flex: none;
}
</style>
