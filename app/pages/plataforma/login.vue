<script setup lang="ts">
import { ApiError } from '~/services/http'
definePageMeta({ layout: false })
const { loginPlatform, error: sessionError } = useSession()
const email = ref('')
const password = ref('')
const pending = ref(false)
const message = ref('')
async function submit() {
  if (pending.value) return
  pending.value = true
  message.value = ''
  try {
    await loginPlatform(email.value, password.value)
    password.value = ''
    await navigateTo('/plataforma')
  } catch (cause) {
    password.value = ''
    if (cause instanceof ApiError) {
      message.value =
        cause.status === 419
          ? 'Sua sessão expirou. Tente entrar novamente.'
          : cause.body.errors?.email?.[0] || cause.message
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
          <h1>Administração do PingoFin</h1>
          <p class="text-secondary">
            Entrada exclusiva da equipe do PingoFin. Se você usa o PingoFin na
            sua empresa,
            <NuxtLink to="/login">entre por aqui</NuxtLink>.
          </p>
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
          />
        </div>
        <button class="button" type="submit" :disabled="pending">
          {{ pending ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
      <p class="small text-secondary">
        Seu financeiro em dia, sem complicação.
      </p>
    </div>
    <aside class="login-story" aria-label="Sobre a administração">
      <span class="accent-line" aria-hidden="true" /><span class="brand"
        >PingoFin</span
      >
      <h2>Empresas clientes,<br />cada uma no seu espaço.</h2>
      <p>
        Cadastre uma empresa e a pessoa que vai administrá-la. Os dados de cada
        empresa continuam separados.
      </p>
    </aside>
  </main>
</template>
