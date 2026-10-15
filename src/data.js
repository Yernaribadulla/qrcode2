import { config } from "./config.js";

export function parseStaff(text) {
  const match = text
    .trim()
    .match(
      /^(?:\/\*[\s\S]*?\*\/\s*)?google\.visualization\.Query\.setResponse\((\{[\s\S]*\})\);?$/,
    );
  if (!match) throw new Error("Invalid GViz response");
  const data = JSON.parse(match[1]);
  if (data.status === "error" || !Array.isArray(data.table?.rows))
    throw new Error("Invalid staff table");
  const headers = new Set([
    "бариста",
    "дата",
    "barista",
    "date",
    "имя",
    "name",
    "сотрудник",
  ]);
  const unique = new Map();
  for (const row of data.table.rows) {
    const value = row?.c?.[1]?.v ?? row?.c?.[0]?.v;
    if (typeof value !== "string") continue;
    const name = value.trim();
    const id = name.toLowerCase();
    if (!name || name.length > 120 || headers.has(id) || unique.has(id))
      continue;
    unique.set(id, { id, name: name.charAt(0).toUpperCase() + name.slice(1) });
  }
  return [...unique.values()];
}
export async function loadStaff() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.staffTimeout);
  try {
    const url = new URL(
      `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`,
    );
    url.search = new URLSearchParams({ tqx: "out:json", gid: config.staffGid });
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Staff HTTP ${response.status}`);
    return parseStaff(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}
export function feedbackURL(staff, base, demo = false) {
  const url = new URL("feedback.html", base);
  url.searchParams.set("staff", staff);
  if (demo) url.searchParams.set("demo", "1");
  return url.href;
}
export function staffFromSearch(search) {
  const params = new URLSearchParams(search);
  return (params.get("staff") || params.get("barista") || "")
    .trim()
    .slice(0, 120);
}
export function feedbackPayload(staff, rating, comment) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new Error("Invalid rating");
  return {
    barista: staff || "unknown",
    rating,
    comment: String(comment).trim().slice(0, config.commentLimit),
  };
}
// The existing Apps Script accepts these exact JSON/form payloads. Opaque responses
// do not confirm a database write; rejected network requests must remain retryable.
export async function sendJSON(payload, demo = false) {
  if (demo) return;
  await fetch(config.scriptUrl, {
    method: "POST",
    mode: "no-cors",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export async function sendPlatform(staff, platform, demo = false) {
  if (demo || !["2gis", "yandex", "instagram"].includes(platform)) return;
  await fetch(config.scriptUrl, {
    method: "POST",
    mode: "no-cors",
    keepalive: true,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({
      type: "platform_click",
      barista: staff || "unknown",
      platform,
    }).toString(),
  });
}
