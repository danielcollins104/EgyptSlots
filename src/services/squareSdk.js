// Loads the official Square Web Payments SDK from Square's CDN (never bundled, never self-hosted).
const SDK_URLS = {
  production: 'https://web.squarecdn.com/v1/square.js',
  sandbox: 'https://sandbox.web.squarecdn.com/v1/square.js',
};

let loading = null;

export function loadSquareSdk(environment = 'sandbox') {
  if (typeof window !== 'undefined' && window.Square) return Promise.resolve(window.Square);
  if (loading) return loading;
  const src = SDK_URLS[environment] || SDK_URLS.sandbox;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => (window.Square ? resolve(window.Square) : reject(new Error('Square SDK did not initialise.')));
    s.onerror = () => { loading = null; reject(new Error('Could not load the secure payment form. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return loading;
}
