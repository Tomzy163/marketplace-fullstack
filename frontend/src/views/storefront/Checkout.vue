<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { CreditCard } from 'lucide-vue-next';
import api from '../../services/api';
import { useCartStore } from '../../stores/cart';

const route = useRoute();
const cart = useCartStore();
const customer = ref({ email: '', address: '' });
const order = ref(null);
const error = ref('');
const items = computed(() => cart.items(route.params.slug));
const total = computed(() => cart.total(route.params.slug));

async function checkout() {
  error.value = '';
  try {
    const { data } = await api.post(`/store/${route.params.slug}/orders/checkout`, {
      customer: customer.value,
      items: items.value.map((item) => ({ productId: item.id, quantity: item.quantity })),
    });
    order.value = data.order;
    cart.clear(route.params.slug);
    if (data.payment?.authorization_url) {
      window.location.href = data.payment.authorization_url;
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Checkout failed';
  }
}
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[1fr_360px]">
    <form class="panel space-y-4" @submit.prevent="checkout">
      <h1 class="section-title">Checkout</h1>
      <input v-model="customer.email" class="input" type="email" placeholder="Email" required />
      <textarea v-model="customer.address" class="textarea" placeholder="Delivery address" />
      <p v-if="error" class="text-sm font-medium text-red-600">{{ error }}</p>
      <p v-if="order" class="text-sm font-semibold text-emerald-700">Order {{ order.id }} created.</p>
      <button class="button" type="submit" :disabled="!items.length">
        <CreditCard class="h-4 w-4" />
        Pay ₦{{ total }}
      </button>
    </form>

    <aside class="panel">
      <h2 class="font-semibold">Summary</h2>
      <div class="mt-4 space-y-3">
        <div v-for="item in items" :key="item.id" class="flex justify-between gap-3 text-sm">
          <span>{{ item.name }} × {{ item.quantity }}</span>
          <span class="font-semibold">₦{{ Number(item.price) * item.quantity }}</span>
        </div>
      </div>
      <div class="mt-5 border-t border-slate-200 pt-4 text-xl font-semibold">₦{{ total }}</div>
    </aside>
  </section>
</template>
