<script setup lang="ts">
import { ApiError } from '~/services/http'
import { pingoAssets } from '~/config/visual-references'
definePageMeta({ layout: false })
const { login, error: sessionError } = useSession()
const email = ref('')
const password = ref('')
const pending = ref(false)
const message = ref('')
const fieldError = ref('')
async function submit() {
  pending.value = true
  message.value = ''
  fieldError.value = ''
  try {
    const signedIn = await login(email.value, password.value)
    password.value = ''
    // Company accounts open their single company directly; masters keep the platform flow (ADR-028).
    await navigateTo(signedIn?.is_platform_administrator ? '/plataforma' : '/')
  } catch (cause) {
    password.value = ''
    if (cause instanceof ApiError) {
      message.value =
        cause.status === 419
          ? 'Sua sessão expirou. Tente entrar novamente.'
          : cause.message
      fieldError.value =
        cause.body.errors?.email?.[0] || cause.body.errors?.password?.[0] || ''
    } else message.value = 'Não conseguimos conectar agora. Tente novamente.'
  } finally {
    pending.value = false
  }
}
</script>
<template>
  <main class="login-page">
    <div class="login-main">
      <header class="login-toolbar">
        <span class="brand"
          ><span class="brand-mark" aria-hidden="true" />PingoFin</span
        ><ThemeSelect />
      </header>
      <form class="login-form" :aria-busy="pending" @submit.prevent="submit">
        <div class="flex flex-col gap-3">
          <h1>Bom ter você aqui.</h1>
          <p class="text-secondary">Entre para acessar sua organização.</p>
        </div>
        <p v-if="message || sessionError" class="notice error" role="alert">
          {{ message || sessionError }}
        </p>
        <div class="field">
          <label for="email">E-mail</label
          ><input
            id="email"
            v-model="email"
            class="control"
            type="email"
            autocomplete="username"
            required
            :disabled="pending"
            :aria-invalid="!!fieldError"
            :aria-describedby="fieldError ? 'login-field-error' : undefined"
          />
        </div>
        <div class="field">
          <label for="password">Senha</label
          ><input
            id="password"
            v-model="password"
            class="control"
            type="password"
            autocomplete="current-password"
            required
            :disabled="pending"
            :aria-invalid="!!fieldError"
            :aria-describedby="fieldError ? 'login-field-error' : undefined"
          />
        </div>
        <p v-if="fieldError" id="login-field-error" class="notice error small">
          {{ fieldError }}
        </p>
        <button class="button" type="submit" :disabled="pending">
          {{ pending ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
      <p class="small text-secondary">
        Seu financeiro em dia, sem complicação.
      </p>
    </div>
    <aside class="login-story" aria-label="Sobre o PingoFin">
      <PingoVisual
        :src="pingoAssets.normal.src"
        alt=""
        :width="148"
        :height="148"
        class="login-pingo"
      />
      <span class="accent-line" aria-hidden="true" /><span class="brand"
        >PingoFin</span
      >
      <h2>Mais clareza.<br />Mais tranquilidade.</h2>
      <p>
        Um espaço simples para organizar o financeiro do seu negócio, sempre ao
        seu lado.
      </p>
    </aside>
  </main>
</template>
