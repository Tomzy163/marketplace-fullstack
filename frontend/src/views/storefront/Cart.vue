<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { Trash2 } from 'lucide-vue-next';
import { useCartStore } from '../../stores/cart';

const route = useRoute();
const cart = useCartStore();
const items = computed(() => cart.items(route.params.slug));
const total = computed(() => cart.total(route.params.slug));
</script>

<template>
  <section class="space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="section-title">Cart</h1>
      <RouterLink class="button-secondary" :to="`/store/${route.params.slug}/products`">Continue shopping</RouterLink>
    </div>

    <div class="panel divide-y divide-slate-100">
      <div v-for="item in items" :key="item.id" class="flex flex-wrap items-center justify-between gap-4 py-4">
        <div>
          <h2 class="font-semibold">{{ item.name }}</h2>
          <p class="muted">NGN {{ item.price }}</p>
        </div>
        <div class="flex items-center gap-3">
          <input class="input w-24" type="number" min="0" :value="item.quantity" @input="cart.update(route.params.slug, item.id, Number($event.target.value))" />
          <button class="icon-button" type="button" title="Remove" @click="cart.update(route.params.slug, item.id, 0)">
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </div>
      <p v-if="!items.length" class="muted py-4">Your cart is empty.</p>
    </div>

    <div class="panel flex flex-wrap items-center justify-between gap-3">
      <p class="text-xl font-semibold">NGN {{ total }}</p>
      <RouterLink class="button" :class="{ 'pointer-events-none opacity-50': !items.length }" :to="`/store/${route.params.slug}/checkout`">Checkout</RouterLink>
    </div>
  </section>
</template>
