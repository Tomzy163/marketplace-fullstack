<script setup>
import { onMounted, ref } from 'vue';
import { CreditCard } from 'lucide-vue-next';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const plans = ref([]);
const loadingPlan = ref('');

onMounted(async () => {
  const { data } = await api.get('/plans');
  plans.value = data;
});

async function choose(plan) {
  loadingPlan.value = plan.id;
  try {
    const { data } = await api.post('/subscriptions/initialize', { planId: plan.id });
    if (data.payment?.authorization_url) {
      window.location.href = data.payment.authorization_url;
      return;
    }
    await auth.refresh();
  } finally {
    loadingPlan.value = '';
  }
}
</script>

<template>
  <section class="space-y-5">
    <div>
      <h1 class="section-title">Choose Plan</h1>
      <p class="muted mt-1">Seller dashboard access requires an active plan.</p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <article v-for="plan in plans" :key="plan.id" class="panel flex flex-col">
        <h2 class="text-lg font-semibold">{{ plan.name }}</h2>
        <p class="mt-2 text-3xl font-semibold">₦{{ plan.price }}</p>
        <ul class="mt-4 flex-1 space-y-2 text-sm text-slate-600">
          <li v-for="feature in plan.features" :key="feature">{{ feature }}</li>
        </ul>
        <button class="button mt-5" type="button" :disabled="loadingPlan === plan.id" @click="choose(plan)">
          <CreditCard class="h-4 w-4" />
          {{ loadingPlan === plan.id ? 'Starting' : 'Select' }}
        </button>
      </article>
    </div>
  </section>
</template>
