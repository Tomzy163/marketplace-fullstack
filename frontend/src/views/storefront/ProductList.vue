<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import api from '../../services/api';

const route = useRoute();
const products = ref([]);

onMounted(async () => {
  const { data } = await api.get(`/store/${route.params.slug}/products`);
  products.value = data;
});
</script>

<template>
  <section class="space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="section-title">Products</h1>
      <RouterLink class="button-secondary" :to="`/store/${route.params.slug}/cart`">Cart</RouterLink>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <RouterLink v-for="product in products" :key="product.id" class="panel block transition hover:border-emerald-300" :to="`/store/${route.params.slug}/products/${product.id}`">
        <div class="aspect-square overflow-hidden rounded-md bg-slate-100">
          <img v-if="product.images?.[0]" class="h-full w-full object-cover" :src="product.images[0]" :alt="product.name" />
        </div>
        <h2 class="mt-3 font-semibold">{{ product.name }}</h2>
        <p class="muted">{{ product.category }}</p>
        <p class="mt-2 font-semibold">NGN {{ product.price }}</p>
      </RouterLink>
    </div>
  </section>
</template>
