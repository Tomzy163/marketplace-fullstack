<script setup>
import { computed } from 'vue';
import { onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { AlertTriangle, Boxes, LineChart, ReceiptText } from 'lucide-vue-next';
import { useSellerStore } from '../../stores/seller';

const seller = useSellerStore();
const access = computed(() => seller.dashboard?.subscription || null);
const accessLabel = computed(() => {
  if (access.value?.accessSource === 'admin_override') return 'Administrative premium access';
  if (access.value?.accessSource === 'trial') return `${access.value.trialDaysRemaining || 0} trial days remaining`;
  if (access.value?.accessSource === 'paid') return 'Paid subscription active';
  return 'Subscription inactive';
});

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

onMounted(() => seller.loadDashboard());
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="section-title">{{ seller.dashboard?.seller?.store_name || 'Seller Dashboard' }}</h1>
        <p class="muted">{{ seller.dashboard?.seller?.slug }}</p>
      </div>
      <RouterLink class="button-secondary" to="/seller/products">Products</RouterLink>
    </div>

    <div v-if="access" class="panel flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm font-semibold text-slate-950">{{ accessLabel }}</p>
        <p class="muted">
          {{ access.plan?.name || seller.dashboard?.seller?.plan_name || 'Plan pending' }}
          <span v-if="access.subscriptionExpiresAt">expires {{ formatDate(access.subscriptionExpiresAt) }}</span>
        </p>
      </div>
      <RouterLink v-if="access.accessSource !== 'admin_override'" class="button-secondary" to="/seller/subscribe">
        Manage plan
      </RouterLink>
    </div>

    <div class="grid gap-4 md:grid-cols-4">
      <div class="panel">
        <Boxes class="h-5 w-5 text-emerald-600" />
        <p class="mt-3 text-2xl font-semibold">{{ seller.dashboard?.metrics.products || 0 }}</p>
        <p class="muted">Products</p>
      </div>
      <div class="panel">
        <ReceiptText class="h-5 w-5 text-blue-600" />
        <p class="mt-3 text-2xl font-semibold">{{ seller.dashboard?.metrics.orders || 0 }}</p>
        <p class="muted">Orders</p>
      </div>
      <div class="panel">
        <LineChart class="h-5 w-5 text-cyan-600" />
        <p class="mt-3 text-2xl font-semibold">NGN {{ seller.dashboard?.metrics.revenue || 0 }}</p>
        <p class="muted">Revenue</p>
      </div>
      <div class="panel">
        <AlertTriangle class="h-5 w-5 text-amber-600" />
        <p class="mt-3 text-2xl font-semibold">{{ seller.dashboard?.metrics.openTickets || 0 }}</p>
        <p class="muted">Open tickets</p>
      </div>
    </div>

    <div class="panel">
      <h2 class="font-semibold">Inventory Alerts</h2>
      <div class="mt-4 divide-y divide-slate-100">
        <div v-for="item in seller.dashboard?.lowStock || []" :key="item.id" class="flex items-center justify-between py-3">
          <span class="font-medium">{{ item.name }}</span>
          <span class="rounded bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-700">{{ item.stock }} left</span>
        </div>
        <p v-if="!seller.dashboard?.lowStock?.length" class="muted">No low-stock products.</p>
      </div>
    </div>
  </section>
</template>
