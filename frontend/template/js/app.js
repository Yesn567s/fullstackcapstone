/** Compatibility entry point; feature pages load the focused scripts below. */
if (!document.querySelector('[src*="/js/auth/auth.js"], [src*="/js/dashboard/dashboard.js"]')) {
  const ui = document.createElement('script');
  ui.src = new URL('common/ui.js', document.currentScript.src).href;
  document.head.appendChild(ui);
}
