<script setup lang="ts">
// Card hosting a record list: the shadcn table on wide screens and stacked rows on phones, where each
// cell shows its data-label. Pages place the table, loading (.list-skeleton), empty (.list-empty) and pager.
</script>

<template>
  <div class="list-card"><slot /></div>
</template>

<style scoped>
.list-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  box-shadow: var(--elevation-1);
  overflow: hidden;
}
.list-card :deep(th),
.list-card :deep(td) {
  padding-left: var(--space-4);
  padding-right: var(--space-4);
}
.list-card :deep(tr > :first-child) {
  padding-left: var(--space-6);
}
.list-card :deep(tr > :last-child) {
  padding-right: var(--space-6);
}
.list-card :deep(thead th) {
  height: 48px;
}
.list-card :deep(tbody tr:last-child) {
  border-bottom: 0;
}
.list-card :deep(.numeric) {
  text-align: right;
  white-space: nowrap;
}
.list-card :deep(.row-head) {
  height: var(--table-row-min-height);
  color: var(--color-text-primary);
  font-size: var(--type-body);
  font-weight: var(--weight-normal);
  white-space: normal;
}
.list-card :deep(.row-title) {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.list-card :deep(.row-name) {
  color: var(--color-text-primary);
  font-weight: var(--weight-strong);
  overflow-wrap: anywhere;
}
.list-card :deep(a.row-name) {
  text-decoration: none;
}
.list-card :deep(a.row-name:hover) {
  color: var(--color-link);
  text-decoration: underline;
}
.list-card :deep(.row-meta) {
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.list-card :deep(.row-actions) {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.list-card :deep(.list-skeleton) {
  display: flex;
  flex-direction: column;
}
.list-card :deep(.list-skeleton-row) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--table-row-min-height);
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--color-border-subtle);
}
.list-card :deep(.list-empty) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-6);
}
.list-card :deep(.list-empty-title) {
  font-weight: var(--weight-strong);
}
.list-card :deep(.list-empty > a),
.list-card :deep(.list-empty > button) {
  margin-top: var(--space-2);
}
@media (max-width: 640px) {
  .list-card :deep(thead) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .list-card :deep(tbody tr) {
    display: block;
    padding: var(--space-4);
  }
  /* :nth-child(n) outranks the first/last-child padding of the wide layout. */
  .list-card :deep(tbody tr > :nth-child(n)) {
    display: flex;
    height: auto;
    padding: 0;
    white-space: normal;
  }
  .list-card :deep(tbody td) {
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-2);
    font-size: var(--type-secondary);
    text-align: right;
  }
  .list-card :deep(tbody td[data-label])::before {
    content: attr(data-label);
    color: var(--color-text-secondary);
    text-align: left;
  }
  .list-card :deep(tbody td.row-actions-cell) {
    justify-content: flex-start;
    margin-top: var(--space-3);
  }
  .list-card :deep(.row-actions) {
    justify-content: flex-start;
  }
  .list-card :deep(.list-skeleton-row),
  .list-card :deep(.list-empty) {
    padding: var(--space-4);
  }
}
</style>
