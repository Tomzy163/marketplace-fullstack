const PAYSTACK_SCRIPT = 'https://js.paystack.co/v1/inline.js';

function loadPaystack() {
  if (window.PaystackPop) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PAYSTACK_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function usePaystack() {
  async function openInline({ key, email, amount, reference, metadata, onSuccess, onClose }) {
    await loadPaystack();
    const handler = window.PaystackPop.setup({
      key,
      email,
      amount,
      ref: reference,
      metadata,
      callback: onSuccess,
      onClose,
    });
    handler.openIframe();
  }

  return { openInline };
}
