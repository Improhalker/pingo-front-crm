<script setup lang="ts">
import { ApiError } from '~/services/http'
definePageMeta({ layout: 'platform', middleware: 'platform' })
const route = useRoute()
const id = computed(() => String(route.params.id))
const {
  detail,
  detailLoading,
  detailError,
  loadDetail,
  updateOrganization,
  setSuspended,
  addAdministrator,
  deleteOrganization,
} = usePlatform()
usePageHeading(() => ({
  title: detail.value?.name ?? 'Empresa',
  crumbs: [
    { label: 'Administração' },
    { label: 'Empresas', to: '/plataforma' },
  ],
}))
const timezones = Intl.supportedValuesOf('timeZone')
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const formatDate = (value: string | null) =>
  value ? dateFormat.format(new Date(value)) : '—'
const roleLabel = (role: string) =>
  role === 'ADMIN' ? 'Administrador' : 'Operador'

function messageFor(cause: unknown, fallback: string) {
  if (cause instanceof ApiError) {
    if (cause.status === 422) return 'Confira os campos indicados.'
    if (cause.status === 404)
      return 'Esta empresa não existe mais. Volte para a lista.'
    if (cause.status === 409 || cause.status === 429) return cause.message
  }
  return fallback
}

// Registration data
const name = ref('')
const timezone = ref('')
const editPending = ref(false)
const editMessage = ref('')
const editSaved = ref(false)
const editErrors = ref<Record<string, string[]>>({})
const editErr = (key: string) => fieldMessage(editErrors.value, key)
function resetEditForm() {
  name.value = detail.value?.name ?? ''
  timezone.value = detail.value?.timezone ?? ''
}
const editDirty = computed(
  () =>
    !!detail.value &&
    (name.value !== detail.value.name ||
      timezone.value !== detail.value.timezone),
)
async function saveEdit() {
  if (editPending.value || !detail.value) return
  editPending.value = true
  editMessage.value = ''
  editSaved.value = false
  editErrors.value = {}
  try {
    if (
      await updateOrganization(id.value, {
        name: name.value,
        timezone: timezone.value,
      })
    ) {
      editSaved.value = true
      resetEditForm()
    }
  } catch (cause) {
    editErrors.value =
      cause instanceof ApiError ? (cause.body.errors ?? {}) : {}
    editMessage.value = messageFor(
      cause,
      'Não foi possível salvar. Nada foi alterado; tente novamente.',
    )
  } finally {
    editPending.value = false
  }
}

// New administrator
const adminOpen = ref(false)
const adminName = ref('')
const adminEmail = ref('')
const adminPassword = ref('')
const adminConfirmation = ref('')
const adminPending = ref(false)
const adminMessage = ref('')
const adminSaved = ref('')
const adminErrors = ref<Record<string, string[]>>({})
const adminErr = (key: string) => fieldMessage(adminErrors.value, key)
async function saveAdmin() {
  if (adminPending.value) return
  adminPending.value = true
  adminMessage.value = ''
  adminSaved.value = ''
  adminErrors.value = {}
  try {
    const email = adminEmail.value
    const done = await addAdministrator(id.value, {
      name: adminName.value,
      email,
      password: adminPassword.value,
      password_confirmation: adminConfirmation.value,
    })
    if (done) {
      adminSaved.value = `${adminName.value} agora administra esta empresa e já pode entrar com ${email.trim().toLowerCase()}.`
      adminName.value = ''
      adminEmail.value = ''
      adminOpen.value = false
    }
  } catch (cause) {
    adminErrors.value =
      cause instanceof ApiError ? (cause.body.errors ?? {}) : {}
    adminMessage.value = messageFor(
      cause,
      'Não foi possível adicionar a pessoa. Nada foi salvo; tente novamente.',
    )
  } finally {
    // Credentials never outlive the submission, whatever its outcome.
    adminPassword.value = ''
    adminConfirmation.value = ''
    adminPending.value = false
  }
}

// Suspension
const suspendDialog = useTemplateRef<{ open: () => void; close: () => void }>(
  'suspendDialog',
)
const suspendPending = ref(false)
const suspendError = ref('')
const statusMessage = ref('')
function openSuspension() {
  suspendError.value = ''
  suspendDialog.value?.open()
}
async function confirmSuspension() {
  if (!detail.value || suspendPending.value) return
  const suspend = detail.value.status === 'ACTIVE'
  suspendPending.value = true
  suspendError.value = ''
  statusMessage.value = ''
  try {
    if (await setSuspended(id.value, suspend)) {
      suspendDialog.value?.close()
      statusMessage.value = suspend
        ? 'Empresa suspensa. As pessoas vinculadas não conseguem mais abri-la.'
        : 'Empresa reativada. O acesso das pessoas vinculadas foi restabelecido.'
    }
  } catch (cause) {
    suspendError.value = messageFor(
      cause,
      'Não foi possível alterar a situação. Tente novamente.',
    )
  } finally {
    suspendPending.value = false
  }
}

// Deletion
const deleteDialog = useTemplateRef<{ open: () => void; close: () => void }>(
  'deleteDialog',
)
const deletePending = ref(false)
const deleteError = ref('')
const exclusiveAccounts = computed(
  () => detail.value?.members.filter((m) => m.only_in_this_organization) ?? [],
)
function openDelete() {
  deleteError.value = ''
  deleteDialog.value?.open()
}
async function confirmDelete(typed: string) {
  if (deletePending.value) return
  deletePending.value = true
  deleteError.value = ''
  try {
    if (await deleteOrganization(id.value, typed)) {
      deleteDialog.value?.close()
      await navigateTo('/plataforma')
    }
  } catch (cause) {
    deleteError.value =
      cause instanceof ApiError && cause.status === 422
        ? (cause.body.errors?.confirmation_name?.[0] ??
          'Digite o nome exato da empresa.')
        : messageFor(cause, 'Não foi possível excluir. Nada foi apagado.')
  } finally {
    deletePending.value = false
  }
}

async function refresh() {
  editSaved.value = false
  statusMessage.value = ''
  adminSaved.value = ''
  await loadDetail(id.value)
  resetEditForm()
}
watch(id, refresh)
onMounted(refresh)
</script>

<template>
  <div class="flex flex-col gap-6">
    <p v-if="detailLoading && !detail" role="status">Carregando empresa…</p>
    <div v-else-if="detailError" class="notice error" role="alert">
      <p>{{ detailError }}</p>
      <button class="button secondary" type="button" @click="refresh">
        Tentar novamente
      </button>
    </div>

    <template v-if="detail">
      <p class="small text-secondary detail-meta">
        <PlatformStatusBadge :status="detail.status" />
        <span>Cadastrada em {{ formatDate(detail.created_at) }}</span>
        <span v-if="detail.suspended_at"
          >· Suspensa em {{ formatDate(detail.suspended_at) }}</span
        >
      </p>
      <p v-if="statusMessage" class="notice success" role="status">
        {{ statusMessage }}
      </p>

      <section class="card flex flex-col gap-4" aria-labelledby="data-title">
        <h2 id="data-title">Dados da empresa</h2>
        <form
          class="form-grid"
          :aria-busy="editPending"
          novalidate
          @submit.prevent="saveEdit"
        >
          <p v-if="editMessage" class="notice error" role="alert">
            {{ editMessage }}
          </p>
          <p v-if="editSaved" class="notice success" role="status">
            Alterações salvas.
          </p>
          <fieldset class="form-section" :disabled="editPending">
            <legend class="sr-only">Dados cadastrais</legend>
            <div class="field">
              <label for="edit-name">Nome da empresa</label>
              <input
                id="edit-name"
                v-model="name"
                class="control"
                type="text"
                autocomplete="off"
                maxlength="120"
                required
                :aria-invalid="!!editErr('name')"
                :aria-describedby="
                  editErr('name') ? 'edit-name-error' : undefined
                "
                @input="editSaved = false"
              />
              <p
                v-if="editErr('name')"
                id="edit-name-error"
                class="small field-error"
              >
                {{ editErr('name') }}
              </p>
            </div>
            <div class="field">
              <label for="edit-timezone">Fuso horário</label>
              <input
                id="edit-timezone"
                v-model="timezone"
                class="control"
                type="text"
                list="edit-timezone-options"
                autocomplete="off"
                required
                :aria-invalid="!!editErr('timezone')"
                aria-describedby="edit-timezone-hint edit-timezone-error"
                @input="editSaved = false"
              />
              <datalist id="edit-timezone-options">
                <option v-for="item in timezones" :key="item" :value="item" />
              </datalist>
              <p id="edit-timezone-hint" class="small text-secondary">
                Nome IANA, por exemplo America/Sao_Paulo.
              </p>
              <p
                v-if="editErr('timezone')"
                id="edit-timezone-error"
                class="small field-error"
              >
                {{ editErr('timezone') }}
              </p>
            </div>
          </fieldset>
          <div class="form-actions">
            <button
              class="button"
              type="submit"
              :disabled="editPending || !editDirty"
            >
              {{ editPending ? 'Salvando…' : 'Salvar alterações' }}
            </button>
            <button
              v-if="editDirty"
              class="button secondary"
              type="button"
              :disabled="editPending"
              @click="resetEditForm"
            >
              Descartar
            </button>
          </div>
        </form>
      </section>

      <section class="card flex flex-col gap-4" aria-labelledby="people-title">
        <div class="page-heading">
          <div class="flex flex-col gap-2">
            <h2 id="people-title">Pessoas com acesso</h2>
            <p class="small text-secondary">
              {{ detail.members.length }}
              {{ detail.members.length === 1 ? 'pessoa' : 'pessoas' }}. A equipe
              é gerida pela própria empresa; aqui você pode incluir outra pessoa
              administradora.
            </p>
          </div>
          <button
            v-if="!adminOpen"
            class="button secondary"
            type="button"
            @click="adminOpen = true"
          >
            Adicionar administrador
          </button>
        </div>
        <p v-if="adminSaved" class="notice success" role="status">
          {{ adminSaved }}
        </p>
        <p v-if="!detail.members.length" class="text-secondary">
          Nenhuma pessoa tem acesso a esta empresa. Adicione uma pessoa
          administradora para que ela possa ser usada.
        </p>
        <div v-else class="table-wrap">
          <table class="data-table">
            <caption class="sr-only">
              Pessoas com acesso a
              {{
                detail.name
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">E-mail</th>
                <th scope="col">Papel</th>
                <th scope="col">Desde</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in detail.members" :key="member.id">
                <th scope="row">
                  {{ member.name }}
                  <p
                    v-if="member.has_other_organizations"
                    class="small legacy-link"
                  >
                    Vínculo com outra empresa: acesso bloqueado até o ajuste
                    (comando platform:legacy-memberships).
                  </p>
                </th>
                <td>{{ member.email }}</td>
                <td>{{ roleLabel(member.role) }}</td>
                <td class="tabular">{{ formatDate(member.joined_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <form
          v-if="adminOpen"
          class="form-grid admin-form"
          :aria-busy="adminPending"
          novalidate
          @submit.prevent="saveAdmin"
        >
          <p v-if="adminMessage" class="notice error" role="alert">
            {{ adminMessage }}
          </p>
          <fieldset class="form-section" :disabled="adminPending">
            <legend>Nova pessoa administradora</legend>
            <div class="field">
              <label for="new-admin-name">Nome</label>
              <input
                id="new-admin-name"
                v-model="adminName"
                class="control"
                type="text"
                autocomplete="off"
                maxlength="120"
                required
                :aria-invalid="!!adminErr('name')"
                :aria-describedby="
                  adminErr('name') ? 'new-admin-name-error' : undefined
                "
              />
              <p
                v-if="adminErr('name')"
                id="new-admin-name-error"
                class="small field-error"
              >
                {{ adminErr('name') }}
              </p>
            </div>
            <div class="field">
              <label for="new-admin-email">E-mail</label>
              <input
                id="new-admin-email"
                v-model="adminEmail"
                class="control"
                type="email"
                autocomplete="off"
                maxlength="254"
                required
                :aria-invalid="!!adminErr('email')"
                :aria-describedby="
                  adminErr('email') ? 'new-admin-email-error' : undefined
                "
              />
              <p
                v-if="adminErr('email')"
                id="new-admin-email-error"
                class="small field-error"
              >
                {{ adminErr('email') }}
              </p>
            </div>
            <div class="field">
              <label for="new-admin-password">Senha inicial</label>
              <input
                id="new-admin-password"
                v-model="adminPassword"
                class="control"
                type="password"
                autocomplete="new-password"
                required
                :aria-invalid="!!adminErr('password')"
                aria-describedby="new-admin-password-hint new-admin-password-error"
              />
              <p id="new-admin-password-hint" class="small text-secondary">
                Use pelo menos 12 caracteres, com letras e números.
              </p>
              <p
                v-if="adminErr('password')"
                id="new-admin-password-error"
                class="small field-error"
              >
                {{ adminErr('password') }}
              </p>
            </div>
            <div class="field">
              <label for="new-admin-confirmation">Confirme a senha</label>
              <input
                id="new-admin-confirmation"
                v-model="adminConfirmation"
                class="control"
                type="password"
                autocomplete="new-password"
                required
              />
            </div>
          </fieldset>
          <div class="form-actions">
            <button class="button" type="submit" :disabled="adminPending">
              {{ adminPending ? 'Adicionando…' : 'Adicionar administrador' }}
            </button>
            <button
              class="button secondary"
              type="button"
              :disabled="adminPending"
              @click="adminOpen = false"
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>

      <section class="card flex flex-col gap-4" aria-labelledby="status-title">
        <h2 id="status-title">Situação</h2>
        <template v-if="detail.status === 'ACTIVE'">
          <p class="text-secondary">
            A empresa está ativa. Suspender bloqueia o acesso de todas as
            pessoas vinculadas, sem apagar dados. Você pode reativar depois.
          </p>
          <div>
            <button
              class="button secondary"
              type="button"
              @click="openSuspension"
            >
              Suspender empresa
            </button>
          </div>
        </template>
        <template v-else>
          <p class="text-secondary">
            A empresa está suspensa: as pessoas vinculadas não conseguem
            abri-la. Os dados e os acessos continuam guardados.
          </p>
          <div>
            <button class="button" type="button" @click="openSuspension">
              Reativar empresa
            </button>
          </div>
        </template>
      </section>

      <section
        class="card danger-zone flex flex-col gap-4"
        aria-labelledby="delete-title"
      >
        <h2 id="delete-title">Excluir empresa</h2>
        <p class="text-secondary">
          A exclusão é permanente e não pode ser desfeita. Remove a empresa e
          todos os acessos a ela.
          <template v-if="exclusiveAccounts.length">
            {{
              exclusiveAccounts.length === 1
                ? '1 conta que só acessa esta empresa também será excluída.'
                : `${exclusiveAccounts.length} contas que só acessam esta empresa também serão excluídas.`
            }}
          </template>
          Se a ideia é apenas interromper o uso, prefira suspender.
        </p>
        <div>
          <button class="button danger" type="button" @click="openDelete">
            Excluir empresa
          </button>
        </div>
      </section>

      <PlatformConfirmDialog
        ref="suspendDialog"
        :title="
          detail.status === 'ACTIVE'
            ? 'Suspender esta empresa?'
            : 'Reativar esta empresa?'
        "
        :confirm-label="
          detail.status === 'ACTIVE' ? 'Suspender empresa' : 'Reativar empresa'
        "
        :pending-label="
          detail.status === 'ACTIVE' ? 'Suspendendo…' : 'Reativando…'
        "
        :pending="suspendPending"
        :error="suspendError"
        @confirm="confirmSuspension"
      >
        <p v-if="detail.status === 'ACTIVE'">
          {{ detail.members.length }}
          {{ detail.members.length === 1 ? 'pessoa' : 'pessoas' }} de
          {{ detail.name }} deixarão de conseguir abrir a empresa. Nenhum dado
          será apagado.
        </p>
        <p v-else>
          As pessoas vinculadas a {{ detail.name }} voltarão a conseguir abrir a
          empresa.
        </p>
      </PlatformConfirmDialog>

      <PlatformConfirmDialog
        ref="deleteDialog"
        title="Excluir esta empresa?"
        confirm-label="Excluir definitivamente"
        pending-label="Excluindo…"
        danger
        :require-text="detail.name"
        :pending="deletePending"
        :error="deleteError"
        @confirm="confirmDelete"
      >
        <p>
          {{ detail.name }} e os acessos de
          {{ detail.members.length }}
          {{ detail.members.length === 1 ? 'pessoa' : 'pessoas' }} serão
          removidos permanentemente.
        </p>
        <p v-if="exclusiveAccounts.length">
          Contas excluídas junto, por não terem acesso a outra empresa:
          {{ exclusiveAccounts.map((m) => m.email).join(', ') }}.
        </p>
      </PlatformConfirmDialog>
    </template>
  </div>
</template>
