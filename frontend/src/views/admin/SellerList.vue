<script setup>
import { onMounted, ref } from 'vue';
import { BadgeCheck } from 'lucide-vue-next';
import api from '../../services/api';

const sellers = ref([]);

async function load() {
  const { data } = await api.get('/admin/sellers');
  sellers.value = data;
}

async function verifySeller(seller) {
  await api.patch(`/admin/sellers/${seller.id}/status`, { verified: !seller.verified_at });
  await load();
}

onMounted(load);
</script>

<template>
  <section class="panel overflow-hidden p-0">
    <div class="border-b border-slate-200 p-5">
      <h1 class="section-title">Sellers</h1>
    </div>
    <table class="w-full min-w-[800px]">
      <thead class="table-header">
        <tr>
          <th class="px-4 py-3">Store</th>
          <th class="px-4 py-3">Owner</th>
          <th class="px-4 py-3">Plan</th>
          <th class="px-4 py-3">Status</th>
          <th class="px-4 py-3">Verified</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="seller in sellers" :key="seller.id">
          <td class="table-cell">
            <p class="font-semibold">{{ seller.store_name }}</p>
            <p class="muted">/{{ seller.slug }}</p>
          </td>
          <td class="table-cell">{{ seller.owner_email }}</td>
          <td class="table-cell">{{ seller.plan_name || 'No plan' }}</td>
          <td class="table-cell">{{ seller.subscription_status }}</td>
          <td class="table-cell">
            <button class="button-secondary" type="button" @click="verifySeller(seller)">
              <BadgeCheck class="h-4 w-4" />
              {{ seller.verified_at ? 'Remove' : 'Verify' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
