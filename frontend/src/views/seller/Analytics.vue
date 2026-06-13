<script setup>
import { Chart } from 'chart.js/auto';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useSellerStore } from '../../stores/seller';

const seller = useSellerStore();
const canvas = ref(null);
let chart;

onMounted(async () => {
  await seller.loadOrders();
  const totals = seller.orders.reduce((acc, order) => {
    const day = new Date(order.created_at).toLocaleDateString();
    acc[day] = (acc[day] || 0) + Number(order.total);
    return acc;
  }, {});

  chart = new Chart(canvas.value, {
    type: 'line',
    data: {
      labels: Object.keys(totals),
      datasets: [
        {
          label: 'Revenue',
          data: Object.values(totals),
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.12)',
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
});

onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <section class="panel">
    <h1 class="section-title">Analytics</h1>
    <div class="mt-5 h-80">
      <canvas ref="canvas"></canvas>
    </div>
  </section>
</template>
