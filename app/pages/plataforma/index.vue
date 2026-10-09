<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  RotateCcw,
  Search,
  X,
} from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
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
import { pingoAssets } from '~/config/visual-references'
import type { PlatformListFilters } from '~/types/api'

definePageMeta({ layout: 'platform', middleware: 'platform' })
usePageHeading({ title: 'Empresas', crumbs: [{ label: 'Administração' }] })
const {
  organizations,
  meta,
  filters,
  loading,
  error,
  created,
  notice,
  load,
  dismissCreated,
  dismissNotice,
} = usePlatform()
const page = ref(1)
const search = ref(filters.value.search)
const status = ref<string>(filters.value.status)
const statusOptions = [
  { value: '', label: 'Todas' },
  { value: 'active', label: 'Ativas' },
  { value: 'suspended', label: 'Suspensas' },
]
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})
function formatDate(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : '—'
}
const filtered = computed(
  () => !!(filters.value.search || filters.value.status),
)
function go(target: number) {
  page.value = target
  return load(target)
}
function applyFilters() {
  filters.value = {
    search: search.value.trim(),
    status: status.value as PlatformListFilters['status'],
  }
  return go(1)
}
function clearFilters() {
  search.value = ''
  status.value = ''
  return applyFilters()
}
function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((part) => part.length > 2)
      .slice(0, 2)
      .map((part) => part[0]!.toLocaleUpperCase('pt-BR'))
      .join('') || name.slice(0, 1).toLocaleUpperCase('pt-BR')
  )
}
onMounted(() => load(page.value))
</script>

<template>
  <div class="companies">
    <Alert v-if="created" variant="success" role="status" class="dismissible">
      <AlertDescription>
        <strong>{{ created.name }}</strong> foi cadastrada.
        <template v-if="created.first_administrator">
          A pessoa administradora é {{ created.first_administrator.name }} ({{
            created.first_administrator.email
          }}) e já pode entrar pela tela de acesso da empresa.
        </template>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon-sm"
        class="dismiss"
        @click="dismissCreated"
      >
        <X :size="18" /><span class="sr-only">Fechar aviso</span>
      </Button>
    </Alert>
    <Alert v-if="notice" variant="success" role="status" class="dismissible">
      <AlertDescription>{{ notice }}</AlertDescription>
      <Button
        variant="ghost"
        size="icon-sm"
        class="dismiss"
        @click="dismissNotice"
      >
        <X :size="18" /><span class="sr-only">Fechar aviso</span>
      </Button>
    </Alert>

    <div class="overview">
      <section class="stat card" aria-labelledby="stat-label">
        <p id="stat-label" class="stat-label">
          {{ filtered ? 'Empresas encontradas' : 'Empresas cadastradas' }}
        </p>
        <Skeleton v-if="!meta && loading" class="stat-skeleton" />
        <p v-else-if="meta" class="stat-value tabular">{{ meta.total }}</p>
        <p v-else class="stat-value" aria-label="Indisponível">—</p>
        <p class="stat-base">
          {{ filtered ? 'Com os filtros aplicados' : 'Ativas e suspensas' }}
        </p>
      </section>
      <section class="hint" aria-labelledby="hint-title">
        <PingoVisual
          :src="pingoAssets.normal.src"
          alt=""
          :width="88"
          :height="88"
        />
        <div class="hint-text">
          <h2 id="hint-title">Nova empresa em um só passo</h2>
          <p>
            Cadastre a empresa junto com a primeira pessoa administradora. Ela
            entra pela tela de acesso da empresa.
          </p>
        </div>
        <Button as-child size="lg" class="hint-action">
          <NuxtLink to="/plataforma/empresas/nova">
            <CirclePlus />Cadastrar empresa
          </NuxtLink>
        </Button>
      </section>
    </div>

    <section class="list" aria-labelledby="list-title" :aria-busy="loading">
      <div class="toolbar">
        <div class="toolbar-title">
          <h2 id="list-title">Todas as empresas</h2>
          <p class="small text-secondary">
            Abra uma empresa para editar, suspender ou excluir.
          </p>
        </div>
        <form
          class="filters"
          role="search"
          aria-label="Filtrar empresas"
          @submit.prevent="applyFilters"
        >
          <div class="field">
            <span id="status-label" class="field-label">Situação</span>
            <AppSegmented
              v-model="status"
              aria-labelledby="status-label"
              :options="statusOptions"
              :disabled="loading"
              @update:model-value="applyFilters"
            />
          </div>
          <div class="field search">
            <label for="filter-search">Buscar por nome</label>
            <div class="search-row">
              <div class="input-icon">
                <Search :size="18" />
                <Input
                  id="filter-search"
                  v-model="search"
                  type="search"
                  maxlength="120"
                  autocomplete="off"
                />
              </div>
              <Button type="submit" variant="outline" :disabled="loading">
                Buscar
              </Button>
            </div>
          </div>
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
      </div>

      <Alert v-if="error" variant="destructive" role="alert">
        <AlertDescription class="error-line">
          {{ error }}
          <Button variant="outline" size="sm" @click="load(page)">
            <RotateCcw />Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>

      <div class="table-card">
        <div
          v-if="loading && !organizations.length"
          class="skeleton-rows"
          role="status"
        >
          <span class="sr-only">Carregando empresas…</span>
          <div v-for="row in 4" :key="row" class="skeleton-row">
            <Skeleton class="size-10" />
            <div class="skeleton-text">
              <Skeleton class="h-4 w-48 max-w-full" />
              <Skeleton class="h-3 w-32 max-w-full" />
            </div>
          </div>
        </div>

        <div v-else-if="!organizations.length && !error" class="empty">
          <template v-if="filtered">
            <p class="empty-title">Nenhuma empresa encontrada.</p>
            <p class="text-secondary">
              Nenhuma empresa corresponde a esses filtros.
            </p>
            <Button variant="outline" @click="clearFilters">
              Limpar filtros
            </Button>
          </template>
          <template v-else>
            <p class="empty-title">Nenhuma empresa cadastrada ainda.</p>
            <p class="text-secondary">
              Use “Cadastrar empresa” para criar a primeira e sua pessoa
              administradora.
            </p>
          </template>
        </div>

        <div v-else-if="organizations.length" class="companies-table">
          <Table>
            <TableCaption class="sr-only">
              Empresas em ordem de cadastro, da mais recente para a mais antiga.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead class="numeric">Pessoas</TableHead>
                <TableHead>Cadastrada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in organizations" :key="item.id">
                <TableHead scope="row" class="row-head">
                  <span class="company">
                    <span class="company-initials" aria-hidden="true">{{
                      initials(item.name)
                    }}</span>
                    <span class="company-text">
                      <NuxtLink
                        :to="`/plataforma/empresas/${item.id}`"
                        class="company-name"
                        >{{ item.name }}</NuxtLink
                      >
                      <span class="company-meta">{{ item.timezone }}</span>
                    </span>
                  </span>
                </TableHead>
                <TableCell data-label="Situação">
                  <PlatformStatusBadge :status="item.status" />
                </TableCell>
                <TableCell class="numeric tabular" data-label="Pessoas">
                  {{ item.members_count ?? '—' }}
                </TableCell>
                <TableCell class="tabular" data-label="Cadastrada em">
                  {{ formatDate(item.created_at) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <nav
          v-if="meta && organizations.length"
          class="pager"
          aria-label="Paginação das empresas"
        >
          <p aria-live="polite">
            {{ meta.total }} {{ meta.total === 1 ? 'empresa' : 'empresas' }} ·
            página {{ meta.current_page }} de {{ meta.last_page }}
            <span v-if="loading"> · atualizando…</span>
          </p>
          <div v-if="meta.last_page > 1" class="pager-buttons">
            <Button
              variant="outline"
              size="sm"
              :disabled="loading || meta.current_page <= 1"
              @click="go(meta.current_page - 1)"
            >
              <ChevronLeft />Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="loading || meta.current_page >= meta.last_page"
              @click="go(meta.current_page + 1)"
            >
              Próxima<ChevronRight />
            </Button>
          </div>
        </nav>
      </div>
    </section>
  </div>
</template>

<style scoped>
.companies {
  display: flex;
  flex-direction: column;
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
.overview {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(0, 2.6fr);
  gap: var(--space-4);
}
.stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.stat-label {
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
  color: var(--color-text-secondary);
}
.stat-value {
  font-size: var(--type-balance);
  font-weight: var(--weight-brand);
  letter-spacing: var(--tracking-title);
  line-height: 1.15;
}
.stat-skeleton {
  width: 64px;
  height: 46px;
}
.stat-base {
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.hint {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-6);
  border-radius: var(--radius-card);
  background: var(--color-brand-subtle-bg);
}
.hint img {
  flex: none;
  object-fit: contain;
}
.hint-text {
  flex: 1;
  min-width: 0;
}
.hint h2 {
  color: var(--color-brand-subtle-fg);
}
.hint p {
  margin-top: var(--space-1);
  max-width: 52ch;
}
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
}
.filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.search {
  width: 340px;
}
.search-row {
  display: flex;
  gap: var(--space-2);
}
.input-icon {
  position: relative;
  flex: 1;
  min-width: 0;
}
.input-icon svg {
  position: absolute;
  top: 50%;
  left: var(--space-3);
  transform: translateY(-50%);
  color: var(--color-text-secondary);
  pointer-events: none;
}
.input-icon :deep(input) {
  padding-left: 40px;
}
.error-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.table-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  box-shadow: var(--elevation-1);
  overflow: hidden;
}
.companies-table :deep(th),
.companies-table :deep(td) {
  padding-left: var(--space-6);
  padding-right: var(--space-6);
}
.companies-table :deep(thead th) {
  height: 48px;
}
.companies-table :deep(tbody tr:last-child) {
  border-bottom: 0;
}
.companies-table :deep(.numeric) {
  text-align: right;
}
.row-head {
  height: var(--table-row-min-height);
  color: var(--color-text-primary);
  font-size: var(--type-body);
  font-weight: var(--weight-normal);
  white-space: normal;
}
.company {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.company-initials {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: var(--radius-control);
  background: var(--color-brand-subtle-bg);
  color: var(--color-brand-subtle-fg);
  font-size: var(--type-secondary);
  font-weight: var(--weight-brand);
}
.company-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.company-name {
  color: var(--color-text-primary);
  font-weight: var(--weight-strong);
  text-decoration: none;
  overflow-wrap: anywhere;
}
.company-name:hover {
  color: var(--color-link);
  text-decoration: underline;
}
.company-meta {
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.skeleton-rows {
  display: flex;
  flex-direction: column;
}
.skeleton-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--table-row-min-height);
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--color-border-subtle);
}
.skeleton-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-6);
}
.empty-title {
  font-weight: var(--weight-strong);
}
.empty button {
  margin-top: var(--space-2);
}
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.pager-buttons {
  display: flex;
  gap: var(--space-2);
}
@media (max-width: 1100px) {
  .overview {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .stat {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--space-3);
  }
  .stat-value {
    order: -1;
    font-size: var(--type-indicator);
  }
  .hint {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    gap: var(--space-3) var(--space-4);
    padding: var(--space-4);
  }
  .hint img {
    width: 56px;
    height: 56px;
  }
  .hint-action {
    grid-column: 1 / -1;
  }
  .filters,
  .filters .field,
  .search {
    width: 100%;
  }
  .filters :deep(.segmented) {
    width: 100%;
  }
  /* Rows become stacked cards so status, people and date stay readable without side scroll. */
  .companies-table :deep(thead) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .companies-table :deep(tbody tr) {
    display: block;
    padding: var(--space-4);
  }
  .companies-table :deep(tbody th),
  .companies-table :deep(tbody td) {
    display: flex;
    height: auto;
    padding: 0;
  }
  .companies-table :deep(tbody td) {
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-2);
    font-size: var(--type-secondary);
  }
  .companies-table :deep(tbody td)::before {
    content: attr(data-label);
    color: var(--color-text-secondary);
  }
  .skeleton-row {
    padding: var(--space-4);
  }
  .pager {
    padding: var(--space-3) var(--space-4);
  }
}
</style>
