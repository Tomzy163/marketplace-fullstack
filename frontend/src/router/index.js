import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import Login from '../views/auth/Login.vue';
import Register from '../views/auth/Register.vue';
import OAuthCallback from '../views/auth/OAuthCallback.vue';
import SellerDashboard from '../views/seller/Dashboard.vue';
import SellerProducts from '../views/seller/Products.vue';
import SellerOrders from '../views/seller/Orders.vue';
import SellerSettings from '../views/seller/Settings.vue';
import SellerAnalytics from '../views/seller/Analytics.vue';
import SellerSubscribe from '../views/seller/Subscribe.vue';
import StorefrontHome from '../views/storefront/Home.vue';
import ProductList from '../views/storefront/ProductList.vue';
import ProductDetail from '../views/storefront/ProductDetail.vue';
import Cart from '../views/storefront/Cart.vue';
import Checkout from '../views/storefront/Checkout.vue';
import TicketList from '../views/support/TicketList.vue';
import TicketDetail from '../views/support/TicketDetail.vue';
import LiveChat from '../views/support/LiveChat.vue';
import SellerList from '../views/admin/SellerList.vue';
import PlanManager from '../views/admin/PlanManager.vue';
import AgentManager from '../views/admin/AgentManager.vue';
import AuditLog from '../views/admin/AuditLog.vue';
import Unauthorized from '../views/Unauthorized.vue';

const routes = [
  { path: '/', component: StorefrontHome },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/oauth/callback', component: OAuthCallback },
  { path: '/unauthorized', component: Unauthorized },
  { path: '/seller/subscribe', component: SellerSubscribe, meta: { requiresSellerAccount: true } },
  { path: '/seller/dashboard', component: SellerDashboard, meta: { requiresSeller: true } },
  { path: '/seller/products', component: SellerProducts, meta: { requiresSeller: true } },
  { path: '/seller/orders', component: SellerOrders, meta: { requiresSeller: true } },
  { path: '/seller/settings', component: SellerSettings, meta: { requiresSeller: true } },
  { path: '/seller/analytics', component: SellerAnalytics, meta: { requiresSeller: true } },
  { path: '/store/:slug', component: StorefrontHome },
  { path: '/store/:slug/products', component: ProductList },
  { path: '/store/:slug/products/:id', component: ProductDetail },
  { path: '/store/:slug/cart', component: Cart },
  { path: '/store/:slug/checkout', component: Checkout },
  { path: '/support/tickets', component: TicketList, meta: { requiresRole: ['customer', 'seller', 'support_agent'] } },
  { path: '/support/tickets/:id', component: TicketDetail, meta: { requiresRole: ['customer', 'seller', 'support_agent'] } },
  { path: '/support/live/:id', component: LiveChat, meta: { requiresRole: ['customer', 'seller', 'support_agent'] } },
  { path: '/admin/sellers', component: SellerList, meta: { requiresRole: 'super_admin' } },
  { path: '/admin/plans', component: PlanManager, meta: { requiresRole: 'super_admin' } },
  { path: '/admin/agents', component: AgentManager, meta: { requiresRole: 'super_admin' } },
  { path: '/admin/audit-logs', component: AuditLog, meta: { requiresRole: 'super_admin' } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  const protectedRoute = to.meta.requiresSeller || to.meta.requiresSellerAccount || to.meta.requiresRole;

  if (!auth.initialized && protectedRoute) {
    await auth.refresh();
  }

  if (to.meta.requiresSellerAccount) {
    if (!auth.isSeller) return '/login';
  }

  if (to.meta.requiresSeller) {
    if (!auth.isSeller) return '/login';
    if (!auth.hasActiveSubscription) return '/seller/subscribe';
  }

  if (to.meta.requiresRole) {
    if (!auth.isAuthenticated) return '/login';
    if (!auth.hasRole(to.meta.requiresRole)) return '/unauthorized';
  }

  return true;
});

export default router;
