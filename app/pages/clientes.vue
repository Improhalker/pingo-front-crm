<script setup lang="ts">
import {
  Archive,
  ArchiveRestore,
  Pencil,
  RotateCcw,
  UserPlus,
  X,
} from '@lucide/vue'
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
import type { ArchiveFilter, Customer } from '~/types/finance'

definePageMeta({ middleware: 'auth' })
const { organization, canManageCatalog, run } = useFinance()
usePageHeading(() => ({
  title: 'Clientes',
  crumbs: organization.value ? [{ label: organization.value.name }] : [],
}))

const lane = createLatestRequest()
const items = ref<Customer[]>([])
const meta = ref<PageMeta | null>(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const actionError = ref('')
const busyId = ref('')
const search = ref('')
const status = ref<string>('active')
const applied = ref<{ search: string; status: ArchiveFilter }>({
  search: '',
  status: 'active',
})
const statusOptions = [
  { value: 'active', label: 'Ativos' },
  { value: 'archived', label: 'Arquivados' },
  { value: 'all', label: 'Todos' },
]
const filtered = computed(
  () => !!applied.value.search || applied.value.status !== 'active',
)
const dialogOpen = ref(false)
const editing = ref<Customer | null>(null)

async function load(page = 1) {
  if (!organization.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await run(
      (api, signal) =>
        api.customers(
          { page, search: applied.value.search, status: applied.value.status },
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
      'Não foi possível carregar os clientes. Tente novamente.',
    )
    loading.value = false
  }
}
function applyFilters() {
  applied.value = {
    search: search.value.trim(),
    status: status.value as ArchiveFilter,
  }
  return load(1)
}
function clearFilters() {
  search.value = ''
  status.value = 'active'
  return applyFilters()
}
function openDialog(customer: Customer | null) {
  editing.value = customer
  notice.value = ''
  actionError.value = ''
  dialogOpen.value = true
}
function saved(customer: Customer, created: boolean) {
  notice.value = created
    ? `Cliente ${customer.name} cadastrado.`
    : `Dados de ${customer.name} atualizados.`
  return load(created ? 1 : (meta.value?.current_page ?? 1))
}
async function setArchived(customer: Customer, archived: boolean) {
  if (busyId.value) return
  busyId.value = customer.id
  notice.value = ''
  actionError.value = ''
  try {
    const result = await run((api, signal) =>
      api.setCustomerArchived(customer.id, archived, signal),
    )
    if (!result.ok) return
    notice.value = archived
      ? `Cliente ${customer.name} arquivado: não aparece mais em novas receitas, e as já registradas continuam vinculadas.`
      : `Cliente ${customer.name} reativado: já pode ser usado em novas receitas.`
    await load(meta.value?.current_page ?? 1)
  } catch (cause) {
    actionError.value = financeErrorMessage(
      cause,
      'Não foi possível alterar a situação do cliente. Tente novamente.',
    )
  } finally {
    busyId.value = ''
  }
}
function contact(customer: Customer) {
  return [customer.phone, customer.email].filter(Boolean).join(' · ') || '—'
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
    status.value = 'active'
    applied.value = { search: '', status: 'active' }
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
            <h2 id="list-title">Clientes da empresa</h2>
            <p class="small text-secondary">
              <template v-if="canManageCatalog">
                Arquivar tira o cliente das novas receitas sem apagar o
                histórico.
              </template>
              <template v-else>
                Seu papel permite consultar os clientes. Cadastro e edição ficam
                com quem administra a empresa.
              </template>
            </p>
          </div>
          <Button v-if="canManageCatalog" @click="openDialog(null)">
            <UserPlus />Cadastrar cliente
          </Button>
        </div>

        <form
          class="filters"
          role="search"
          aria-label="Filtrar clientes"
          @submit.prevent="applyFilters"
        >
          <div class="field">
            <span id="customer-status-label" class="field-label">Situação</span>
            <AppSegmented
              v-model="status"
              aria-labelledby="customer-status-label"
              :options="statusOptions"
              :disabled="loading"
              @update:model-value="applyFilters"
            />
          </div>
          <FinanceSearchField
            v-model="search"
            label="Buscar por nome, contato ou documento"
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
            <span class="sr-only">Carregando clientes…</span>
            <div v-for="row in 4" :key="row" class="list-skeleton-row">
              <Skeleton class="h-4 w-48 max-w-full" />
              <Skeleton class="h-3 w-32 max-w-full" />
            </div>
          </div>

          <div v-else-if="!items.length && !error" class="list-empty">
            <template v-if="filtered">
              <p class="list-empty-title">Nenhum cliente encontrado.</p>
              <p class="text-secondary">
                Nenhum cliente corresponde a esses filtros.
              </p>
              <Button variant="outline" @click="clearFilters">
                Limpar filtros
              </Button>
            </template>
            <template v-else>
              <p class="list-empty-title">Nenhum cliente ativo.</p>
              <p class="text-secondary">
                {{
                  canManageCatalog
                    ? 'Cadastre um cliente para registrar receitas. Clientes arquivados ficam no filtro “Arquivados”.'
                    : 'Quando a administração cadastrar clientes, eles aparecem aqui. Arquivados ficam no filtro “Arquivados”.'
                }}
              </p>
            </template>
          </div>

          <Table v-else-if="items.length">
            <TableCaption class="sr-only">
              Clientes em ordem alfabética.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Documento</TableHead>
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
                <TableCell data-label="Contato">{{ contact(item) }}</TableCell>
                <TableCell data-label="Documento" class="tabular">
                  {{ item.document || '—' }}
                </TableCell>
                <TableCell data-label="Situação">
                  <FinanceArchiveBadge :archived="item.archived" />
                </TableCell>
                <TableCell v-if="canManageCatalog" class="row-actions-cell">
                  <span class="row-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      :disabled="!!busyId"
                      @click="openDialog(item)"
                    >
                      <Pencil />Editar<span class="sr-only">
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
            label="Paginação dos clientes"
            :noun="['cliente', 'clientes']"
            @go="load"
          />
        </FinanceListCard>
      </section>

      <FinanceCustomerDialog
        v-if="canManageCatalog"
        v-model:open="dialogOpen"
        :customer="editing"
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
