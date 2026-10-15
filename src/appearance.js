function stored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* In-memory switching still works. */
  }
}
export function initAppearance() {
  const root = document.documentElement;
  const themeButton = document.getElementById("theme-toggle");
  const motionButton = document.getElementById("motion-toggle");
  const systemTheme = matchMedia("(prefers-color-scheme: dark)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let themeChoice = stored("shtil-theme");
  let motionChoice = stored("shtil-motion");
  let transitionTimer;
  function theme() {
    const current = ["light", "dark"].includes(themeChoice)
      ? themeChoice
      : systemTheme.matches
        ? "dark"
        : "light";
    root.dataset.theme = current;
    const dark = current === "dark";
    const label = dark ? "Включить светлую тему" : "Включить тёмную тему";
    themeButton.setAttribute("aria-label", label);
    themeButton.setAttribute("aria-pressed", String(dark));
    themeButton.title = label;
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#081e29"
      : "#edf4f3";
  }
  function motion() {
    const enabled = !reducedMotion.matches && motionChoice !== "off";
    root.classList.toggle("motion-paused", !enabled);
    motionButton.disabled = reducedMotion.matches;
    motionButton.setAttribute("aria-pressed", String(enabled));
    const label = reducedMotion.matches
      ? "Движение отключено системой"
      : enabled
        ? "Приостановить анимацию"
        : "Включить анимацию";
    motionButton.setAttribute("aria-label", label);
    motionButton.title = label;
    document.dispatchEvent(new CustomEvent("shtil-motion-change"));
  }
  themeButton.addEventListener("click", () => {
    clearTimeout(transitionTimer);
    root.classList.add("theme-transition");
    themeChoice = root.dataset.theme === "dark" ? "light" : "dark";
    save("shtil-theme", themeChoice);
    theme();
    transitionTimer = setTimeout(
      () => root.classList.remove("theme-transition"),
      650,
    );
  });
  motionButton.addEventListener("click", () => {
    motionChoice = root.classList.contains("motion-paused") ? "on" : "off";
    save("shtil-motion", motionChoice);
    motion();
  });
  systemTheme.addEventListener("change", theme);
  reducedMotion.addEventListener("change", motion);
  window.addEventListener("storage", (event) => {
    if ([null, "shtil-theme", "shtil-motion"].includes(event.key)) {
      themeChoice = stored("shtil-theme");
      motionChoice = stored("shtil-motion");
      theme();
      motion();
    }
  });
  const visibility = () => root.classList.toggle("tab-paused", document.hidden);
  document.addEventListener("visibilitychange", visibility);
  visibility();
  theme();
  motion();
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  document.getElementById("demo-banner").hidden = !demo;
  if (demo) document.querySelector(".brand").href = "./?demo=1";
}
