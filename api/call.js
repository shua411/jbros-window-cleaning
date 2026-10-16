/* =========================================================
   Tap-to-call bridge for lead emails: /api/call?n=7789570282
   Email apps won't link tel: addresses, but they do link https.
   This opens the dialer straight away, with a big button as backup.
   ========================================================= */

export default function handler(req, res) {
  let d = String(req.query.n || "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  if (d.length !== 10) return res.status(400).send("That phone number doesn't look right.");

  const tel = `tel:+1${d}`;
  const pretty = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex");
  res.status(200).send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Call ${pretty}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f5f9;font-family:system-ui,-apple-system,sans-serif;color:#0e1626}
  a{display:block;padding:20px 34px;border-radius:14px;background:linear-gradient(90deg,#004ed4,#429bf8);color:#fff;text-decoration:none;font-size:22px;font-weight:700;text-align:center}
  p{text-align:center;color:#5c6675;margin-top:14px;font-size:14px}
</style></head>
<body><div><a href="${tel}">Call ${pretty}</a><p>Tap if your phone didn't open the dialer.</p></div>
<script>location.href=${JSON.stringify(tel)};</script>
</body></html>`);
}
