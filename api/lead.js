/* =========================================================
   Vercel serverless function: receives a lead from the ads
   landing page, writes it into the Notion "Ad Leads" database,
   and emails the details so they land in the inbox too.

   Needs one environment variable set in Vercel:
     NOTION_TOKEN  — internal integration secret (starts ntn_)
   ========================================================= */

const NOTION_DB = "61167d1f-ec96-40d2-987e-9487299a4f86"; // Ad Leads
const LEAD_EMAIL = "jbroswc@gmail.com";
const SITE = "https://www.jbroswc.ca";

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
    "Home Size":   { select: { name: matchOption(d.homeSize, SIZES, "Medium") } },
    "Stories":     { select: { name: matchOption(d.stories, STOREYS, "2 storeys") } },
    "Timeline":    { select: { name: pick(clean(d.timeline), TIMELINES, "ASAP") } },
  };

  if (services.length) props["Services"] = { multi_select: services };
  if (clean(d.phone))  props["Phone"]    = { phone_number: clean(d.phone, 40) };
  if (clean(d.email))  props["Email"]    = { email: clean(d.email, 120) };
  if (clean(d.address)) props["Address"] = { rich_text: [{ text: { content: clean(d.address, 300) } }] };
  const notes = [
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

async function sendEmail(d) {
  const body = [
    "*** NEW LEAD FROM META AD ***",
    clean(d.offer) ? clean(d.offer, 120) : "",
    "",
    `Name: ${clean(d.name)}`,
    `Phone: ${clean(d.phone)}`,
    `Email: ${clean(d.email)}`,
    `Address: ${clean(d.address) || "(not given)"}, ${clean(d.city)}`,
    `Timeline: ${clean(d.timeline)}`,
    "",
    "--- GUTTER CLEANING ---",
    `Home: ${clean(d.homeSize)} / ${clean(d.stories)}`,
    `Gutters on: ${clean(d.gutterStoreys)}`,
    `Last cleaned: ${clean(d.gutterLast)}`,
    `Roof clean: ${clean(d.roofClean)}`,
    `Estimate shown to them: ${clean(d.estimate)}`,
    "",
    "--- FREE WINDOW CLEANING ---",
    `Value shown to them: ${clean(d.freeWindowValue)}`,
    "",
    `Notes: ${clean(d.notes) || "(none)"}`,
    "",
    "Saved to the Ad Leads database in Notion.",
  ].filter((l) => l !== null).join("\n");

  const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(LEAD_EMAIL)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      // FormSubmit rejects requests that don't say which site they came from.
      // Browsers add these automatically; a server has to set them itself.
      "Origin": SITE,
      "Referer": `${SITE}/claimoffer`,
    },
    body: JSON.stringify({
      _subject: `NEW AD LEAD: ${clean(d.name)} - gutters (${clean(d.timeline)})`,
      _template: "table",
      _captcha: "false",
      name: clean(d.name),
      phone: clean(d.phone),
      email: clean(d.email),
      message: body,
    }),
  });
  // FormSubmit answers 200 even when it refuses, so check the body too
  const out = await r.json().catch(() => ({}));
  if (!r.ok || String(out.success) !== "true") {
    throw new Error(`Email ${r.status}: ${out.message || "unknown error"}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const d = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  if (!clean(d.name) || !clean(d.phone) || !clean(d.email)) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  // Run both, but never lose the lead because one of them failed.
  const [notion, email] = await Promise.allSettled([writeToNotion(d), sendEmail(d)]);

  if (notion.status === "rejected") console.error("Notion write failed:", notion.reason);
  if (email.status === "rejected") console.error("Email send failed:", email.reason);

  if (notion.status === "rejected" && email.status === "rejected") {
    return res.status(502).json({ ok: false, error: "Could not record the lead" });
  }

  return res.status(200).json({
    ok: true,
    notion: notion.status === "fulfilled",
    email: email.status === "fulfilled",
  });
}
