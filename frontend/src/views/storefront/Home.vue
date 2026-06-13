<script setup>
import { onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { Search } from 'lucide-vue-next';
import api from '../../services/api';

const route = useRoute();
const router = useRouter();
const slug = ref(route.params.slug || '');
const store = ref(null);
const products = ref([]);
const error = ref('');

async function loadStore() {
  if (!slug.value) return;
  error.value = '';
  try {
    const [{ data: storeData }, { data: productData }] = await Promise.all([
      api.get(`/store/${slug.value}`),
      api.get(`/store/${slug.value}/products`),
    ]);
    store.value = storeData.seller;
    products.value = productData.slice(0, 6);
  } catch (err) {
    store.value = null;
    products.value = [];
    error.value = err.response?.data?.message || 'Storefront unavailable';
  }
}

function openStore() {
  if (slug.value) router.push(`/store/${slug.value}`);
}

onMounted(loadStore);
watch(
  () => route.params.slug,
  (value) => {
    slug.value = value || '';
    loadStore();
  },
);
</script>

<template>
  <section class="space-y-6">
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div class="rounded-lg bg-emerald-700 p-8 text-white">
        <p class="text-sm font-semibold uppercase tracking-wide text-emerald-100">Storefront</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
          {{ store?.store_name || 'Open a seller storefront' }}
        </h1>
        <p v-if="store" class="mt-3 text-emerald-50">/{{ store.slug }}</p>
      </div>
      <form class="panel flex items-end gap-3" @submit.prevent="openStore">
        <label class="flex-1">
          <span class="mb-2 block text-sm font-semibold">Store slug</span>
          <input v-model="slug" class="input" placeholder="seller-store" />
        </label>
        <button class="button" type="submit">
          <Search class="h-4 w-4" />
          Open
        </button>
      </form>
    </div>

    <p v-if="error" class="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{{ error }}</p>

    <div v-if="store" class="flex items-center justify-between">
      <h2 class="section-title">Products</h2>
      <RouterLink class="button-secondary" :to="`/store/${store.slug}/products`">View all</RouterLink>
    </div>

    <div v-if="store" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink v-for="product in products" :key="product.id" class="panel block transition hover:border-emerald-300" :to="`/store/${store.slug}/products/${product.id}`">
        <div class="aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
          <img v-if="product.images?.[0]" class="h-full w-full object-cover" :src="product.images[0]" :alt="product.name" />
        </div>
        <h3 class="mt-3 font-semibold">{{ product.name }}</h3>
        <p class="muted">{{ product.category }}</p>
        <p class="mt-2 font-semibold">₦{{ product.price }}</p>
      </RouterLink>
    </div>
  </section>
</template>
