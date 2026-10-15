import { initAppearance } from "./appearance.js";
import { config } from "./config.js";
import {
  feedbackPayload,
  staffFromSearch,
  sendJSON,
  sendPlatform,
} from "./data.js";
import { initMetrics } from "./metrics.js";

initAppearance();
const demo = new URLSearchParams(location.search).get("demo") === "1";
const staff = staffFromSearch(location.search);
const form = document.getElementById("feedback-form");
const fields = document.getElementById("feedback-fields");
const submit = document.getElementById("submit-btn");
const submitLabel = document.getElementById("submit-btn-label");
const comment = document.getElementById("comment");
const ratingCaption = document.getElementById("rating-caption");
const error = document.getElementById("form-error");
let submitting = false;
if (staff) {
  document.getElementById("barista-label").textContent = "ВАШ БАРИСТА";
  document.getElementById("barista-name").textContent =
    staff.charAt(0).toUpperCase() + staff.slice(1);
  document.getElementById("barista-initial").textContent = staff
    .charAt(0)
    .toUpperCase();
}
async function recordScan() {
  if (demo || !staff) return;
  const key = "scan_logged_" + staff.toLowerCase();
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* Recording still works when storage is blocked. */
  }
  try {
    await sendJSON({ barista: staff });
  } catch {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Optional session preference. */
    }
    console.warn("Не удалось записать скан QR.");
  }
}
void recordScan();
initMetrics(staff, demo);

const ratings = [...form.querySelectorAll('input[name="rating"]')];
const labels = [
  "",
  "Совсем не понравилось",
  "Могло быть лучше",
  "В целом неплохо",
  "Хорошо",
  "Отлично!",
];
ratings.forEach((input) =>
  input.addEventListener("change", () => {
    const rating = Number(input.value);
    ratings.forEach((item) =>
      item
        .closest("label")
        .classList.toggle("is-filled", Number(item.value) <= rating),
    );
    document.getElementById("rating-field").removeAttribute("aria-invalid");
    ratingCaption.classList.remove("is-error");
    ratingCaption.textContent = labels[rating];
  }),
);
comment.addEventListener("input", () => {
  document.getElementById("char-counter").textContent =
    `${comment.value.length} / ${config.commentLimit}`;
});
function busy(value) {
  submitting = value;
  fields.disabled = value;
  submit.disabled = value;
  submit.classList.toggle("is-sending", value);
  submitLabel.textContent = value ? "Отправляем…" : "Отправить отзыв";
  form.setAttribute("aria-busy", String(value));
}
async function showThanks() {
  const screen = document.getElementById("form-screen");
  if (
    !document.documentElement.classList.contains("motion-paused") &&
    screen.animate
  ) {
    try {
      await screen.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 })
        .finished;
    } catch {
      /* An interrupted transition must not block the result. */
    }
  }
  screen.hidden = true;
  document.getElementById("thanks-screen").hidden = false;
  document.getElementById("thanks-title").focus({ preventScroll: true });
  document
    .getElementById("thanks-screen")
    .scrollIntoView({ block: "nearest", behavior: "auto" });
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;
  const rating = Number(
    form.querySelector('input[name="rating"]:checked')?.value || 0,
  );
  if (!rating) {
    ratingCaption.textContent = "Пожалуйста, выберите оценку";
    ratingCaption.classList.add("is-error");
    document
      .getElementById("rating-field")
      .setAttribute("aria-invalid", "true");
    ratings[0].focus();
    return;
  }
  const payload = feedbackPayload(staff, rating, comment.value);
  error.hidden = true;
  busy(true);
  try {
    await sendJSON(payload, demo);
    form.setAttribute("aria-busy", "false");
    await showThanks();
  } catch {
    busy(false);
    error.textContent =
      "Не удалось отправить отзыв. Проверьте интернет и попробуйте ещё раз — ваша оценка и текст сохранены на этой странице.";
    error.hidden = false;
  }
});
document.querySelectorAll(".platform-btn").forEach((link) => {
  link.addEventListener("click", () => {
    void sendPlatform(staff, link.dataset.platform, demo).catch(() =>
      console.warn("Не удалось записать переход на платформу."),
    );
  });
});
submit.disabled = false;
