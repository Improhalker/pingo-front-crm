<script setup lang="ts">
definePageMeta({ layout: 'platform', middleware: 'platform' })
const { log, loading, error, load } = useAgentChanges()
usePageHeading({
  title: 'Histórico de alterações',
  crumbs: [{ label: 'Administração' }],
})
const search = ref('')
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})
const changes = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('pt-BR')
  return [...(log.value?.changes ?? [])]
    .sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id),
    )
    .filter(
      (change) =>
        !query ||
        `${change.summary} ${change.agent}`
          .toLocaleLowerCase('pt-BR')
          .includes(query),
    )
})
const details = computed(
  () => new Map(log.value?.details.map((detail) => [detail.id, detail]) ?? []),
)
onMounted(load)
</script>

<template>
  <div class="change-history">
    <div class="page-heading">
      <p class="text-secondary">
        O que mudou no PingoFin, registrado pelos agentes.
      </p>
      <span class="status-badge">Administração master</span>
    </div>
    <section class="card history-filter" aria-label="Buscar alterações">
      <div class="field">
        <label for="change-search">Buscar por alteração ou agente</label>
        <input
          id="change-search"
          v-model="search"
          class="control"
          type="search"
          maxlength="100"
          autocomplete="off"
        />
      </div>
      <p v-if="log" class="small text-secondary" role="status">
        {{ changes.length }}
        {{
          changes.length === 1
            ? 'alteração encontrada'
            : 'alterações encontradas'
        }}
      </p>
    </section>
    <p v-if="loading" class="notice" role="status">Carregando histórico…</p>
    <div v-else-if="error" class="notice error" role="alert">
      <p>{{ error }}</p>
      <button class="button secondary" type="button" @click="load">
        Tentar novamente
      </button>
    </div>
    <p v-else-if="!changes.length" class="card text-secondary">
      {{
        search.trim()
          ? 'Nenhuma alteração encontrada para esta busca.'
          : 'Nenhuma alteração registrada ainda.'
      }}
    </p>
    <ol
      v-else
      class="history-list"
      aria-label="Alterações, da mais recente para a mais antiga"
    >
      <li v-for="change in changes" :key="change.id">
        <article class="card history-entry">
          <div class="history-meta small text-secondary">
            <time :datetime="change.occurredAt">{{
              dateFormat.format(new Date(change.occurredAt))
            }}</time>
            <span>{{ change.agent }}</span>
          </div>
          <p class="history-summary">{{ change.summary }}</p>
          <details
            v-if="change.detailsId && details.has(change.detailsId)"
            class="history-details"
          >
            <summary>Ver detalhes</summary>
            <div class="history-sections">
              <section
                v-for="(section, index) in details.get(change.detailsId)
                  ?.sections"
                :key="index"
              >
                <h2>{{ section.title }}</h2>
                <p class="text-secondary">{{ section.text }}</p>
              </section>
            </div>
          </details>
        </article>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.change-history {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 1000px;
  margin-inline: auto;
}
.page-heading .status-badge {
  background: var(--color-brand-subtle-bg);
  color: var(--color-brand-subtle-fg);
}
.history-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--space-4);
}
.history-filter .field {
  flex: 1 1 300px;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.history-entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.history-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
}
.history-summary,
.history-sections p {
  overflow-wrap: anywhere;
}
.history-details {
  border-top: 1px solid var(--color-border-subtle);
  padding-top: var(--space-4);
}
.history-details summary {
  width: fit-content;
  cursor: pointer;
  color: var(--color-link);
  font-weight: var(--weight-medium);
}
.history-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-4);
}
.history-sections h2 {
  font-size: var(--type-body);
  margin-bottom: var(--space-2);
}
</style>
