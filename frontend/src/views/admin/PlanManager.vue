<script setup>
import { onMounted, ref } from 'vue';
import { Plus } from 'lucide-vue-next';
import api from '../../services/api';

const plans = ref([]);
const form = ref({
  name: '',
  price: 0,
  maxProducts: null,
  maxOrdersPerMonth: null,
  features: '',
  paystackPlanCode: '',
  isActive: true,
});

async function load() {
  const { data } = await api.get('/admin/plans');
  plans.value = data;
}

async function createPlan() {
  await api.post('/admin/plans', {
    ...form.value,
    features: form.value.features
      .split(',')
      .map((feature) => feature.trim())
      .filter(Boolean),
  });
  form.value = { name: '', price: 0, maxProducts: null, maxOrdersPerMonth: null, features: '', paystackPlanCode: '', isActive: true };
  await load();
}

onMounted(load);
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[360px_1fr]">
    <form class="panel space-y-4" @submit.prevent="createPlan">
      <h1 class="section-title">Plans</h1>
      <input v-model="form.name" class="input" placeholder="Name" required />
      <input v-model.number="form.price" class="input" type="number" min="0" placeholder="Price" required />
      <input v-model.number="form.maxProducts" class="input" type="number" min="0" placeholder="Max products" />
      <input v-model.number="form.maxOrdersPerMonth" class="input" type="number" min="0" placeholder="Max orders monthly" />
      <input v-model="form.features" class="input" placeholder="Features, comma separated" />
      <input v-model="form.paystackPlanCode" class="input" placeholder="Paystack plan code" />
      <label class="flex items-center gap-2 text-sm font-medium">
        <input v-model="form.isActive" type="checkbox" />
        Active
      </label>
      <button class="button w-full" type="submit">
        <Plus class="h-4 w-4" />
        Create plan
      </button>
    </form>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="plan in plans" :key="plan.id" class="panel">
        <h2 class="font-semibold">{{ plan.name }}</h2>
        <p class="mt-2 text-2xl font-semibold">₦{{ plan.price }}</p>
        <p class="muted mt-2">{{ plan.max_products || 'Unlimited' }} products</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="feature in plan.features" :key="feature" class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{{ feature }}</span>
        </div>
      </article>
    </div>
  </section>
</template>
