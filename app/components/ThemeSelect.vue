<script setup lang="ts">
const { preference, setPreference } = useTheme()
const id = useId()
</script>
<template>
  <div class="field theme-control">
    <label :for="id">Aparência</label>
    <select
      :id="id"
      class="control"
      :value="preference"
      @change="setPreference(($event.target as HTMLSelectElement).value)"
    >
      <option value="light">Clara</option>
      <option value="dark">Escura</option>
      <option value="system">Sistema</option>
    </select>
  </div>
</template>
