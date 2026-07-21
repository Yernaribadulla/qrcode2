(function () {
  "use strict";

  const SHEET_ID = "1ZS1EXykP93modWYpw0_6CXXpk3NIe7e9-VkTSdSFZVE";
  const BARISTA_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=1292898986`;

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
  const staffGrid = document.querySelector("[data-barista-buttons]") || document.getElementById("staff-grid");

  let qrInstance = null;
  let countdownInterval = null;
  let autoReturnTimeout = null;
  let remainingSeconds = DURATION_SECONDS;

  // 1. Анимация волны (Ripple)
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

  // 2. Генерация QR-кода
  function renderQRCode(staffId) {
    qrCodeContainer.innerHTML = "";
    qrInstance = new QRCode(qrCodeContainer, {
      text: BASE_URL + encodeURIComponent(staffId),
      width: 176,
      height: 176,
      colorDark: "#0a141b",
      colorLight: "#f4f1ea",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  // 3. Анимация кольца таймера
  function resetRing() {
    ringProgress.style.transition = "none";
    ringProgress.style.strokeDashoffset = "0";
    ringProgress.getBoundingClientRect();
  }

  function startRingDrain(seconds) {
    resetRing();
    requestAnimationFrame(() => {
      ringProgress.style.transition = `stroke-dashoffset ${seconds}s linear`;
      ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    });
  }

  // 4. Логика таймера
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

  // 5. Переключение экранов
  function goToQRScreen(staffId, staffName) {
    qrNameEl.textContent = staffName;
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

  // 6. Динамическая загрузка списка бариста из Google Sheets
  async function loadAndRenderBaristas() {
    if (!staffGrid) return;

    try {
      const response = await fetch(BARISTA_SHEET_URL);
      const textData = await response.text();
      const match = textData.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);

      let namesList = [];

      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        const rows = parsed.table.rows || [];
        const uniqueNames = new Set();

        rows.forEach(row => {
          // Ищем имена в строках
          const cellVal = row.c && row.c[1] ? row.c[1].v : (row.c && row.c[0] ? row.c[0].v : null);
          if (cellVal && typeof cellVal === 'string') {
            const clean = cellVal.trim();
            if (clean && !['бариста', 'дата', 'barista', 'date'].includes(clean.toLowerCase())) {
              uniqueNames.add(clean);
            }
          }
        });
        namesList = Array.from(uniqueNames);
      }

      // Если в таблице еще мало данных, ставим фоллбэк
      if (namesList.length === 0) {
        namesList = ["Ислам", "Диас", "Баха"];
      }

      renderButtons(namesList);

    } catch (err) {
      console.error("Ошибка при загрузке бариста, включаем дефолтный список:", err);
      renderButtons(["Ислам", "Диас", "Баха"]);
    }
  }

  // Рендер кнопок в сетку с навешиванием слушателей клика
  function renderButtons(names) {
    staffGrid.innerHTML = "";

    names.forEach(name => {
      const button = document.createElement("button");
      button.className = "staff-card";
      button.setAttribute("data-id", name.toLowerCase());
      button.setAttribute("data-name", name);

      const initial = name.charAt(0).toUpperCase();
      button.innerHTML = `
        <span class="staff-initial">${initial}</span>
        <span class="staff-name">${name}</span>
      `;

      button.addEventListener("click", (event) => {
        createRipple(event, button);
        const staffId = button.getAttribute("data-id");
        const staffName = button.getAttribute("data-name");
        setTimeout(() => goToQRScreen(staffId, staffName), 120);
      });

      staffGrid.appendChild(button);
    });
  }

  // Инициализация
  backBtn.addEventListener("click", goToMainScreen);
  loadAndRenderBaristas();

})();
