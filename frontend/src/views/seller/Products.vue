<script setup>
import { onMounted, ref } from 'vue';
import { Plus } from 'lucide-vue-next';
import { useSellerStore } from '../../stores/seller';
import { formatApiError } from '../../utils/errors';

const seller = useSellerStore();
const form = ref({
  name: '',
  description: '',
  price: 0,
  stock: 0,
  category: '',
  images: '',
  lowStockThreshold: 5,
});
const error = ref('');

onMounted(async () => {
  try {
    await seller.loadProducts();
  } catch (err) {
    error.value = formatApiError(err, 'Could not load products');
  }
});

async function createProduct() {
  error.value = '';
  try {
    await seller.createProduct({
      ...form.value,
      images: form.value.images
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean),
    });
    form.value = { name: '', description: '', price: 0, stock: 0, category: '', images: '', lowStockThreshold: 5 };
  } catch (err) {
    error.value = formatApiError(err, 'Could not create product');
  }
}
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[360px_1fr]">
    <form class="panel space-y-4" @submit.prevent="createProduct">
      <h1 class="section-title">Products</h1>
      <input v-model="form.name" class="input" placeholder="Name" required />
      <textarea v-model="form.description" class="textarea" placeholder="Description" />
      <div class="grid grid-cols-2 gap-3">
        <input v-model.number="form.price" class="input" type="number" min="0" step="0.01" placeholder="Price" required />
        <input v-model.number="form.stock" class="input" type="number" min="0" placeholder="Stock" required />
      </div>
      <input v-model="form.category" class="input" placeholder="Category" />
      <input v-model="form.images" class="input" placeholder="Image URLs, comma separated" />
      <input v-model.number="form.lowStockThreshold" class="input" type="number" min="0" placeholder="Low stock threshold" />
      <p v-if="error" class="text-sm font-medium text-red-600">{{ error }}</p>
      <button class="button w-full" type="submit">
        <Plus class="h-4 w-4" />
        Add product
      </button>
    </form>

    <div class="panel overflow-hidden p-0">
      <table class="w-full min-w-[640px]">
        <thead class="table-header">
          <tr>
            <th class="px-4 py-3">Product</th>
            <th class="px-4 py-3">Category</th>
            <th class="px-4 py-3">Price</th>
            <th class="px-4 py-3">Stock</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in seller.products" :key="product.id">
            <td class="table-cell font-medium">{{ product.name }}</td>
            <td class="table-cell">{{ product.category || 'Uncategorized' }}</td>
            <td class="table-cell">NGN {{ product.price }}</td>
            <td class="table-cell">{{ product.stock }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
