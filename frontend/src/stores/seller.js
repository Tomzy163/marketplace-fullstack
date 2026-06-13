import { defineStore } from 'pinia';
import api from '../services/api';

export const useSellerStore = defineStore('seller', {
  state: () => ({
    dashboard: null,
    products: [],
    orders: [],
    customers: [],
    subscription: null,
  }),
  actions: {
    async loadDashboard() {
      const { data } = await api.get('/seller/dashboard');
      this.dashboard = data;
    },
    async loadProducts() {
      const { data } = await api.get('/seller/products');
      this.products = data;
    },
    async createProduct(payload) {
      const { data } = await api.post('/seller/products', payload);
      this.products.unshift(data);
    },
    async loadOrders() {
      const { data } = await api.get('/seller/orders');
      this.orders = data;
    },
    async loadCustomers() {
      const { data } = await api.get('/seller/customers');
      this.customers = data;
    },
    async loadSubscription() {
      const { data } = await api.get('/subscriptions/current');
      this.subscription = data;
    },
  },
});
