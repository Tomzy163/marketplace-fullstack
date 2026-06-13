<script setup>
import { computed, ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { UserPlus } from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const role = ref('customer');
const form = ref({
  email: '',
  password: '',
  storeName: '',
  slug: '',
});
const error = ref('');
const loading = ref(false);
const isSeller = computed(() => role.value === 'seller');

function syncSlug() {
  if (!form.value.slug) {
    form.value.slug = form.value.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.register({ ...form.value, role: role.value });
    router.push(isSeller.value ? '/seller/subscribe' : '/');
  } catch (err) {
    error.value = err.response?.data?.message || 'Registration failed';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="mx-auto max-w-lg">
    <div class="panel">
      <h1 class="section-title">Create Account</h1>
      <div class="mt-5 grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
        <button class="rounded px-3 py-2 text-sm font-semibold" :class="role === 'customer' ? 'bg-white shadow-sm' : 'text-slate-600'" type="button" @click="role = 'customer'">Customer</button>
        <button class="rounded px-3 py-2 text-sm font-semibold" :class="role === 'seller' ? 'bg-white shadow-sm' : 'text-slate-600'" type="button" @click="role = 'seller'">Seller</button>
      </div>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <input v-model="form.email" class="input" type="email" placeholder="Email" autocomplete="email" required />
        <input v-model="form.password" class="input" type="password" placeholder="Password" autocomplete="new-password" required />
        <template v-if="isSeller">
          <input v-model="form.storeName" class="input" type="text" placeholder="Store name" required @blur="syncSlug" />
          <input v-model="form.slug" class="input" type="text" placeholder="store-slug" required />
        </template>
        <p v-if="error" class="text-sm font-medium text-red-600">{{ error }}</p>
        <button class="button w-full" type="submit" :disabled="loading">
          <UserPlus class="h-4 w-4" />
          {{ loading ? 'Creating' : 'Create account' }}
        </button>
      </form>
      <RouterLink class="mt-4 inline-block text-sm font-medium text-emerald-700" to="/login">Already registered</RouterLink>
    </div>
  </section>
</template>
