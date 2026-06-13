<script setup>
import { ref } from 'vue';
import { UserRoundCheck } from 'lucide-vue-next';
import api from '../../services/api';

const form = ref({ agentId: '', sellerId: '' });
const saved = ref(false);

async function assign() {
  await api.post('/admin/agent-assignments', form.value);
  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 1800);
}
</script>

<template>
  <section class="panel mx-auto max-w-xl">
    <h1 class="section-title">Agent Assignment</h1>
    <form class="mt-5 space-y-4" @submit.prevent="assign">
      <input v-model="form.agentId" class="input" placeholder="Support agent user ID" required />
      <input v-model="form.sellerId" class="input" placeholder="Seller ID" required />
      <button class="button" type="submit">
        <UserRoundCheck class="h-4 w-4" />
        Assign
      </button>
      <p v-if="saved" class="text-sm font-semibold text-emerald-700">Assigned</p>
    </form>
  </section>
</template>
