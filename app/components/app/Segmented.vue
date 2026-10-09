<script setup lang="ts">
// Single-choice segmented control (radiogroup): arrow keys move and select, Tab leaves the group.
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'

defineProps<{
  options: { value: string; label: string }[]
  disabled?: boolean
}>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <RadioGroupRoot
    v-model="model"
    class="segmented"
    orientation="horizontal"
    loop
    :disabled="disabled"
  >
    <RadioGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="segment"
    >
      {{ option.label }}
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  height: var(--control-height);
  padding: var(--space-1);
  gap: 2px;
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-control);
  background: var(--color-surface-secondary);
}
.segment {
  flex: 1;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-inner);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
  white-space: nowrap;
  transition:
    background-color var(--motion-fast) var(--motion-ease),
    color var(--motion-fast) var(--motion-ease);
}
.segment:hover:not([data-disabled]):not([data-state='checked']) {
  color: var(--color-text-primary);
}
/* Selected: filled primary segment (≥ 3:1 against the group) plus heavier weight. */
.segment[data-state='checked'] {
  background: var(--color-selected-bg);
  color: var(--color-selected-fg);
  font-weight: var(--weight-strong);
}
.segment:focus-visible {
  outline-offset: 1px;
}
.segment[data-disabled] {
  cursor: not-allowed;
}
</style>
