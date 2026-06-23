<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ShoppingCart } from 'lucide-vue-next';
import api from '../../services/api';
import { useCartStore } from '../../stores/cart';

const route = useRoute();
const cart = useCartStore();
const product = ref(null);
const quantity = ref(1);

onMounted(async () => {
  const { data } = await api.get(`/store/${route.params.slug}/products/${route.params.id}`);
  product.value = data;
});

function addToCart() {
  cart.add(route.params.slug, product.value, quantity.value);
}
</script>

<template>
  <section v-if="product" class="grid gap-6 lg:grid-cols-2">
    <div class="overflow-hidden rounded-lg bg-slate-100">
      <img v-if="product.images?.[0]" class="h-full max-h-[520px] w-full object-cover" :src="product.images[0]" :alt="product.name" />
    </div>
    <div class="panel">
      <p class="muted">{{ product.category }}</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-normal">{{ product.name }}</h1>
      <p class="mt-4 text-2xl font-semibold">NGN {{ product.price }}</p>
      <p class="mt-4 text-slate-600">{{ product.description }}</p>
      <div class="mt-6 flex items-center gap-3">
        <input v-model.number="quantity" class="input max-w-28" type="number" min="1" :max="product.stock" />
        <button class="button" type="button" @click="addToCart">
          <ShoppingCart class="h-4 w-4" />
          Add
        </button>
        <RouterLink class="button-secondary" :to="`/store/${route.params.slug}/cart`">Cart</RouterLink>
      </div>
    </div>
  </section>
</template>
