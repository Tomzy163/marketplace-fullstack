export function formatApiError(error, fallback = 'Request failed') {
  const data = error?.response?.data;

  if (Array.isArray(data?.details) && data.details.length) {
    return data.details
      .map((detail) => (typeof detail === 'string' ? detail : detail.message))
      .filter(Boolean)
      .join(' ');
  }

  return data?.message || fallback;
}
