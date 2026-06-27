<script setup>
import { computed, ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { UserPlus } from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';
import { formatApiError } from '../../utils/errors';

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
const acceptedPolicies = ref(false);
const isSeller = computed(() => role.value === 'seller');

function normalizeSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function syncSlug() {
  if (!form.value.slug) {
    form.value.slug = normalizeSlug(form.value.storeName);
  }
}

async function submit() {
  error.value = '';
  if (!acceptedPolicies.value) {
    error.value = 'Please accept the Terms of Use and Privacy Policy to continue.';
    return;
  }

  loading.value = true;
  try {
    const payload = {
      email: form.value.email.trim(),
      password: form.value.password,
      role: role.value,
    };

    if (isSeller.value) {
      payload.storeName = form.value.storeName.trim();
      payload.slug = normalizeSlug(form.value.slug || form.value.storeName);
    }

    await auth.register(payload);
    router.push(isSeller.value && auth.hasPremiumAccess ? '/seller/dashboard' : isSeller.value ? '/seller/subscribe' : '/');
  } catch (err) {
    error.value = formatApiError(err, 'Registration failed');
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
        <input v-model.trim="form.email" class="input" type="email" placeholder="Email" autocomplete="email" required />
        <input v-model="form.password" class="input" type="password" placeholder="Password" autocomplete="new-password" minlength="8" required />
        <template v-if="isSeller">
          <input v-model="form.storeName" class="input" type="text" placeholder="Store name" required @blur="syncSlug" />
          <input v-model.trim="form.slug" class="input" type="text" pattern="[a-z0-9-]{3,80}" placeholder="store-slug" required @blur="form.slug = normalizeSlug(form.slug)" />
        </template>
        <label class="flex items-start gap-2 text-sm text-slate-600">
          <input v-model="acceptedPolicies" class="mt-1" type="checkbox" required />
          <span>
            I agree to the
            <RouterLink class="font-semibold text-emerald-700" to="/policies/terms-of-use">Terms of Use</RouterLink>
            and
            <RouterLink class="font-semibold text-emerald-700" to="/policies/privacy-policy">Privacy Policy</RouterLink>.
          </span>
        </label>
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
