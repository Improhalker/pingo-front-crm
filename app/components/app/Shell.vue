<script setup lang="ts">
// Direction B shell: inset dark sidebar (drawer below 960px), floating glass navbar holding the
// page <h1>, and the page content. Shared by the platform and company areas.
import { ChevronRight, Menu } from '@lucide/vue'
import type { NavSection } from '~/config/navigation'
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'

defineProps<{
  sections: NavSection[]
  areaLabel: string
  homeTo: string
}>()
const heading = usePageHeading()
const drawerOpen = ref(false)
const route = useRoute()
watch(
  () => route.fullPath,
  () => (drawerOpen.value = false),
)
</script>

<template>
  <div class="app-shell">
    <a href="#main" class="button skip-link">Pular para o conteúdo</a>
    <aside class="app-sidebar app-sidebar-desktop" :aria-label="areaLabel">
      <AppSidebar
        :sections="sections"
        :area-label="areaLabel"
        :home-to="homeTo"
      >
        <template v-if="$slots.context" #context
          ><slot name="context"
        /></template>
        <template v-if="$slots.note" #note><slot name="note" /></template>
      </AppSidebar>
    </aside>

    <div class="app-main">
      <header class="app-navbar">
        <Sheet v-model:open="drawerOpen">
          <SheetTrigger as-child>
            <Button variant="ghost" size="icon" class="app-menu-button">
              <Menu :size="22" />
              <span class="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" class="app-drawer">
            <SheetTitle class="sr-only">Menu</SheetTitle>
            <SheetDescription class="sr-only">{{ areaLabel }}</SheetDescription>
            <AppSidebar
              :sections="sections"
              :area-label="areaLabel"
              :home-to="homeTo"
              @navigate="drawerOpen = false"
            >
              <template v-if="$slots.context" #context
                ><slot name="context"
              /></template>
              <template v-if="$slots.note" #note><slot name="note" /></template>
            </AppSidebar>
          </SheetContent>
        </Sheet>
        <div class="app-title">
          <nav
            v-if="heading.crumbs?.length"
            class="app-crumbs"
            aria-label="Você está em"
          >
            <template v-for="crumb in heading.crumbs" :key="crumb.label">
              <NuxtLink v-if="crumb.to" :to="crumb.to">{{
                crumb.label
              }}</NuxtLink>
              <span v-else>{{ crumb.label }}</span>
              <ChevronRight :size="14" />
            </template>
            <span aria-current="page">{{ heading.title }}</span>
          </nav>
          <h1>{{ heading.title }}</h1>
        </div>
        <div class="app-actions">
          <slot name="actions" />
        </div>
      </header>
      <main id="main" class="app-content" tabindex="-1">
        <slot />
      </main>
    </div>
    <slot name="floating" />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr);
  gap: var(--space-6);
  min-height: 100dvh;
  padding: var(--space-4);
  background: var(--color-bg);
}
.app-sidebar {
  background: var(--sidebar-bg);
  color: var(--sidebar-fg);
  padding: var(--space-8) var(--space-4) var(--space-6);
}
.app-sidebar-desktop {
  box-shadow: inset 0 0 0 1px var(--sidebar-divider);
  position: sticky;
  top: var(--space-4);
  height: calc(100dvh - var(--space-8));
  overflow-y: auto;
  border-radius: var(--radius-card);
}
.app-main {
  min-width: 0;
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  /* Bottom room so the floating Pingo launcher never covers the last content. */
  padding: 0 var(--space-2) 104px;
}
.app-navbar {
  position: sticky;
  top: var(--space-4);
  z-index: var(--layer-sticky);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 76px;
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6);
  border: 1px solid var(--navbar-border);
  border-radius: var(--radius-card);
  background: var(--navbar-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.3);
  backdrop-filter: blur(var(--glass-blur)) saturate(1.3);
  box-shadow: var(--elevation-1);
}
@supports not (
  (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))
) {
  .app-navbar {
    background: var(--color-surface);
  }
}
.app-menu-button {
  display: none;
}
.app-title {
  flex: 1;
  min-width: 0;
}
.app-crumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  font-size: var(--type-secondary);
  /* Primary text keeps ≥ 4.5:1 even when dark content scrolls under the translucent navbar. */
  color: var(--color-text-primary);
}
.app-crumbs a {
  color: inherit;
}
.app-crumbs a:hover {
  color: var(--color-link);
}
.app-crumbs svg {
  flex: none;
}
.app-crumbs [aria-current='page'] {
  font-weight: var(--weight-strong);
}
.app-title h1 {
  margin-top: 2px;
  overflow-wrap: anywhere;
}
.app-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);
}
.app-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-width: 0;
}
.app-content:focus {
  outline: none;
}
@media (max-width: 960px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--space-3);
  }
  .app-sidebar-desktop {
    display: none;
  }
  .app-menu-button {
    display: inline-flex;
  }
  .app-navbar {
    top: var(--space-3);
    padding-left: var(--space-2);
    gap: var(--space-2);
  }
  .app-main {
    padding: 0 0 96px;
  }
}
/* Short viewports (e.g. 200% zoom): the navbar scrolls away instead of covering content. */
@media (max-height: 560px) {
  .app-navbar {
    position: static;
  }
}
@media (max-width: 640px) {
  .app-navbar {
    position: static;
    flex-wrap: wrap;
    padding: var(--space-2) var(--space-3) var(--space-3) var(--space-2);
  }
  .app-title {
    flex-basis: calc(100% - 110px);
  }
  .app-actions:has(> :nth-child(2)) {
    flex-basis: 100%;
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border-subtle);
  }
}
</style>

<style>
/* The drawer is teleported to <body>, outside the scoped tree. */
.app-drawer {
  width: min(300px, calc(100vw - var(--space-12)));
  max-width: none;
  padding: var(--space-8) var(--space-4) var(--space-6);
  border: 0;
  border-radius: 0 var(--radius-card) var(--radius-card) 0;
  background: var(--sidebar-bg);
  color: var(--sidebar-fg);
  overflow-y: auto;
}
.app-drawer :focus-visible {
  outline-color: var(--sidebar-focus);
}
.app-drawer > button:last-child {
  color: var(--sidebar-fg-secondary);
}
.app-drawer > button:last-child:hover {
  background: var(--sidebar-hover-bg);
  color: var(--sidebar-fg);
}
</style>
