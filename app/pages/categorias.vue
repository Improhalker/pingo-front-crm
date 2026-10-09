<script setup lang="ts">
import { Archive, ArchiveRestore, Pencil, RotateCcw, Tag, X } from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import type { PageMeta } from '~/types/api'
import type { ArchiveFilter, Category, CategoryType } from '~/types/finance'

definePageMeta({ middleware: 'auth' })
const { organization, canManageCatalog, run } = useFinance()
usePageHeading(() => ({
  title: 'Categorias',
  crumbs: organization.value ? [{ label: organization.value.name }] : [],
}))

const lane = createLatestRequest()
const items = ref<Category[]>([])
const meta = ref<PageMeta | null>(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const actionError = ref('')
const busyId = ref('')
const search = ref('')
const type = ref<string>('REVENUE')
const status = ref<string>('active')
const applied = ref<{ search: string; type: string; status: ArchiveFilter }>({
  search: '',
  type: 'REVENUE',
  status: 'active',
})
const typeOptions = [
  { value: 'REVENUE', label: 'Receitas' },
  { value: 'EXPENSE', label: 'Despesas' },
  { value: '', label: 'Todas' },
]
const statusOptions = [
  { value: 'active', label: 'Ativas' },
  { value: 'archived', label: 'Arquivadas' },
  { value: 'all', label: 'Todas' },
]
const filtered = computed(
  () => !!applied.value.search || applied.value.status !== 'active',
)
const dialogOpen = ref(false)
const editing = ref<Category | null>(null)
const typeLabel = (value: CategoryType) =>
  value === 'REVENUE' ? 'Receita' : 'Despesa'

async function load(page = 1) {
  if (!organization.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await run(
      (api, signal) =>
        api.categories(
          {
            page,
            search: applied.value.search,
            status: applied.value.status,
            type: (applied.value.type || undefined) as CategoryType | undefined,
          },
          signal,
        ),
      lane.begin(),
    )
    if (!result.ok) return
    items.value = result.value.data
    meta.value = result.value.meta
    loading.value = false
  } catch (cause) {
    error.value = financeErrorMessage(
      cause,
      'Não foi possível carregar as categorias. Tente novamente.',
    )
    loading.value = false
  }
}
function applyFilters() {
  applied.value = {
    search: search.value.trim(),
    type: type.value,
    status: status.value as ArchiveFilter,
  }
  return load(1)
}
function clearFilters() {
  search.value = ''
  status.value = 'active'
  return applyFilters()
}
function openDialog(category: Category | null) {
  editing.value = category
  notice.value = ''
  actionError.value = ''
  dialogOpen.value = true
}
function saved(category: Category, created: boolean) {
  notice.value = created
    ? `A categoria ${category.name} (${typeLabel(category.type).toLowerCase()}) foi cadastrada.`
    : `A categoria agora se chama ${category.name}.`
  if (created && applied.value.type && applied.value.type !== category.type) {
    type.value = category.type
    return applyFilters()
  }
  return load(created ? 1 : (meta.value?.current_page ?? 1))
}
async function setArchived(category: Category, archived: boolean) {
  if (busyId.value) return
  busyId.value = category.id
  notice.value = ''
  actionError.value = ''
  try {
    const result = await run((api, signal) =>
      api.setCategoryArchived(category.id, archived, signal),
    )
    if (!result.ok) return
    notice.value = archived
      ? `${category.name} foi arquivada. Ela não aceita novos lançamentos, e os já registrados continuam com ela.`
      : `${category.name} foi reativada e aceita novos lançamentos.`
    await load(meta.value?.current_page ?? 1)
  } catch (cause) {
    actionError.value = financeErrorMessage(
      cause,
      'Não foi possível alterar a situação da categoria. Tente novamente.',
    )
  } finally {
    busyId.value = ''
  }
}

// Organization change or end of session: drop everything of the previous context and start over.
watch(
  () => organization.value?.id,
  (id) => {
    lane.cancel()
    items.value = []
    meta.value = null
    loading.value = false
    error.value = ''
    notice.value = ''
    actionError.value = ''
    busyId.value = ''
    search.value = ''
    type.value = 'REVENUE'
    status.value = 'active'
    applied.value = { search: '', type: 'REVENUE', status: 'active' }
    dialogOpen.value = false
    if (id) load()
  },
  { immediate: true },
)
onBeforeUnmount(() => lane.cancel())
</script>

<template>
  <FinanceContextGate>
    <div class="catalog">
      <Alert v-if="notice" variant="success" role="status" class="dismissible">
        <AlertDescription>{{ notice }}</AlertDescription>
        <Button
          variant="ghost"
          size="icon-sm"
          class="dismiss"
          @click="notice = ''"
        >
          <X :size="18" /><span class="sr-only">Fechar aviso</span>
        </Button>
      </Alert>
      <Alert v-if="actionError" variant="destructive" role="alert">
        <AlertDescription>{{ actionError }}</AlertDescription>
      </Alert>

      <section class="list" aria-labelledby="list-title" :aria-busy="loading">
        <div class="toolbar">
          <div class="toolbar-title">
            <h2 id="list-title">Categorias da empresa</h2>
            <p class="small text-secondary">
              <template v-if="canManageCatalog">
                Receitas usam categorias de receita. Arquivar impede novos
                lançamentos sem alterar o histórico.
              </template>
              <template v-else>
                Seu papel permite consultar as categorias. Cadastro e edição
                ficam com quem administra a empresa.
              </template>
            </p>
          </div>
          <Button v-if="canManageCatalog" @click="openDialog(null)">
            <Tag />Cadastrar categoria
          </Button>
        </div>

        <form
          class="filters"
          role="search"
          aria-label="Filtrar categorias"
          @submit.prevent="applyFilters"
        >
          <div class="field">
            <span id="category-type-label" class="field-label">Tipo</span>
            <AppSegmented
              v-model="type"
              aria-labelledby="category-type-label"
              :options="typeOptions"
              :disabled="loading"
              @update:model-value="applyFilters"
            />
          </div>
          <div class="field">
            <span id="category-status-label" class="field-label">Situação</span>
            <AppSegmented
              v-model="status"
              aria-labelledby="category-status-label"
              :options="statusOptions"
              :disabled="loading"
              @update:model-value="applyFilters"
            />
          </div>
          <FinanceSearchField
            v-model="search"
            label="Buscar por nome"
            :disabled="loading"
          />
          <Button
            v-if="filtered"
            type="button"
            variant="ghost"
            :disabled="loading"
            @click="clearFilters"
          >
            <X />Limpar filtros
          </Button>
        </form>

        <Alert v-if="error" variant="destructive" role="alert">
          <AlertDescription class="error-line">
            {{ error }}
            <Button
              variant="outline"
              size="sm"
              @click="load(meta?.current_page ?? 1)"
            >
              <RotateCcw />Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>

        <FinanceListCard>
          <div
            v-if="loading && !items.length"
            class="list-skeleton"
            role="status"
          >
            <span class="sr-only">Carregando categorias…</span>
            <div v-for="row in 3" :key="row" class="list-skeleton-row">
              <Skeleton class="h-4 w-48 max-w-full" />
            </div>
          </div>

          <div v-else-if="!items.length && !error" class="list-empty">
            <template v-if="filtered">
              <p class="list-empty-title">Nenhuma categoria encontrada.</p>
              <p class="text-secondary">
                Nenhuma categoria corresponde a esses filtros.
              </p>
              <Button variant="outline" @click="clearFilters">
                Limpar filtros
              </Button>
            </template>
            <template v-else>
              <p class="list-empty-title">
                Nenhuma categoria
                {{
                  applied.type === 'REVENUE'
                    ? 'de receita'
                    : applied.type === 'EXPENSE'
                      ? 'de despesa'
                      : ''
                }}
                ativa.
              </p>
              <p class="text-secondary">
                {{
                  canManageCatalog
                    ? 'Cadastre uma categoria, por exemplo “Aulas práticas” para receitas. Arquivadas ficam no filtro “Arquivadas”.'
                    : 'Quando a administração cadastrar categorias, elas aparecem aqui. Arquivadas ficam no filtro “Arquivadas”.'
                }}
              </p>
            </template>
          </div>

          <Table v-else-if="items.length">
            <TableCaption class="sr-only">
              Categorias por tipo e em ordem alfabética.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead v-if="canManageCatalog">
                  <span class="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in items" :key="item.id">
                <TableHead scope="row" class="row-head">
                  <span class="row-name">{{ item.name }}</span>
                </TableHead>
                <TableCell data-label="Tipo">{{
                  typeLabel(item.type)
                }}</TableCell>
                <TableCell data-label="Situação">
                  <FinanceArchiveBadge :archived="item.archived" feminine />
                </TableCell>
                <TableCell v-if="canManageCatalog" class="row-actions-cell">
                  <span class="row-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      :disabled="!!busyId"
                      @click="openDialog(item)"
                    >
                      <Pencil />Renomear<span class="sr-only">
                        {{ item.name }}</span
                      >
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      :disabled="!!busyId"
                      @click="setArchived(item, !item.archived)"
                    >
                      <template v-if="busyId === item.id">Salvando…</template>
                      <template v-else-if="item.archived">
                        <ArchiveRestore />Reativar
                      </template>
                      <template v-else><Archive />Arquivar</template>
                      <span class="sr-only"> {{ item.name }}</span>
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <FinancePager
            v-if="meta && items.length"
            :meta="meta"
            :loading="loading"
            label="Paginação das categorias"
            :noun="['categoria', 'categorias']"
            @go="load"
          />
        </FinanceListCard>
      </section>

      <FinanceCategoryDialog
        v-if="canManageCatalog"
        v-model:open="dialogOpen"
        :category="editing"
        :default-type="(applied.type || 'REVENUE') as CategoryType"
        @saved="saved"
      />
    </div>
  </FinanceContextGate>
</template>

<style scoped>
.catalog,
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.catalog {
  gap: var(--space-6);
}
.dismissible {
  grid-template-columns: 1fr auto;
  align-items: center;
}
.dismissible :deep([data-slot='alert-description']) {
  grid-column: 1;
}
.dismiss {
  grid-column: 2;
  grid-row: 1;
  color: inherit;
}
.toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-6);
}
.toolbar-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 62ch;
}
.filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.error-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
@media (max-width: 640px) {
  .toolbar > button,
  .filters,
  .filters .field {
    width: 100%;
  }
  .filters :deep(.segmented) {
    width: 100%;
  }
}
</style>
