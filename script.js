// script.js

(function () {
  "use strict";

  const BASE_URL = "https://yernaribadulla.github.io/qrcode2/feedback.html?staff=";
  const DURATION_SECONDS = 20;
  const RING_CIRCUMFERENCE = 628.318;

  const screenMain = document.getElementById("screen-main");
  const screenQR = document.getElementById("screen-qr");
  const qrNameEl = document.getElementById("qr-barista-name");
  const qrCodeContainer = document.getElementById("qrcode");
  const ringProgress = document.getElementById("ring-progress");
  const timerEl = document.getElementById("timer");
  const backBtn = document.getElementById("back-btn");
  const staffButtons = document.querySelectorAll(".staff-card");

  let qrInstance = null;
  let countdownInterval = null;
  let autoReturnTimeout = null;
  let remainingSeconds = DURATION_SECONDS;

  function createRipple(event, button) {
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 1.4;
    const x = (event.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (event.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;

    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";

    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  function renderQRCode(staffId) {
    qrCodeContainer.innerHTML = "";
    qrInstance = new QRCode(qrCodeContainer, {
      text: BASE_URL + staffId,
      width: 176,
      height: 176,
      colorDark: "#0a141b",
      colorLight: "#f4f1ea",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function resetRing() {
    ringProgress.style.transition = "none";
    ringProgress.style.strokeDashoffset = "0";
    // форсируем перерасчёт стилей, чтобы следующая transition сработала
    // eslint-disable-next-line no-unused-expressions
    ringProgress.getBoundingClientRect();
  }

  function startRingDrain(seconds) {
    resetRing();
    requestAnimationFrame(() => {
      ringProgress.style.transition = `stroke-dashoffset ${seconds}s linear`;
      ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    });
  }

  function startCountdown() {
    remainingSeconds = DURATION_SECONDS;
    timerEl.textContent = String(remainingSeconds);

    clearInterval(countdownInterval);
    clearTimeout(autoReturnTimeout);

    countdownInterval = setInterval(() => {
      remainingSeconds -= 1;
      timerEl.textContent = String(Math.max(remainingSeconds, 0));
      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    autoReturnTimeout = setTimeout(() => {
      goToMainScreen();
    }, DURATION_SECONDS * 1000);
  }

  function goToQRScreen(staffId, staffName) {
    qrNameEl.textContent = "Ваш бариста: " + staffName;
    renderQRCode(staffId);
    startRingDrain(DURATION_SECONDS);
    startCountdown();

    screenMain.classList.remove("is-active");
    screenQR.classList.add("is-active");
  }

  function goToMainScreen() {
    clearInterval(countdownInterval);
    clearTimeout(autoReturnTimeout);

    screenQR.classList.remove("is-active");
    screenMain.classList.add("is-active");
  }

  staffButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      createRipple(event, button);
      const staffId = button.getAttribute("data-id");
      const staffName = button.getAttribute("data-name");
      setTimeout(() => goToQRScreen(staffId, staffName), 120);
    });
  });

  backBtn.addEventListener("click", goToMainScreen);
})();