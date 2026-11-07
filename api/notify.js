/* =========================================================
   Vercel serverless function: emails a new lead or job applicant
   to the JBros inbox through Resend (resend.com).

   Every form on the site calls this first. Sending from our own
   server means the email no longer depends on the visitor's
   browser or on FormSubmit being up. The browser only falls back
   to FormSubmit if this returns ok: false.

   Environment variables set in Vercel:
     RESEND_API_KEY  — API key from resend.com (starts re_)
     LEAD_EMAIL_TO   — optional, defaults to jbroswc@gmail.com
     RESEND_FROM     — optional, defaults to Resend's shared sender, which
                       can only deliver to the email the Resend account was
                       made with (so sign up with jbroswc@gmail.com)
   ========================================================= */

const clean = (v, max = 400) => String(v == null ? "" : v).trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function phoneDigits(raw) {
  let d = clean(raw, 40).replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  return d;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(200).json({ ok: false, error: "RESEND_API_KEY not set" });

  const d = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const subject = clean(d.subject, 200);
  const name = clean(d.name, 120);
  const email = clean(d.email, 120);
  const message = clean(d.message, 6000);
  if (!subject || !name) return res.status(400).json({ ok: false, error: "Missing fields" });

  // big tappable number plus a call link, so calling back is one tap from the notification
  const digits = phoneDigits(d.phone);
  const phone = digits.length === 10
    ? `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : clean(d.phone, 40);
  const callUrl = digits.length === 10 ? `https://www.jbroswc.ca/api/call?n=${digits}` : "";

  const html = `
<div style="font-family:Arial,sans-serif;font-size:16px;color:#111;line-height:1.5">
  <p style="margin:0 0 4px;font-size:20px"><b>${esc(name)}</b></p>
  <p style="margin:0 0 14px;font-size:20px">${esc(phone)}</p>
  ${callUrl ? `<p style="margin:0 0 18px"><a href="${callUrl}" style="display:inline-block;background:#004ed4;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Tap to call ${esc(phone)}</a></p>` : ""}
  ${email ? `<p style="margin:0 0 14px">Email: <a href="mailto:${esc(email)}">${esc(email)}</a></p>` : ""}
  <pre style="font-family:Arial,sans-serif;font-size:15px;white-space:pre-wrap;margin:0;padding:14px;background:#f4f5f7;border-radius:8px">${esc(message)}</pre>
</div>`;
  const text = [
    name,
    phone,
    ...(callUrl ? [`Tap to call: ${callUrl}`] : []),
    ...(email ? [`Email: ${email}`] : []),
    "",
    message,
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
