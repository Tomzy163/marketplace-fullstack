<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { CreditCard } from 'lucide-vue-next';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import { formatApiError } from '../../utils/errors';

const auth = useAuthStore();
const plans = ref([]);
const loadingPlan = ref('');
const error = ref('');
const notice = ref('');

onMounted(async () => {
  try {
    const { data } = await api.get('/plans');
    plans.value = data;
  } catch (err) {
    error.value = formatApiError(err, 'Could not load plans');
  }
});

async function choose(plan) {
  loadingPlan.value = plan.id;
  error.value = '';
  notice.value = '';

  try {
    const { data } = await api.post('/subscriptions/initialize', { planId: plan.id });
    if (data.payment?.authorization_url) {
      window.location.href = data.payment.authorization_url;
      return;
    }

    notice.value = 'Subscription request created. Payment processing is not configured for this environment.';
    await auth.refresh();
  } catch (err) {
    error.value = formatApiError(err, 'Could not start subscription');
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
      <p class="mt-2 text-xs text-slate-500">
        Subscription purchases are governed by the
        <RouterLink class="font-semibold text-emerald-700" to="/policies/seller-policy">Seller Policy</RouterLink>
        and
        <RouterLink class="font-semibold text-emerald-700" to="/policies/refund-policy">Refund Policy</RouterLink>.
      </p>
    </div>

    <p v-if="error" class="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{{ error }}</p>
    <p v-if="notice" class="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-700">{{ notice }}</p>

    <div class="grid gap-4 md:grid-cols-3">
      <article v-for="plan in plans" :key="plan.id" class="panel flex flex-col">
        <h2 class="text-lg font-semibold">{{ plan.name }}</h2>
        <p class="mt-2 text-3xl font-semibold">NGN {{ plan.price }}</p>
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
