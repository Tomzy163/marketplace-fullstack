<script setup>
import { onMounted, ref } from 'vue';
import { Save } from 'lucide-vue-next';
import api from '../../services/api';

const form = ref({ storeName: '', slug: '' });
const saved = ref(false);

onMounted(async () => {
  const { data } = await api.get('/seller/settings');
  form.value.storeName = data.store_name;
  form.value.slug = data.slug;
});

async function save() {
  await api.put('/seller/settings', form.value);
  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 1800);
}
</script>

<template>
  <section class="panel mx-auto max-w-xl">
    <h1 class="section-title">Store Settings</h1>
    <form class="mt-5 space-y-4" @submit.prevent="save">
      <input v-model="form.storeName" class="input" placeholder="Store name" required />
      <input v-model="form.slug" class="input" placeholder="store-slug" required />
      <button class="button" type="submit">
        <Save class="h-4 w-4" />
        Save
      </button>
      <p v-if="saved" class="text-sm font-semibold text-emerald-700">Saved</p>
    </form>
  </section>
</template>
