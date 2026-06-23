<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { policies } from '../../data/policies';

const route = useRoute();
const policy = computed(() => policies.find((item) => item.slug === route.params.slug) || policies[0]);
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-6">
    <div>
      <RouterLink class="text-sm font-semibold text-emerald-700" to="/">MarketWorld</RouterLink>
      <h1 class="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{{ policy.title }}</h1>
      <p class="mt-2 text-sm text-slate-500">Last updated: {{ policy.updated }}</p>
      <p class="mt-4 text-slate-600">{{ policy.summary }}</p>
    </div>

    <div class="space-y-4">
      <section v-for="section in policy.sections" :key="section.title" class="border-t border-slate-200 pt-4">
        <h2 class="text-lg font-semibold text-slate-950">{{ section.title }}</h2>
        <p class="mt-2 text-sm leading-6 text-slate-600">{{ section.body }}</p>
      </section>
    </div>

    <p class="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
      These policies are operational templates for the marketplace and should be reviewed for the laws that apply to the business, sellers, customers, and payment regions before public launch.
    </p>
  </section>
</template>
