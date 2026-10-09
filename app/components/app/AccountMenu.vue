<script setup lang="ts">
// Account and appearance, grouped in one menu: identity (read-only), real theme preference and
// sign-out. No profile/settings entries exist because those screens do not exist.
import { ChevronDown, LogOut, Monitor, Moon, Sun } from '@lucide/vue'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

const props = defineProps<{
  name: string
  email: string
  role: string
  leaving: boolean
}>()
const emit = defineEmits<{ logout: [] }>()
const { preference, setPreference } = useTheme()
const initials = computed(
  () =>
    props.name
      .split(/\s+/)
      .filter((part) => part.length > 1)
      .slice(0, 2)
      .map((part) => part[0]!.toLocaleUpperCase('pt-BR'))
      .join('') || '?',
)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="account-trigger">
        <Avatar class="size-9" aria-hidden="true">
          <AvatarFallback class="account-avatar">{{ initials }}</AvatarFallback>
        </Avatar>
        <span class="account-text">
          <span class="account-name">{{ name }}</span>
          <span class="account-role">{{ role }}</span>
        </span>
        <ChevronDown class="account-chevron" :size="18" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-72">
      <DropdownMenuLabel class="account-label">
        <span class="label-name">{{ name }}</span>
        <span class="label-email">{{ email }}</span>
        <span class="label-role">{{ role }}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Aparência</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        :model-value="preference"
        @update:model-value="setPreference(String($event))"
      >
        <DropdownMenuRadioItem value="light"
          ><Sun />Clara</DropdownMenuRadioItem
        >
        <DropdownMenuRadioItem value="dark"
          ><Moon />Escura</DropdownMenuRadioItem
        >
        <DropdownMenuRadioItem value="system"
          ><Monitor />Igual ao sistema</DropdownMenuRadioItem
        >
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem :disabled="leaving" @select="emit('logout')">
        <LogOut />{{ leaving ? 'Saindo…' : 'Sair' }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<style scoped>
.account-trigger {
  height: auto;
  min-height: 44px;
  padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1);
  gap: var(--space-3);
  font-weight: var(--weight-normal);
}
.account-avatar {
  background: var(--color-action-primary-bg);
  color: var(--color-action-primary-fg);
  font-size: var(--type-secondary);
}
.account-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.25;
  max-width: 240px;
}
.account-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--type-secondary);
  font-weight: var(--weight-strong);
}
.account-role {
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.account-chevron {
  color: var(--color-text-secondary);
}
.account-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--color-text-primary);
}
.label-name {
  font-size: var(--type-body);
  font-weight: var(--weight-strong);
  overflow-wrap: anywhere;
}
.label-email,
.label-role {
  font-weight: var(--weight-normal);
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
@media (max-width: 1100px) {
  /* Visually hidden but still the accessible name of the trigger. */
  .account-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .account-chevron {
    display: none;
  }
  .account-trigger {
    padding: var(--space-1);
  }
}
</style>
