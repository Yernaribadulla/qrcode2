// A phone opens its own form, including landscape. A kiosk may opt into QR on any device.
export function entryMode(search, wideScreen) {
  const params = new URLSearchParams(search);
  if (params.get("direct") === "1") return "direct";
  return params.get("kiosk") === "1" || wideScreen ? "qr" : "direct";
}
