import { initAppearance } from "./src/appearance.js";
import { config, demoNames } from "./src/config.js";
import { loadStaff, feedbackURL } from "./src/data.js";
import { entryMode } from "./src/flow.js";

initAppearance();
const demo = new URLSearchParams(location.search).get("demo") === "1";
const grid = document.getElementById("staff-grid");
const status = document.getElementById("staff-status");
const retry = document.getElementById("retry-staff");
const mainScreen = document.getElementById("screen-main");
const qrScreen = document.getElementById("screen-qr");
const timer = document.getElementById("timer");
const progress = document.getElementById("timer-progress");
const wideScreen = matchMedia("(min-width: 768px) and (pointer: fine)");
const modeLink = document.getElementById("entry-mode-link");
const mode = () => entryMode(location.search, wideScreen.matches);
function updateModeLink() {
  const next = new URL(location.href);
  next.searchParams.delete("direct");
  next.searchParams.delete("kiosk");
  next.searchParams.set(mode() === "qr" ? "direct" : "kiosk", "1");
  modeLink.href = next.href;
  modeLink.textContent =
    mode() === "qr" ? "Открывать отзывы без QR" : "Показать QR-коды";
}
wideScreen.addEventListener("change", updateModeLink);
updateModeLink();
let loading = false;
let deadline = 0;
let interval;
let selectedButton;
function back() {
  clearInterval(interval);
  document.body.classList.remove("qr-open");
  qrScreen.hidden = true;
  mainScreen.hidden = false;
  selectedButton?.focus({ preventScroll: true });
}
function tick() {
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  timer.textContent = String(remaining);
  progress.style.transform = `scaleX(${remaining / config.qrDuration})`;
  if (!remaining) back();
}
function startTimer() {
  clearInterval(interval);
  deadline = Date.now() + config.qrDuration * 1000;
  tick();
  interval = setInterval(tick, 250);
}
function openQR(member, button) {
  selectedButton = button;
  const url = feedbackURL(member.id, location.href, demo);
  const target = document.getElementById("qrcode");
  const qrStatus = document.getElementById("qr-status");
  const qrFrame = document.querySelector(".qr-frame");
  qrFrame.hidden = false;
  target.replaceChildren();
  qrStatus.textContent = "";
  try {
    if (!window.QRCode) throw new Error("QR library unavailable");
    new window.QRCode(target, {
      text: url,
      width: 256,
      height: 256,
      colorDark: "#092d34",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M,
    });
    target.querySelectorAll("img").forEach((image) => {
      image.alt = "";
    });
  } catch {
    qrFrame.hidden = true;
    qrStatus.textContent = "QR недоступен. Откройте отзыв по ссылке.";
  }
  document.getElementById("qr-barista-name").textContent = member.name;
  document.getElementById("feedback-link").href = url;
  mainScreen.hidden = true;
  qrScreen.hidden = false;
  document.body.classList.add("qr-open");
  startTimer();
  document.getElementById("qr-heading").focus({ preventScroll: true });
}
function renderStaff(members) {
  grid.replaceChildren(
    ...members.map((member, index) => {
      const button = document.createElement("a");
      button.href = feedbackURL(member.id, location.href, demo);
      button.className = "staff-card";
      button.dataset.id = member.id;
      button.style.setProperty("--card-index", String(Math.min(index, 8)));
      button.setAttribute(
        "aria-label",
        `Оставить отзыв о бариста ${member.name}`,
      );
      const initial = document.createElement("span");
      initial.className = "staff-initial";
      initial.textContent = member.name.charAt(0).toUpperCase();
      initial.setAttribute("aria-hidden", "true");
      const detail = document.createElement("span");
      detail.className = "staff-detail";
      const name = document.createElement("span");
      name.className = "staff-name";
      name.textContent = member.name;
      const arrow = document.createElement("span");
      arrow.className = "staff-arrow";
      arrow.textContent = "→";
      arrow.setAttribute("aria-hidden", "true");
      detail.append(name);
      button.append(initial, detail, arrow);
      button.addEventListener("click", (event) => {
        if (
          mode() === "qr" &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          openQR(member, button);
        }
      });
      return button;
    }),
  );
}
async function refreshStaff() {
  if (loading) return;
  loading = true;
  retry.hidden = true;
  grid.setAttribute("aria-busy", "true");
  status.textContent = "Загружаем команду…";
  try {
    const members = demo
      ? demoNames.map((name) => ({ id: name.toLowerCase(), name }))
      : await loadStaff();
    renderStaff(members);
    status.textContent = members.length
      ? ""
      : "Список бариста пока пуст. Пожалуйста, обратитесь к команде кофейни.";
    retry.hidden = members.length > 0;
  } catch {
    status.textContent =
      "Не удалось загрузить команду. Проверьте связь и попробуйте ещё раз.";
    retry.hidden = false;
  } finally {
    loading = false;
    grid.setAttribute("aria-busy", "false");
  }
}
document.getElementById("back-btn").addEventListener("click", back);
document.getElementById("extend-timer").addEventListener("click", startTimer);
retry.addEventListener("click", refreshStaff);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !qrScreen.hidden) tick();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !qrScreen.hidden) back();
});
await refreshStaff();
