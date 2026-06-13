<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Send } from 'lucide-vue-next';
import { useSocket } from '../../composables/useSocket';

const route = useRoute();
const { connect, joinTicket, sendTicketMessage } = useSocket();
const messages = ref([]);
const draft = ref('');

onMounted(() => {
  const socket = connect();
  joinTicket(route.params.id);
  socket.on('ticket:message', (message) => {
    if (message.ticketId === route.params.id) messages.value.push(message);
  });
});

function send() {
  if (!draft.value) return;
  sendTicketMessage(route.params.id, draft.value);
  draft.value = '';
}
</script>

<template>
  <section class="panel mx-auto max-w-3xl">
    <h1 class="section-title">Live Chat</h1>
    <div class="mt-5 h-96 space-y-3 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-4">
      <div v-for="(message, index) in messages" :key="index" class="rounded-md bg-white p-3 text-sm shadow-sm">
        {{ message.message }}
      </div>
    </div>
    <form class="mt-4 flex gap-3" @submit.prevent="send">
      <input v-model="draft" class="input" placeholder="Message" />
      <button class="button" type="submit">
        <Send class="h-4 w-4" />
        Send
      </button>
    </form>
  </section>
</template>
