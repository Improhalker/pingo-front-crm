<script setup lang="ts">
import type { NavSection } from '~/config/navigation'
import { pingoAssets } from '~/config/visual-references'

defineProps<{
  sections: NavSection[]
  areaLabel: string
  homeTo: string
}>()
const emit = defineEmits<{ navigate: [] }>()
const route = useRoute()
</script>

<template>
  <div class="sidebar-inner">
    <NuxtLink :to="homeTo" class="sidebar-brand" @click="emit('navigate')">
      <span class="brand"
        ><span class="brand-mark" aria-hidden="true" />PingoFin</span
      >
      <span class="sidebar-area">{{ areaLabel }}</span>
    </NuxtLink>
    <slot name="context" />
    <nav class="sidebar-nav" :aria-label="`Navegação · ${areaLabel}`">
      <div v-for="section in sections" :key="section.label" class="nav-section">
        <p class="nav-section-title">{{ section.label }}</p>
        <ul>
          <li v-for="item in section.items" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="nav-item"
              :aria-current="item.isCurrent(route.path) ? 'page' : undefined"
              @click="emit('navigate')"
            >
              <PingoVisual
                v-if="item.pingo"
                :src="pingoAssets.normal.src"
                alt=""
                :width="22"
                :height="22"
              />
              <component
                :is="item.icon"
                v-else-if="item.icon"
                :size="20"
                :stroke-width="1.75"
              />
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>
    <div v-if="$slots.note" class="sidebar-note">
      <slot name="note" />
    </div>
  </div>
</template>

<style scoped>
.sidebar-inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-height: 100%;
}
.sidebar-brand {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: 0 var(--space-3);
  color: var(--sidebar-fg);
  text-decoration: none;
  border-radius: var(--radius-control);
}
.sidebar-area {
  font-size: var(--type-secondary);
  color: var(--sidebar-fg-secondary);
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.nav-section ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.nav-section-title {
  padding: 0 var(--space-3) var(--space-2);
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
  color: var(--sidebar-fg-secondary);
}
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 48px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-control);
  color: var(--sidebar-fg-secondary);
  font-weight: var(--weight-heading);
  text-decoration: none;
  transition:
    background-color var(--motion-fast) var(--motion-ease),
    color var(--motion-fast) var(--motion-ease);
}
.nav-item img {
  object-fit: contain;
  flex: none;
}
.nav-item:hover {
  background: var(--sidebar-hover-bg);
  color: var(--sidebar-fg);
}
/* Current page: brighter surface, white text, yellow icon and aria-current (not color alone). */
.nav-item[aria-current='page'] {
  background: var(--sidebar-current-bg);
  color: var(--sidebar-active-fg);
  box-shadow: inset 3px 0 0 var(--color-accent-bg);
}
.nav-item[aria-current='page'] svg {
  color: var(--color-accent-bg);
}
.sidebar-note {
  margin-top: auto;
  padding: var(--space-4);
  border-radius: var(--radius-control);
  background: rgb(255 255 255 / 0.06);
  color: var(--sidebar-fg-secondary);
  font-size: var(--type-secondary);
}
:focus-visible {
  outline-color: var(--sidebar-focus);
}
</style>
