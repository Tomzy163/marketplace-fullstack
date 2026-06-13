import { defineStore } from 'pinia';
import api from '../services/api';

export const useTicketsStore = defineStore('tickets', {
  state: () => ({
    tickets: [],
    activeTicket: null,
  }),
  actions: {
    async loadTickets() {
      const { data } = await api.get('/tickets');
      this.tickets = data;
    },
    async loadTicket(id) {
      const { data } = await api.get(`/tickets/${id}`);
      this.activeTicket = data;
    },
    async createTicket(payload) {
      const { data } = await api.post('/tickets', payload);
      this.tickets.unshift(data);
      return data;
    },
    async reply(ticketId, message) {
      const { data } = await api.post(`/tickets/${ticketId}/messages`, { message });
      if (this.activeTicket?.id === ticketId) {
        this.activeTicket.messages.push(data);
      }
    },
    async updateStatus(ticketId, status) {
      const { data } = await api.patch(`/tickets/${ticketId}/status`, { status });
      if (this.activeTicket?.id === ticketId) {
        this.activeTicket = { ...this.activeTicket, ...data };
      }
    },
  },
});
