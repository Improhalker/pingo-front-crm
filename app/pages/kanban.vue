<script setup lang="ts">
import type {
  KanbanStatus,
  KanbanTask,
  KanbanTaskInput,
} from '~/types/internal-kanban'
import { groupByStatus, kanbanColumns } from '~/utils/internal-kanban'

definePageMeta({ layout: 'internal', middleware: 'platform' })
useHead({ title: 'Kanban do projeto · PingoFin' })

const { user } = useSession()
const board = useInternalKanban()
const { tasks, phase, saving, error, status } = board
const taskDialog = useTemplateRef<{ open: (task?: KanbanTask) => void }>(
  'taskDialog',
)
const deleteDialog = useTemplateRef<{ open: (task: KanbanTask) => void }>(
  'deleteDialog',
)
const draggingId = ref<string | null>(null)
const columns = computed(() => groupByStatus(tasks.value))

onMounted(board.load)
onBeforeUnmount(board.dispose)
// A different or missing identity must never keep showing internal data.
watch(
  () => user.value?.id,
  (id, previous) => {
    if (previous && id !== previous) board.dispose()
  },
)

function saveTask(id: string | null, input: KanbanTaskInput) {
  return id ? board.update(id, input) : board.create(input)
}
async function move(id: string, to: KanbanStatus, index: number) {
  draggingId.value = null
  // -1 means "end of the column", used by the "Mover para" control.
  const target = index < 0 ? columns.value[to].length : index
  await board.move(id, to, target)
}
</script>

<template>
  <div class="kanban-page">
    <div class="page-heading">
      <div class="flex flex-col gap-2">
        <h1>Kanban do projeto</h1>
        <p class="text-secondary">
          Acompanhamento interno do desenvolvimento do PingoFin. Não faz parte
          do produto das empresas clientes.
        </p>
      </div>
      <button
        v-if="phase === 'ready'"
        class="button"
        type="button"
        :disabled="saving"
        @click="taskDialog?.open()"
      >
        Nova tarefa
      </button>
    </div>

    <p v-if="phase === 'loading'" class="notice" role="status">
      Verificando seu acesso e carregando o quadro…
    </p>

    <section v-else-if="phase === 'disabled'" class="card state-card">
      <h2>Ferramenta desativada</h2>
      <p class="text-secondary">
        O Kanban interno está desativado neste ambiente. Nenhuma tarefa é
        exibida ou alterada enquanto estiver assim.
      </p>
    </section>

    <section v-else-if="phase === 'denied'" class="card state-card">
      <h2>Acesso negado</h2>
      <p class="text-secondary">
        Esta ferramenta é restrita às contas master da plataforma. Ter acesso a
        uma organização não concede acesso ao quadro.
      </p>
    </section>

    <section v-else-if="phase === 'error'" class="card state-card">
      <h2>Não foi possível abrir o quadro</h2>
      <p class="notice error" role="alert">{{ error }}</p>
      <button class="button secondary" type="button" @click="board.load()">
        Tentar novamente
      </button>
    </section>

    <template v-else>
      <p v-if="error" class="notice error" role="alert">{{ error }}</p>
      <p class="small text-secondary save-status" role="status">
        {{ status }}
      </p>
      <nav class="column-nav" aria-label="Ir para a coluna">
        <a
          v-for="column in kanbanColumns"
          :key="column.value"
          :href="`#column-${column.value}`"
          class="button secondary"
        >
          {{ column.label }} ({{ columns[column.value].length }})
        </a>
      </nav>
      <p v-if="!tasks.length" class="card state-card text-secondary">
        O quadro está vazio. Use “Nova tarefa” para registrar a primeira.
      </p>
      <div class="board" :aria-busy="saving">
        <InternalKanbanColumn
          v-for="column in kanbanColumns"
          :key="column.value"
          :status="column.value"
          :label="column.label"
          :tasks="columns[column.value]"
          :disabled="saving"
          :dragging-id="draggingId"
          @edit="taskDialog?.open($event)"
          @remove="deleteDialog?.open($event)"
          @move="move"
          @dragstart="draggingId = $event"
          @dragend="draggingId = null"
        />
      </div>
      <InternalKanbanTaskDialog
        ref="taskDialog"
        :saving="saving"
        :save="saveTask"
      />
      <InternalKanbanDeleteDialog
        ref="deleteDialog"
        :saving="saving"
        :confirm="board.remove"
      />
    </template>
  </div>
</template>

<style scoped>
.kanban-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}
.page-heading p {
  max-width: 65ch;
}
.state-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  max-width: 65ch;
}
.save-status {
  min-height: 1.5em;
}
.board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
  align-items: start;
}
.column-nav {
  display: none;
  flex-wrap: wrap;
  gap: var(--space-2);
}
@media (max-width: 1100px) {
  .board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .board {
    grid-template-columns: minmax(0, 1fr);
  }
  .column-nav {
    display: flex;
  }
}
</style>
