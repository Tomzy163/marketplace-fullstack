<script setup>
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { LogIn } from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';
import { formatApiError } from '../../utils/errors';

const auth = useAuthStore();
const router = useRouter();
const form = ref({ email: '', password: '' });
const error = ref('');
const loading = ref(false);
const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const googleAuthUrl = `${apiBaseUrl}/auth/google`;

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(form.value);
    if (auth.user.role === 'seller') router.push(auth.hasActiveSubscription ? '/seller/dashboard' : '/seller/subscribe');
    else if (auth.user.role === 'super_admin') router.push('/admin/sellers');
    else router.push('/');
  } catch (err) {
    error.value = formatApiError(err, 'Login failed');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="mx-auto max-w-md">
    <div class="panel">
      <h1 class="section-title">Login</h1>
      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <input v-model.trim="form.email" class="input" type="email" placeholder="Email" autocomplete="email" required />
        <input v-model="form.password" class="input" type="password" placeholder="Password" autocomplete="current-password" required />
        <p v-if="error" class="text-sm font-medium text-red-600">{{ error }}</p>
        <button class="button w-full" type="submit" :disabled="loading">
          <LogIn class="h-4 w-4" />
          {{ loading ? 'Signing in' : 'Sign in' }}
        </button>
      </form>
      <div class="mt-4 flex items-center justify-between text-sm">
        <RouterLink class="font-medium text-emerald-700" to="/register">Create account</RouterLink>
        <a class="font-medium text-slate-600" :href="googleAuthUrl">Google</a>
      </div>
      <p class="mt-4 text-xs text-slate-500">
        By signing in, you agree to the
        <RouterLink class="font-semibold text-emerald-700" to="/policies/terms-of-use">Terms of Use</RouterLink>
        and
        <RouterLink class="font-semibold text-emerald-700" to="/policies/privacy-policy">Privacy Policy</RouterLink>.
      </p>
    </div>
  </section>
</template>
