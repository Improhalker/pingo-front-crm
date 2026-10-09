<script setup lang="ts">
import { ApiError } from '~/services/http'
definePageMeta({ layout: 'platform', middleware: 'platform' })
usePageHeading({
  title: 'Cadastrar empresa',
  crumbs: [
    { label: 'Administração' },
    { label: 'Empresas', to: '/plataforma' },
  ],
})
const { provision } = usePlatform()
const timezones = Intl.supportedValuesOf('timeZone')
const companyName = ref('')
const timezone = ref('America/Sao_Paulo')
const adminName = ref('')
const adminEmail = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const pending = ref(false)
const message = ref('')
const errors = ref<Record<string, string[]>>({})
const passwordHint =
  'Use pelo menos 12 caracteres, com letras e números. Compartilhe a senha inicial de forma segura.'
async function submit() {
  if (pending.value) return
  pending.value = true
  message.value = ''
  errors.value = {}
  try {
    const done = await provision({
      organization: { name: companyName.value, timezone: timezone.value },
      administrator: {
        name: adminName.value,
        email: adminEmail.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      },
    })
    // false: session changed or access was lost; the composable already redirected.
    if (done) await navigateTo('/plataforma')
  } catch (cause) {
    if (cause instanceof ApiError) {
      errors.value = cause.body.errors ?? {}
      message.value =
        cause.status === 422
          ? 'Confira os campos indicados abaixo.'
          : cause.status === 429
            ? cause.message
            : 'Não foi possível cadastrar a empresa. Nada foi salvo; tente novamente.'
    } else
      message.value =
        'Não conseguimos conectar agora. Nada foi salvo; tente novamente.'
  } finally {
    // Credentials never outlive the submission, whatever its outcome.
    password.value = ''
    passwordConfirmation.value = ''
    pending.value = false
  }
}
const err = (key: string) => fieldMessage(errors.value, key)
</script>
<template>
  <div class="provision">
    <p class="intro text-secondary">
      Cria a empresa e a pessoa que vai administrá-la. Depois do cadastro, essa
      pessoa entra pela tela de acesso da empresa.
    </p>
    <form
      class="form-grid provision-form"
      :aria-busy="pending"
      novalidate
      @submit.prevent="submit"
    >
      <p v-if="message" class="notice error" role="alert">
        {{ message }}
      </p>
      <fieldset class="card form-section" :disabled="pending">
        <legend class="section-legend">
          <span class="step" aria-hidden="true">1</span>Empresa
        </legend>
        <div class="field">
          <label for="company-name">Nome da empresa</label>
          <input
            id="company-name"
            v-model="companyName"
            class="control"
            type="text"
            autocomplete="off"
            required
            maxlength="120"
            :aria-invalid="!!err('organization.name')"
            :aria-describedby="
              err('organization.name') ? 'company-name-error' : undefined
            "
          />
          <p
            v-if="err('organization.name')"
            id="company-name-error"
            class="small field-error"
          >
            {{ err('organization.name') }}
          </p>
        </div>
        <div class="field">
          <label for="company-timezone">Fuso horário</label>
          <input
            id="company-timezone"
            v-model="timezone"
            class="control"
            type="text"
            list="timezone-options"
            autocomplete="off"
            required
            :aria-invalid="!!err('organization.timezone')"
            aria-describedby="company-timezone-hint company-timezone-error"
          />
          <datalist id="timezone-options">
            <option v-for="item in timezones" :key="item" :value="item" />
          </datalist>
          <p id="company-timezone-hint" class="small text-secondary">
            Nome IANA, por exemplo America/Sao_Paulo.
          </p>
          <p
            v-if="err('organization.timezone')"
            id="company-timezone-error"
            class="small field-error"
          >
            {{ err('organization.timezone') }}
          </p>
        </div>
      </fieldset>
      <fieldset class="card form-section" :disabled="pending">
        <legend class="section-legend">
          <span class="step" aria-hidden="true">2</span>Primeira pessoa
          administradora
        </legend>
        <div class="field">
          <label for="admin-name">Nome</label>
          <input
            id="admin-name"
            v-model="adminName"
            class="control"
            type="text"
            autocomplete="off"
            required
            maxlength="120"
            :aria-invalid="!!err('administrator.name')"
            :aria-describedby="
              err('administrator.name') ? 'admin-name-error' : undefined
            "
          />
          <p
            v-if="err('administrator.name')"
            id="admin-name-error"
            class="small field-error"
          >
            {{ err('administrator.name') }}
          </p>
        </div>
        <div class="field">
          <label for="admin-email">E-mail</label>
          <input
            id="admin-email"
            v-model="adminEmail"
            class="control"
            type="email"
            autocomplete="off"
            required
            maxlength="254"
            :aria-invalid="!!err('administrator.email')"
            :aria-describedby="
              err('administrator.email') ? 'admin-email-error' : undefined
            "
          />
          <p
            v-if="err('administrator.email')"
            id="admin-email-error"
            class="small field-error"
          >
            {{ err('administrator.email') }}
          </p>
        </div>
        <div class="field">
          <label for="admin-password">Senha inicial</label>
          <input
            id="admin-password"
            v-model="password"
            class="control"
            type="password"
            autocomplete="new-password"
            required
            :aria-invalid="!!err('administrator.password')"
            aria-describedby="admin-password-hint admin-password-error"
          />
          <p id="admin-password-hint" class="small text-secondary">
            {{ passwordHint }}
          </p>
          <p
            v-if="err('administrator.password')"
            id="admin-password-error"
            class="small field-error"
          >
            {{ err('administrator.password') }}
          </p>
        </div>
        <div class="field">
          <label for="admin-password-confirmation">Confirme a senha</label>
          <input
            id="admin-password-confirmation"
            v-model="passwordConfirmation"
            class="control"
            type="password"
            autocomplete="new-password"
            required
          />
        </div>
      </fieldset>
      <div class="form-actions">
        <button class="button" type="submit" :disabled="pending">
          {{ pending ? 'Cadastrando…' : 'Cadastrar empresa' }}
        </button>
        <NuxtLink to="/plataforma" class="button ghost">Cancelar</NuxtLink>
      </div>
    </form>
  </div>
</template>

<style scoped>
.provision {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 760px;
}
.intro {
  max-width: 62ch;
}
.provision-form {
  max-width: none;
  gap: var(--space-4);
}
/* Each group is a card: restore the card box that .form-section resets. */
.form-section.card {
  padding: var(--card-padding);
  border: 1px solid var(--card-border);
}
/* A floated legend becomes a normal grid item spanning the row, inside the card padding,
   instead of being drawn over the fieldset border. */
.section-legend {
  float: left;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.step {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: var(--radius-control);
  background: var(--color-brand-subtle-bg);
  color: var(--color-brand-subtle-fg);
  font-size: var(--type-secondary);
  font-weight: var(--weight-brand);
}
.form-actions {
  padding-top: var(--space-2);
}
</style>
