/* =========================================================
   Vercel serverless function: emails a new lead or job applicant
   to the JBros inbox through Resend (resend.com).

   Every form on the site calls this first. Sending from our own
   server means the email no longer depends on the visitor's
   browser or on FormSubmit being up. The browser only falls back
   to FormSubmit if this returns ok: false.

   Body: { kind, source, subject, name, phone, email,
           sections: [{ title, rows: [[label, value], ...] }] }
     kind    — "website" | "ad" | "hiring", picks the banner colour
     source  — which form it came from, shown big at the top

   Environment variables set in Vercel:
     RESEND_API_KEY  — API key from resend.com (starts re_)
     LEAD_EMAIL_TO   — optional, defaults to jbroswc@gmail.com
     RESEND_FROM     — optional, defaults to Resend's shared sender, which
                       can only deliver to the email the Resend account was
                       made with (so sign up with jbroswc@gmail.com)
   ========================================================= */

const clean = (v, max = 400) => String(v == null ? "" : v).trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const BANNER = {
  website: "#004ed4", // blue
  ad: "#e8590c",      // orange
  hiring: "#7c3aed",  // purple
};

function phoneDigits(raw) {
  let d = clean(raw, 40).replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  return d;
}

/* keep only well-formed sections, capped so nobody can mail us a novel */
function readSections(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((s) => ({
    title: clean(s && s.title, 80),
    rows: (Array.isArray(s && s.rows) ? s.rows : []).slice(0, 30)
      .map((r) => [clean(r && r[0], 120), clean(r && r[1], 600)])
      .filter((r) => r[0] || r[1]),
  })).filter((s) => s.title || s.rows.length);
}

const btn = (href, label, bg) =>
  `<a href="${href}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;font-weight:bold;font-size:16px;padding:13px 22px;border-radius:8px;margin:0 8px 8px 0">${label}</a>`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // trimmed: a stray space or newline pasted into Vercel makes the request header invalid
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) return res.status(200).json({ ok: false, error: "RESEND_API_KEY not set" });
  if (!/^re_\S+$/.test(key)) return res.status(200).json({ ok: false, error: "RESEND_API_KEY is not a Resend API key (should start with re_)" });

  const d = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const subject = clean(d.subject, 200);
  const name = clean(d.name, 120);
  const email = clean(d.email, 120);
  const source = clean(d.source, 120);
  const color = BANNER[clean(d.kind, 20)] || "#333";
  const sections = readSections(d.sections);
  const message = clean(d.message, 6000); // older callers send plain text instead of sections
  if (!subject || !name) return res.status(400).json({ ok: false, error: "Missing fields" });

  // the number is a call link; the buttons call or text straight from the email app
  const digits = phoneDigits(d.phone);
  const phone = digits.length === 10
    ? `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : clean(d.phone, 40);
  const tel = digits.length === 10 ? `tel:+1${digits}` : "";
  const sms = digits.length === 10 ? `sms:+1${digits}` : "";

  const sectionHtml = sections.map((s) => `
  ${s.title ? `<p style="margin:22px 0 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#666">${esc(s.title)}</p>` : ""}
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:15px">
    ${s.rows.map((r) => `<tr>
      <td style="padding:9px 12px 9px 0;border-bottom:1px solid #e5e7eb;color:#555;vertical-align:top;width:42%">${esc(r[0])}</td>
      <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#111;font-weight:bold;vertical-align:top">${esc(r[1]) || "—"}</td>
    </tr>`).join("")}
  </table>`).join("");

  const html = `
<div style="font-family:Arial,sans-serif;font-size:16px;color:#111;line-height:1.5;max-width:560px">
  ${source ? `<div style="background:${color};color:#fff;font-weight:bold;font-size:15px;letter-spacing:.04em;padding:10px 14px;border-radius:8px;margin:0 0 16px">FROM: ${esc(source.toUpperCase())}</div>` : ""}
  <p style="margin:0 0 2px;font-size:22px"><b>${esc(name)}</b></p>
  <p style="margin:0 0 14px;font-size:20px">${tel ? `<a href="${tel}" style="color:#004ed4">${esc(phone)}</a>` : esc(phone)}</p>
  ${tel ? `<p style="margin:0 0 6px">${btn(tel, "&#128222; Call", "#004ed4")}${btn(sms, "&#128172; Text", "#16a34a")}</p>` : ""}
  ${email ? `<p style="margin:6px 0 0">Email: <a href="mailto:${esc(email)}">${esc(email)}</a></p>` : ""}
  ${sectionHtml}
  ${message && !sections.length ? `<pre style="font-family:Arial,sans-serif;font-size:15px;white-space:pre-wrap;margin:18px 0 0;padding:14px;background:#f4f5f7;border-radius:8px">${esc(message)}</pre>` : ""}
</div>`;

  const text = [
    source ? `FROM: ${source.toUpperCase()}` : "",
    name,
    phone,
    ...(email ? [`Email: ${email}`] : []),
    ...sections.flatMap((s) => ["", ...(s.title ? [s.title.toUpperCase()] : []), ...s.rows.map((r) => `${r[0]}: ${r[1]}`)]),
    ...(message && !sections.length ? ["", message] : []),
  ].join("\n");

  const body = {
    from: process.env.RESEND_FROM || "JBros Leads <onboarding@resend.dev>",
    to: [process.env.LEAD_EMAIL_TO || "jbroswc@gmail.com"],
    subject,
    html,
    text,
  };
  if (/^\S+@\S+\.\S+$/.test(email)) body.reply_to = email;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error("Resend failed:", r.status, err);
      return res.status(200).json({ ok: false, error: `Resend ${r.status}` });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Resend failed:", err);
    return res.status(200).json({ ok: false, error: "Resend unreachable" });
  }
}
