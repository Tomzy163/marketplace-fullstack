<script setup>
import { onMounted, ref } from 'vue';
import api from '../../services/api';

const logs = ref([]);

onMounted(async () => {
  const { data } = await api.get('/admin/audit-logs');
  logs.value = data;
});
</script>

<template>
  <section class="panel overflow-hidden p-0">
    <div class="border-b border-slate-200 p-5">
      <h1 class="section-title">Audit Log</h1>
    </div>
    <table class="w-full min-w-[840px]">
      <thead class="table-header">
        <tr>
          <th class="px-4 py-3">Time</th>
          <th class="px-4 py-3">Actor</th>
          <th class="px-4 py-3">Action</th>
          <th class="px-4 py-3">Resource</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log.id">
          <td class="table-cell">{{ new Date(log.created_at).toLocaleString() }}</td>
          <td class="table-cell">{{ log.actor_email || 'system' }}</td>
          <td class="table-cell font-semibold">{{ log.action }}</td>
          <td class="table-cell">{{ log.resource }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
