import { config } from "./config.js";

// Preserve the existing counter on feedback pages only. Never load it in demo mode.
export function initMetrics(staff, demo) {
  if (demo) return;
  window.ym =
    window.ym ||
    function (...args) {
      (window.ym.a = window.ym.a || []).push(args);
    };
  window.ym.l = Number(new Date());
  if (
    !document.querySelector('script[src="https://mc.yandex.ru/metrika/tag.js"]')
  ) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://mc.yandex.ru/metrika/tag.js";
    document.head.append(script);
  }
  window.ym(config.metricsId, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
    params: { barista: staff || "unknown" },
  });
}
