/* =========================================================
   Vercel serverless function: receives a lead from the ads
   landing page and writes it into the Notion "Ad Leads" database.

   The email notification is sent from the visitor's browser
   instead (see script.js) because FormSubmit returns 403 to
   requests coming from Vercel's servers.

   It also sends the Lead to Meta's Conversions API, but only for
   North / West Vancouver leads, with the same event id the browser
   pixel uses so Meta counts one Lead.

   Environment variables set in Vercel:
     NOTION_TOKEN          — internal integration secret (starts ntn_)
     META_CAPI_TOKEN       — Conversions API access token from Events Manager
     META_TEST_EVENT_CODE  — optional, e.g. TEST12345, only while testing
   ========================================================= */

import { createHash } from "node:crypto";

const NOTION_DB = "61167d1f-ec96-40d2-987e-9487299a4f86"; // Ad Leads

/* keep anything we store to the options the database actually has */
const CITIES = ["North Vancouver","West Vancouver","Vancouver","Burnaby","Coquitlam","Other"];
const SERVICES = ["Window Cleaning","Gutter Cleaning","Pressure Washing","House Washing","Seal Coating","Holiday Lighting"];
const SIZES = ["Small","Medium","Large"];
const STOREYS = ["1 storey","2 storeys","3+ storeys"];

/* the landing page sends friendly labels like "Medium (3-4 bed)" */
const matchOption = (val, allowed, fallback) => {
  const v = String(val || "").toLowerCase();
  return allowed.find((o) => v.includes(o.toLowerCase().split(" ")[0])) || fallback;
};
const TIMELINES = ["ASAP","Within 2 weeks","Within a month","Just researching"];

const pick = (val, allowed, fallback) => (allowed.includes(val) ? val : fallback);
const clean = (v, max = 400) => String(v == null ? "" : v).trim().slice(0, max);

async function writeToNotion(d) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set");

  const services = (Array.isArray(d.services) ? d.services : [])
    .filter((s) => SERVICES.includes(s))
    .map((name) => ({ name }));

  const props = {
    "Name":        { title: [{ text: { content: clean(d.name, 120) || "(no name)" } }] },
    "Lead Status": { select: { name: "New" } },
    "Source":      { select: { name: "Meta Ad" } },
    "City":        { select: { name: pick(clean(d.city), CITIES, "Other") } },
  };

  // the short popup form doesn't ask these, so only fill them when sent
  if (clean(d.homeSize)) props["Home Size"] = { select: { name: matchOption(d.homeSize, SIZES, "Medium") } };
  if (clean(d.stories))  props["Stories"]   = { select: { name: matchOption(d.stories, STOREYS, "2 storeys") } };
  if (clean(d.timeline)) props["Timeline"]  = { select: { name: pick(clean(d.timeline), TIMELINES, "ASAP") } };

  if (services.length) props["Services"] = { multi_select: services };
  if (clean(d.phone))  props["Phone"]    = { phone_number: clean(d.phone, 40) };
  if (clean(d.email))  props["Email"]    = { email: clean(d.email, 120) };
  if (clean(d.address)) props["Address"] = { rich_text: [{ text: { content: clean(d.address, 300) } }] };
  const notes = [
    d.service ? `Wants: ${clean(d.service, 80)}` : "",
    d.offer ? `OFFER: ${clean(d.offer, 120)}` : "",
    d.estimate ? `Gutter estimate shown: ${clean(d.estimate, 40)}` : "",
    d.freeWindowValue ? `Free window cleaning value: ${clean(d.freeWindowValue, 20)}` : "",
    d.gutterStoreys ? `Gutters on: ${clean(d.gutterStoreys, 60)}` : "",
    d.gutterLast ? `Last cleaned: ${clean(d.gutterLast, 60)}` : "",
    d.roofClean ? `Roof clean: ${clean(d.roofClean, 60)}` : "",
    clean(d.notes) ? `\nThey said: ${clean(d.notes, 1200)}` : "",
  ].filter(Boolean).join("\n");
  if (notes) props["Notes"] = { rich_text: [{ text: { content: notes.slice(0, 1900) } }] };

  const r = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: NOTION_DB }, properties: props }),
  });

  if (!r.ok) throw new Error(`Notion ${r.status}: ${await r.text()}`);
}

/* ---------- Meta Conversions API ---------- */
const META_PIXEL = "1036420242504746";
const META_API = "https://graph.facebook.com/v23.0";
const IN_AREA = ["North Vancouver", "West Vancouver"];

const sha256 = (v) => createHash("sha256").update(v).digest("hex");
const hashed = (v) => (v ? [sha256(v)] : undefined);

async function sendToMeta(d, req) {
  const location = clean(d.location || d.city, 60);
  if (!IN_AREA.includes(location)) return "skipped (out of area)";

  const token = process.env.META_CAPI_TOKEN;
  if (!token) return "skipped (META_CAPI_TOKEN not set)";

  const names = clean(d.name, 120).toLowerCase().split(/\s+/).filter(Boolean);
  let phone = clean(d.phone, 40).replace(/\D/g, "");
  if (phone.length === 10) phone = "1" + phone;

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
             req.socket?.remoteAddress || undefined;

  const event = {
    event_name: "Lead",
    event_time: Math.floor(Date.now() / 1000),
    event_id: clean(d.eventId, 80) || undefined,
    action_source: "website",
    event_source_url: clean(d.pageUrl, 500) || undefined,
    user_data: {
      em: hashed(clean(d.email, 120).toLowerCase()),
      ph: hashed(phone),
      fn: hashed(names[0]),
      ln: hashed(names.length > 1 ? names[names.length - 1] : ""),
      ct: hashed(location.replace(/\s+/g, "").toLowerCase()),
      st: hashed("bc"),
      country: hashed("ca"),
      client_ip_address: ip,
      client_user_agent: req.headers["user-agent"] || undefined,
      fbp: clean(d.fbp, 200) || undefined,
      fbc: clean(d.fbc, 500) || undefined,
    },
    custom_data: {
      content_name: "Quote Request",
      content_category: clean(d.service, 80) || "Gutter Cleaning",
      city: location,
    },
  };

  const body = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  const r = await fetch(`${META_API}/${META_PIXEL}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Meta ${r.status}: ${await r.text()}`);
  return "sent";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const d = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  if (!clean(d.name) || !clean(d.phone) || !clean(d.email)) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  try {
    await writeToNotion(d);
  } catch (err) {
    console.error("Notion write failed:", err);
    const body = { ok: false, notion: false };
    if (req.headers["x-debug"] === "1") body.notionError = String(err && err.message);
    return res.status(502).json(body);
  }

  // the lead is safely stored; a Meta hiccup must never cost us the lead
  let meta;
  try {
    meta = await sendToMeta(d, req);
  } catch (err) {
    console.error("Meta CAPI failed:", err);
    meta = "failed";
  }

  return res.status(200).json({ ok: true, notion: true, meta });
}
