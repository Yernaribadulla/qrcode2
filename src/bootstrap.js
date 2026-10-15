// Apply the same saved appearance as AdminFeedback before the first paint.
(() => {
  let theme;
  let motion;
  try {
    theme = localStorage.getItem("shtil-theme");
    motion = localStorage.getItem("shtil-motion");
  } catch {
    /* Preferences are optional. */
  }
  document.documentElement.dataset.theme = ["light", "dark"].includes(theme)
    ? theme
    : matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  document.documentElement.classList.toggle(
    "motion-paused",
    motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
})();
