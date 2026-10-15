// The deadline is authoritative; decorative animations never control expiry.
export function createCountdown({ timer, progress, duration, onExpire }) {
  const outgoing = timer.parentElement.querySelector(".timer-outgoing");
  const total = duration * 1000;
  let deadline = 0;
  let interval;
  let barAnimation;
  let digitAnimations = [];
  const moving = () =>
    !document.hidden &&
    !document.documentElement.classList.contains("motion-paused");
  const remainingTime = () => Math.max(0, deadline - Date.now());

  function cancelDigits() {
    digitAnimations.forEach((animation) => animation.cancel());
    digitAnimations = [];
    outgoing.textContent = "";
  }
  function number(value, animate = true) {
    const previous = timer.textContent;
    const next = String(value);
    if (previous === next) return;
    cancelDigits();
    timer.textContent = next;
    if (!animate || !moving()) return;
    outgoing.textContent = previous;
    const timing = { duration: 380, easing: "cubic-bezier(.22, 1, .36, 1)" };
    digitAnimations = [
      timer.animate(
        [
          { transform: "translateY(-80%)", opacity: 0 },
          { transform: "translateY(0)", opacity: 1 },
        ],
        timing,
      ),
      outgoing.animate(
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: "translateY(80%)", opacity: 0 },
        ],
        timing,
      ),
    ];
  }
  function animateBar(refillFrom) {
    barAnimation?.cancel();
    const remaining = remainingTime();
    progress.style.transform = `scaleX(${remaining / total})`;
    if (!moving() || !remaining) return;
    const frames = [{ transform: `scaleX(${remaining / total})`, offset: 0 }];
    if (refillFrom !== undefined) {
      // Refill gently, then drain to the same real deadline, including refill time.
      const refill = Math.min(240, remaining);
      frames[0].transform = `scaleX(${refillFrom})`;
      frames.push({
        transform: `scaleX(${(remaining - refill) / total})`,
        offset: refill / remaining,
      });
    }
    frames.push({ transform: "scaleX(0)", offset: 1 });
    barAnimation = progress.animate(frames, {
      duration: remaining,
      easing: "linear",
      fill: "forwards",
    });
  }
  function tick() {
    const remaining = remainingTime();
    const seconds = Math.ceil(remaining / 1000);
    number(seconds);
    if (!moving()) progress.style.transform = `scaleX(${seconds / duration})`;
    if (!remaining) onExpire();
  }
  function stop() {
    clearInterval(interval);
    interval = undefined;
    barAnimation?.cancel();
    cancelDigits();
  }
  function start(extend = false) {
    const width = progress.parentElement.getBoundingClientRect().width;
    const fraction = width ? progress.getBoundingClientRect().width / width : 1;
    stop();
    deadline = Date.now() + total;
    number(duration, extend);
    animateBar(extend ? Math.max(0, Math.min(1, fraction)) : undefined);
    interval = setInterval(tick, 250);
  }
  function sync() {
    if (interval === undefined) return;
    cancelDigits();
    tick();
    if (interval !== undefined) animateBar();
  }
  document.addEventListener("visibilitychange", sync);
  document.addEventListener("shtil-motion-change", sync);
  return { start, stop };
}
