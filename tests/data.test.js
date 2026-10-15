import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStaff,
  feedbackURL,
  staffFromSearch,
  feedbackPayload,
  sendJSON,
  sendPlatform,
  loadStaff,
} from "../src/data.js";
import { config } from "../src/config.js";
const wrap = (rows) =>
  `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({ status: "ok", table: { rows: rows.map((values) => ({ c: values.map((v) => ({ v })) })) } })});`;
test("staff source keeps identifiers, trims names, skips headers and deduplicates case", () => {
  assert.deepEqual(
    parseStaff(
      wrap([
        ["id", "Бариста"],
        [1, " mukha "],
        [2, "MUKHA"],
        [3, "Диас"],
        [null],
        ["имя"],
      ]),
    ),
    [
      { id: "mukha", name: "Mukha" },
      { id: "диас", name: "Диас" },
    ],
  );
});
test("single-column names and external markup remain strings", () => {
  assert.deepEqual(
    parseStaff(wrap([["алекс"], ['<img src=x onerror="bad()">']])),
    [
      { id: "алекс", name: "Алекс" },
      {
        id: '<img src=x onerror="bad()">',
        name: '<img src=x onerror="bad()">',
      },
    ],
  );
});
test("malformed or failed GViz responses never become a fictional team", () => {
  for (const text of [
    "alert(1)",
    "google.visualization.Query.setResponse({oops});",
    'google.visualization.Query.setResponse({"status":"error"});',
    'google.visualization.Query.setResponse({"table":{}});',
  ])
    assert.throws(() => parseStaff(text));
  assert.deepEqual(parseStaff(wrap([])), []);
});
test("QR URLs preserve the existing route and escape Unicode and query characters", () => {
  const url = new URL(
    feedbackURL(
      "диас & +/#?",
      "https://yernaribadulla.github.io/qrcode2/?old=1#main",
    ),
  );
  assert.equal(url.pathname, "/qrcode2/feedback.html");
  assert.equal(url.searchParams.get("staff"), "диас & +/#?");
  assert.equal(url.searchParams.size, 1);
  assert.equal(
    new URL(feedbackURL("mukha", url, true)).searchParams.get("demo"),
    "1",
  );
});
test("legacy barista links and general feedback remain supported", () => {
  assert.equal(staffFromSearch("?barista=DiAs"), "DiAs");
  assert.equal(
    staffFromSearch("?staff=%20%D0%94%D0%B8%D0%B0%D1%81%20&barista=other"),
    "Диас",
  );
  assert.deepEqual(feedbackPayload("", 3, " text "), {
    barista: "unknown",
    rating: 3,
    comment: "text",
  });
});
test("ratings are strict and comments retain the existing 500-character cap", () => {
  for (const rating of [0, 6, 2.2, NaN, "5"])
    assert.throws(() => feedbackPayload("mukha", rating, ""));
  assert.equal(
    feedbackPayload("mukha", 5, "a".repeat(600)).comment.length,
    500,
  );
});
test("scan, feedback and platform events preserve the Apps Script contract", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, ...options });
    return {};
  });
  await sendJSON({ barista: "mukha" });
  await sendJSON(feedbackPayload("mukha", 4, "Спасибо"));
  await sendPlatform("mukha", "2gis");
  assert.ok(
    calls.every(
      (call) =>
        call.url === config.scriptUrl &&
        call.mode === "no-cors" &&
        call.keepalive,
    ),
  );
  assert.deepEqual(JSON.parse(calls[0].body), { barista: "mukha" });
  assert.deepEqual(JSON.parse(calls[1].body), {
    barista: "mukha",
    rating: 4,
    comment: "Спасибо",
  });
  assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[2].body)), {
    type: "platform_click",
    barista: "mukha",
    platform: "2gis",
  });
});
test("demo and unsupported platform events make no network request", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("must not fetch");
  });
  await sendJSON({ barista: "demo" }, true);
  await sendPlatform("demo", "2gis", true);
  await sendPlatform("demo", "other");
  assert.equal(mock.mock.callCount(), 0);
});
test("rejected writes propagate so the UI can keep the form retryable", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("offline");
  });
  await assert.rejects(sendJSON(feedbackPayload("mukha", 1, "")), /offline/);
});
test("staff fetch rejects HTTP failure and requests the original sheet", async (t) => {
  let requested;
  t.mock.method(globalThis, "fetch", async (url) => {
    requested = new URL(url);
    return { ok: false, status: 503 };
  });
  await assert.rejects(loadStaff(), /503/);
  assert.equal(requested.searchParams.get("gid"), "1292898986");
  assert.ok(requested.pathname.includes(config.sheetId));
});
