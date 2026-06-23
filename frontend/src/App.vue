<script setup>
import { computed } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { LayoutDashboard, LogOut, MessageCircle, ShieldCheck, ShoppingBag, Store } from 'lucide-vue-next';
import { useAuthStore } from './stores/auth';
import { policies } from './data/policies';

const auth = useAuthStore();
const router = useRouter();

const sellerHome = computed(() =>
  auth.isSeller && auth.hasActiveSubscription ? '/seller/dashboard' : '/seller/subscribe',
);

async function logout() {
  await auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-950">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <RouterLink to="/" class="flex items-center gap-2 text-base font-semibold">
          <Store class="h-5 w-5 text-emerald-600" />
          MarketWorld
        </RouterLink>

        <nav class="flex flex-wrap items-center justify-end gap-1 text-sm">
          <RouterLink class="nav-link" to="/">
            <ShoppingBag class="h-4 w-4" />
            Storefront
          </RouterLink>
          <RouterLink v-if="auth.isSeller" class="nav-link" :to="sellerHome">
            <LayoutDashboard class="h-4 w-4" />
            Seller
          </RouterLink>
          <RouterLink v-if="auth.hasRole(['customer', 'support_agent', 'seller'])" class="nav-link" to="/support/tickets">
            <MessageCircle class="h-4 w-4" />
            Support
          </RouterLink>
          <RouterLink v-if="auth.hasRole('super_admin')" class="nav-link" to="/admin/sellers">
            <ShieldCheck class="h-4 w-4" />
            Admin
          </RouterLink>
          <RouterLink v-if="!auth.isAuthenticated" class="nav-link" to="/login">Login</RouterLink>
          <button v-else class="icon-button" type="button" title="Logout" @click="logout">
            <LogOut class="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <RouterView />
    </main>

    <footer class="border-t border-slate-200 bg-white">
      <div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Store class="h-4 w-4 text-emerald-600" />
          MarketWorld
        </div>
        <nav class="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
          <RouterLink v-for="policy in policies" :key="policy.slug" class="hover:text-emerald-700" :to="`/policies/${policy.slug}`">
            {{ policy.title }}
          </RouterLink>
        </nav>
      </div>
    </footer>
  </div>
</template>
