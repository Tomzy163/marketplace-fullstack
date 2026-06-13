import { defineStore } from 'pinia';

export const useCartStore = defineStore('cart', {
  state: () => ({
    carts: JSON.parse(localStorage.getItem('storefrontCarts') || '{}'),
  }),
  getters: {
    items: (state) => (slug) => state.carts[slug] || [],
    count: (state) => (slug) => (state.carts[slug] || []).reduce((sum, item) => sum + item.quantity, 0),
    total: (state) => (slug) =>
      (state.carts[slug] || []).reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
  },
  actions: {
    save() {
      localStorage.setItem('storefrontCarts', JSON.stringify(this.carts));
    },
    add(slug, product, quantity = 1) {
      const cart = this.carts[slug] || [];
      const existing = cart.find((item) => item.id === product.id);
      if (existing) existing.quantity += quantity;
      else cart.push({ ...product, quantity });
      this.carts[slug] = cart;
      this.save();
    },
    update(slug, productId, quantity) {
      this.carts[slug] = (this.carts[slug] || [])
        .map((item) => (item.id === productId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0);
      this.save();
    },
    clear(slug) {
      this.carts[slug] = [];
      this.save();
    },
  },
});
