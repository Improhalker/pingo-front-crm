<script setup lang="ts">
// Search box for record lists. It lives inside the caller's role="search" form, which applies it.
import { Search } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

defineProps<{ label: string; disabled?: boolean }>()
const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="field search-field">
    <label :for="id">{{ label }}</label>
    <div class="search-row">
      <div class="input-icon">
        <Search :size="18" aria-hidden="true" />
        <Input
          :id="id"
          v-model="model"
          type="search"
          maxlength="120"
          autocomplete="off"
        />
      </div>
      <Button type="submit" variant="outline" :disabled="disabled">
        Buscar
      </Button>
    </div>
  </div>
</template>

<style scoped>
.search-field {
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
@media (max-width: 640px) {
  .search-field {
    width: 100%;
  }
}
</style>
