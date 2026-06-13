<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { Plus } from 'lucide-vue-next';
import { useTicketsStore } from '../../stores/tickets';

const tickets = useTicketsStore();
const form = ref({ sellerSlug: '', subject: '', message: '' });

onMounted(() => tickets.loadTickets());

async function createTicket() {
  const ticket = await tickets.createTicket(form.value);
  form.value = { sellerSlug: '', subject: '', message: '' };
  return ticket;
}
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[360px_1fr]">
    <form class="panel space-y-4" @submit.prevent="createTicket">
      <h1 class="section-title">Support</h1>
      <input v-model="form.sellerSlug" class="input" placeholder="Seller slug" required />
      <input v-model="form.subject" class="input" placeholder="Subject" required />
      <textarea v-model="form.message" class="textarea" placeholder="Message" required />
      <button class="button w-full" type="submit">
        <Plus class="h-4 w-4" />
        New ticket
      </button>
    </form>

    <div class="panel divide-y divide-slate-100">
      <RouterLink v-for="ticket in tickets.tickets" :key="ticket.id" class="block py-4 transition hover:text-emerald-700" :to="`/support/tickets/${ticket.id}`">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold">{{ ticket.subject }}</h2>
            <p class="muted">{{ ticket.store_name }} · {{ ticket.customer_email }}</p>
          </div>
          <span class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{{ ticket.status }}</span>
        </div>
      </RouterLink>
      <p v-if="!tickets.tickets.length" class="muted py-4">No tickets.</p>
    </div>
  </section>
</template>
