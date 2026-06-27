<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

onMounted(async () => {
  const token = route.query.token;
  if (token) {
    auth.applyOAuthToken(token);
    await auth.refresh();
    router.replace(auth.isSeller && auth.hasPremiumAccess ? '/seller/dashboard' : auth.isSeller ? '/seller/subscribe' : '/');
    return;
  }
  router.replace('/login');
});
</script>

<template>
  <div class="panel mx-auto max-w-md">
    <h1 class="section-title">Signing in</h1>
  </div>
</template>
