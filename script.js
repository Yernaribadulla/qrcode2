import { initAppearance } from "./src/appearance.js";
import { config, demoNames } from "./src/config.js";
import { loadStaff, feedbackURL } from "./src/data.js";
import { initWater } from "./src/water.js";
import { createCountdown } from "./src/countdown.js";

initAppearance();
initWater();
const demo = new URLSearchParams(location.search).get("demo") === "1";
const grid = document.getElementById("staff-grid");
const status = document.getElementById("staff-status");
const retry = document.getElementById("retry-staff");
const mainScreen = document.getElementById("screen-main");
const qrScreen = document.getElementById("screen-qr");
const countdown = createCountdown({
  timer: document.getElementById("timer"),
  progress: document.getElementById("timer-progress"),
  duration: config.qrDuration,
  onExpire: back,
});
let loading = false;
let selectedButton;
function back() {
  countdown.stop();
  document.body.classList.remove("qr-open");
  qrScreen.hidden = true;
  mainScreen.hidden = false;
  selectedButton?.focus({ preventScroll: true });
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
    qrStatus.textContent =
      "QR временно недоступен. Вернитесь к выбору и попробуйте снова.";
  }
  document.getElementById("qr-barista-name").textContent = member.name;
  mainScreen.hidden = true;
  qrScreen.hidden = false;
  document.body.classList.add("qr-open");
  countdown.start();
  document.getElementById("qr-heading").focus({ preventScroll: true });
}
function renderStaff(members) {
  grid.replaceChildren(
    ...members.map((member, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "staff-card";
      button.dataset.id = member.id;
      button.style.setProperty("--card-index", String(Math.min(index, 8)));
      const name = document.createElement("span");
      name.className = "staff-name";
      name.textContent = member.name;
      button.append(name);
      button.addEventListener("click", () => openQR(member, button));
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
document
  .getElementById("extend-timer")
  .addEventListener("click", () => countdown.start(true));
retry.addEventListener("click", refreshStaff);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !qrScreen.hidden) back();
});
await refreshStaff();
