<script setup>
import { onMounted } from 'vue';
import { useSellerStore } from '../../stores/seller';

const seller = useSellerStore();
onMounted(() => seller.loadOrders());
</script>

<template>
  <section class="panel overflow-hidden p-0">
    <div class="border-b border-slate-200 p-5">
      <h1 class="section-title">Orders</h1>
    </div>
    <table class="w-full min-w-[720px]">
      <thead class="table-header">
        <tr>
          <th class="px-4 py-3">Order</th>
          <th class="px-4 py-3">Customer</th>
          <th class="px-4 py-3">Items</th>
          <th class="px-4 py-3">Total</th>
          <th class="px-4 py-3">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in seller.orders" :key="order.id">
          <td class="table-cell font-mono text-xs">{{ order.id }}</td>
          <td class="table-cell">{{ order.customer_email }}</td>
          <td class="table-cell">{{ order.item_count }}</td>
          <td class="table-cell">₦{{ order.total }}</td>
          <td class="table-cell">
            <span class="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{{ order.status }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
