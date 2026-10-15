import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import jsQR from "jsqr";

const wrap = (names) =>
  `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({ status: "ok", table: { rows: names.map((name) => ({ c: [{ v: 1 }, { v: name }] })) } })});`;
async function staff(page, names = ["mukha", "daniyar", "pizekr", "alexa"]) {
  await page.route("https://docs.google.com/**", (route) =>
    route.fulfill({ body: wrap(names), contentType: "text/plain" }),
  );
}
async function form(page, query = "staff=mukha") {
  await page.goto(`/feedback.html?${query}`);
  await expect(page.locator("#submit-btn")).toBeEnabled();
}
async function audit(page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        reason: n.failureSummary,
      })),
    })),
  ).toEqual([]);
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  // All automatic scans, review submissions and counters are isolated from production.
  await page.route("https://script.google.com/**", (route) =>
    route.fulfill({ status: 200, body: "ok" }),
  );
  await page.route("https://mc.yandex.ru/**", (route) => route.abort());
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await staff(page);
});

test("staff selection produces a decodable QR with the unchanged feedback route", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".staff-card")).toHaveCount(4);
  const button = page.getByRole("link", {
    name: "Оставить отзыв о бариста Mukha",
    exact: true,
  });
  await button.click();
  await expect(page.locator("#screen-main")).toBeHidden();
  await expect(page.locator("#qr-heading")).toBeFocused();
  const image = await page.locator("#qrcode canvas").evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    pixels: Array.from(
      canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height)
        .data,
    ),
  }));
  const qr = jsQR(
    new Uint8ClampedArray(image.pixels),
    image.width,
    image.height,
  );
  expect(qr.data).toBe("http://127.0.0.1:4174/feedback.html?staff=mukha");
  expect(
    await page
      .locator(".qr-frame")
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
  expect(
    await page
      .locator(".qr-frame")
      .evaluate((node) => parseFloat(getComputedStyle(node).padding)),
  ).toBeGreaterThanOrEqual(24);
  await page.locator("#back-btn").click();
  await expect(button).toBeFocused();
});

test("QR timeout can be extended and returns focus without leaving hidden controls active", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/?demo=1");
  await page.locator(".staff-card").first().click();
  await page.clock.fastForward(15000);
  await expect(page.locator("#timer")).toHaveText("5");
  await page.locator("#extend-timer").click();
  await page.clock.fastForward(10000);
  await expect(page.locator("#screen-qr")).toBeVisible();
  await expect(page.locator("#timer")).toHaveText("10");
  await page.clock.fastForward(11000);
  await expect(page.locator("#screen-qr")).toBeHidden();
  await expect(page.locator(".staff-card").first()).toBeFocused();
});

test("QR controls remain visible on a short desktop screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.locator(".staff-card").first().click();
  await expect(page.locator("#qrcode")).toBeInViewport({ ratio: 1 });
  await expect(page.locator("#extend-timer")).toBeInViewport({ ratio: 1 });
});

test("an unavailable QR renderer still offers the direct feedback link", async ({
  page,
}) => {
  await page.route("**/vendor/qrcode.min.js", (route) => route.abort());
  await page.goto("/?demo=1");
  await page.locator(".staff-card").first().click();
  await expect(page.locator(".qr-frame")).toBeHidden();
  await expect(page.locator("#qr-status")).toContainText("QR недоступен");
  await page.locator("#feedback-link").click();
  await expect(page.locator("#submit-btn")).toBeEnabled();
});

test.describe("touch feedback", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("rating and submission work by tapping", async ({ page }) => {
    await form(page, "staff=mukha&demo=1");
    await page.getByRole("radio", { name: "5 звёзд", exact: true }).tap();
    await page.locator("#submit-btn").tap();
    await expect(page.locator("#thanks-screen")).toBeVisible();
  });
  test("a landscape phone still opens its own form instead of a QR", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/?demo=1");
    await page.locator(".staff-card").first().tap();
    await expect(page).toHaveURL(/feedback\.html\?staff=.*demo=1/);
    await expect(page.locator("#submit-btn")).toBeEnabled();
  });
});

test("legacy barista link logs one scan per session and uses native keyboard ratings", async ({
  page,
}) => {
  const posts = [];
  page.on("request", (request) => {
    if (request.url().includes("script.google.com"))
      posts.push(request.postDataJSON());
  });
  await form(page, "barista=DiAs");
  await expect(page.locator("#barista-name")).toHaveText("DiAs");
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toEqual({ barista: "DiAs" });
  await page.reload();
  await expect(page.locator("#submit-btn")).toBeEnabled();
  expect(posts).toHaveLength(1);
  await page.locator("#submit-btn").click();
  await expect(page.locator("#rating-caption")).toContainText(
    "выберите оценку",
  );
  await expect(
    page.getByRole("radio", { name: "1 звезда", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("radio", { name: "1 звезда", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "2 звезды", exact: true }),
  ).toBeChecked();
  await expect(page.locator("#rating-caption")).toHaveText("Могло быть лучше");
});

test("every rating reaches thanks and the platform links retain their event payloads", async ({
  page,
}) => {
  const posts = [];
  page.on("request", (request) => {
    if (request.url().includes("script.google.com"))
      posts.push(request.postData());
  });
  await form(page);
  await page.getByRole("radio", { name: "1 звезда", exact: true }).check();
  await page.locator("#comment").fill("  Было шумно  ");
  await page.locator("#submit-btn").click();
  await expect(page.locator("#thanks-screen")).toBeVisible();
  await expect(page.locator("#thanks-title")).toBeFocused();
  expect(JSON.parse(posts[1])).toEqual({
    barista: "mukha",
    rating: 1,
    comment: "Было шумно",
  });
  const links = page.locator(".platform-btn");
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toHaveAttribute(
    "href",
    "https://go.2gis.com/69d1W",
  );
  await expect(links.nth(1)).toHaveAttribute(
    "href",
    "https://yandex.kz/maps/ru/-/CTG-jA~0",
  );
  await expect(links.nth(2)).toHaveAttribute(
    "href",
    "https://www.instagram.com/tequiero_coffee_sea",
  );
  await page.route("https://go.2gis.com/**", (route) =>
    route.fulfill({ body: "Test platform" }),
  );
  const popup = page.waitForEvent("popup");
  await links.nth(0).click();
  await (await popup).close();
  await expect.poll(() => posts.length).toBe(3);
  expect(Object.fromEntries(new URLSearchParams(posts[2]))).toEqual({
    type: "platform_click",
    barista: "mukha",
    platform: "2gis",
  });
});

test("network failure preserves the form, never shows thanks, and permits retry", async ({
  page,
}) => {
  let fail = true;
  await page.route("https://script.google.com/**", (route) => {
    const data = JSON.parse(route.request().postData());
    return data.rating && fail
      ? route.abort("failed")
      : route.fulfill({ body: "ok" });
  });
  await form(page);
  await page.getByRole("radio", { name: "4 звезды", exact: true }).check();
  await page.locator("#comment").fill("Хороший кофе");
  await page.locator("#submit-btn").click();
  await expect(page.locator("#form-error")).toBeVisible();
  await expect(page.locator("#thanks-screen")).toBeHidden();
  await expect(page.locator("#submit-btn")).toBeEnabled();
  await expect(page.locator("#comment")).toHaveValue("Хороший кофе");
  await expect(
    page.getByRole("radio", { name: "4 звезды", exact: true }),
  ).toBeChecked();
  fail = false;
  await page.locator("#submit-btn").click();
  await expect(page.locator("#thanks-screen")).toBeVisible();
});

test("an in-flight submission cannot be duplicated", async ({ page }) => {
  let finish;
  let writes = 0;
  await page.route("https://script.google.com/**", async (route) => {
    if (JSON.parse(route.request().postData()).rating) {
      writes++;
      await new Promise((resolve) => {
        finish = resolve;
      });
    }
    await route.fulfill({ body: "ok" });
  });
  await form(page);
  await page.getByRole("radio", { name: "5 звёзд", exact: true }).check();
  await page.locator("#submit-btn").click();
  await expect(page.locator("#submit-btn")).toBeDisabled();
  await expect(page.locator("#comment")).toBeDisabled();
  await page.locator("#feedback-form").dispatchEvent("submit");
  expect(writes).toBe(1);
  finish();
  await expect(page.locator("#thanks-screen")).toBeVisible();
});

test("staff failure and an empty table offer recovery without fabricated employees", async ({
  page,
}) => {
  await page.route("https://docs.google.com/**", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await expect(page.locator("#retry-staff")).toBeVisible();
  await expect(page.locator(".staff-card")).toHaveCount(0);
  await staff(page, []);
  await page.locator("#retry-staff").click();
  await expect(page.locator("#staff-status")).toContainText("пуст");
  await staff(page, ["mukha"]);
  await page.locator("#retry-staff").click();
  await expect(page.locator(".staff-card")).toHaveCount(1);
});

test("external staff names and URL values are always rendered as text", async ({
  page,
}) => {
  const name = '<img src=x onerror="window.injected=true">';
  await staff(page, [name]);
  await page.goto("/");
  await expect(page.locator(".staff-name")).toHaveText(name);
  await expect(page.locator(".staff-card img")).toHaveCount(0);
  await form(page, `staff=${encodeURIComponent(name)}&demo=1`);
  await expect(page.locator("#barista-name")).toHaveText(name);
  await expect(page.locator(".staff-context img")).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test("general feedback sends the original unknown identifier without recording a scan", async ({
  page,
}) => {
  const posts = [];
  page.on("request", (r) => {
    if (r.url().includes("script.google.com")) posts.push(r.postDataJSON());
  });
  await form(page, "");
  expect(posts).toHaveLength(0);
  await page.getByRole("radio", { name: "3 звезды", exact: true }).check();
  await page.locator("#submit-btn").click();
  await expect(page.locator("#thanks-screen")).toBeVisible();
  expect(posts).toEqual([{ barista: "unknown", rating: 3, comment: "" }]);
});

test("demo carries into the QR and form without Sheets, writes or metrics", async ({
  page,
}) => {
  const external = [];
  page.on("request", (r) => {
    if (/docs\.google|script\.google|mc\.yandex/.test(r.url()))
      external.push(r.url());
  });
  await page.goto("/?demo=1");
  await page.locator(".staff-card").first().click();
  await expect(page.locator("#feedback-link")).toHaveAttribute(
    "href",
    /demo=1/,
  );
  await page.locator("#feedback-link").click();
  await page.getByRole("radio", { name: "5 звёзд", exact: true }).check();
  await page.locator("#submit-btn").click();
  await expect(page.locator("#thanks-screen")).toBeVisible();
  expect(external).toEqual([]);
});

test("appearance follows Штиль preferences across both pages without losing input", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("shtil-theme", "dark");
    localStorage.setItem("shtil-motion", "off");
  });
  await page.goto("/?demo=1");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator(".staff-card").first().click();
  await page.locator("#feedback-link").click();
  await page.getByRole("radio", { name: "4 звезды", exact: true }).check();
  await page.locator("#comment").fill("Всё понравилось");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#comment")).toHaveValue("Всё понравилось");
  await expect(
    page.getByRole("radio", { name: "4 звезды", exact: true }),
  ).toBeChecked();
});

test("blocked storage does not prevent a guest from submitting", async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const key of ["localStorage", "sessionStorage"])
      Object.defineProperty(window, key, {
        get() {
          throw new Error("blocked");
        },
      });
  });
  await form(page);
  await page.locator("#theme-toggle").click();
  await page.getByRole("radio", { name: "5 звёзд", exact: true }).check();
  await page.locator("#submit-btn").click();
  await expect(page.locator("#thanks-screen")).toBeVisible();
});

test("sea motion pauses and reduced motion disables all entry effects", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?demo=1");
  expect(
    await page
      .locator(".caspian-water")
      .first()
      .evaluate((n) => getComputedStyle(n).animationName),
  ).toBe("water-drift");
  await page.locator("#motion-toggle").click();
  expect(
    await page
      .locator(".caspian-water")
      .first()
      .evaluate((n) => getComputedStyle(n).animationName),
  ).toBe("none");
  await page.reload();
  await expect(page.locator("#motion-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#motion-toggle")).toBeDisabled();
  await page.locator("#theme-toggle").click();
  expect(
    await page
      .locator(".sea-shade")
      .evaluate((node) => getComputedStyle(node).transitionDuration),
  ).toBe("0s");
  expect(
    await page
      .locator(".page-shell")
      .evaluate((n) => getComputedStyle(n).opacity),
  ).toBe("1");
});

for (const width of [320, 390, 768, 1440]) {
  test(`both guest pages and the QR fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?demo=1&kiosk=1");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator(".staff-card").last().click();
    await expect(page.locator("#qrcode")).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator("#feedback-link").click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("radio", { name: "5 звёзд", exact: true }).check();
    await page.locator("#submit-btn").click();
    await expect(page.locator("#thanks-title")).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const [width, height] of [
  [320, 640],
  [390, 844],
]) {
  test(`phone ${width}x${height} shows the primary actions and opens the form in one tap`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator(".staff-card")).toHaveCount(4);
    for (const item of await page.locator(".staff-card").all())
      await expect(item).toBeInViewport({ ratio: 1 });
    await page.locator(".staff-card").first().click();
    await expect(page).toHaveURL(/feedback\.html\?staff=mukha$/);
    await expect(page.locator("#submit-btn")).toBeEnabled();
    await expect(page.locator("#submit-btn")).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("radio", { name: "5 звёзд", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("a phone can explicitly enter QR mode, keeping demo isolated", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?demo=1");
  await page
    .getByRole("link", { name: "Показать QR-коды", exact: true })
    .click();
  await expect(page).toHaveURL(/demo=1&kiosk=1/);
  await page.locator(".staff-card").first().click();
  await expect(page.locator("#screen-qr")).toBeVisible();
  await expect(page.locator("#feedback-link")).toHaveAttribute(
    "href",
    /demo=1/,
  );
});

test("desktop can opt into the direct form and image failure never blocks submission", async ({
  page,
}) => {
  await page.route("**/assets/caspian-water.webp", (route) => route.abort());
  await page.goto("/?demo=1&direct=1");
  await page.locator(".staff-card").first().click();
  await expect(page).toHaveURL(/feedback\.html\?staff=.*demo=1/);
  await page.getByRole("radio", { name: "5 звёзд", exact: true }).check();
  await page.locator("#submit-btn").click();
  await expect(page.locator("#thanks-screen")).toBeVisible();
});
for (const theme of ["light", "dark"]) {
  test(`staff, QR, form and thanks meet automated WCAG AA in ${theme}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("shtil-theme", value),
      theme,
    );
    await page.goto("/?demo=1");
    await audit(page);
    await page.locator(".staff-card").first().click();
    await audit(page);
    await page.locator("#feedback-link").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await audit(page);
    await page.getByRole("radio", { name: "5 звёзд", exact: true }).check();
    await page.locator("#submit-btn").click();
    await audit(page);
  });
}
