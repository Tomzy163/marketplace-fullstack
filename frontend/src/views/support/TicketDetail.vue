<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Send } from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';
import { useTicketsStore } from '../../stores/tickets';

const route = useRoute();
const auth = useAuthStore();
const tickets = useTicketsStore();
const message = ref('');

onMounted(() => tickets.loadTicket(route.params.id));

async function reply() {
  if (!message.value) return;
  await tickets.reply(route.params.id, message.value);
  message.value = '';
}
</script>

<template>
  <section v-if="tickets.activeTicket" class="space-y-5">
    <div class="panel flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="section-title">{{ tickets.activeTicket.subject }}</h1>
        <p class="muted">{{ tickets.activeTicket.store_name }} · {{ tickets.activeTicket.customer_email }}</p>
      </div>
      <select
        v-if="auth.hasRole('support_agent')"
        class="input max-w-40"
        :value="tickets.activeTicket.status"
        @change="tickets.updateStatus(route.params.id, $event.target.value)"
      >
        <option value="open">open</option>
        <option value="pending">pending</option>
        <option value="resolved">resolved</option>
        <option value="closed">closed</option>
      </select>
    </div>

    <div class="panel space-y-4">
      <div v-for="item in tickets.activeTicket.messages" :key="item.id" class="rounded-md bg-slate-50 p-3">
        <div class="mb-1 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{{ item.sender_email }}</span>
          <span>{{ new Date(item.created_at).toLocaleString() }}</span>
        </div>
        <p class="text-sm text-slate-800">{{ item.message }}</p>
      </div>
    </div>

    <form class="panel flex gap-3" @submit.prevent="reply">
      <input v-model="message" class="input" placeholder="Reply" />
      <button class="button" type="submit">
        <Send class="h-4 w-4" />
        Send
      </button>
    </form>
  </section>
</template>
