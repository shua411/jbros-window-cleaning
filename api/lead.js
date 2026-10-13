/* =========================================================
   Vercel serverless function: receives a lead from the ads
   landing page, writes it into the Notion "Ad Leads" database,
   and emails the details so they land in the inbox too.

   Needs one environment variable set in Vercel:
     NOTION_TOKEN  — internal integration secret (starts ntn_)
   ========================================================= */

const NOTION_DB = "61167d1f-ec96-40d2-987e-9487299a4f86"; // Ad Leads
const LEAD_EMAIL = "jbroswc@gmail.com";

/* keep anything we store to the options the database actually has */
const CITIES = ["North Vancouver","West Vancouver","Vancouver","Burnaby","Coquitlam","Other"];
const SERVICES = ["Window Cleaning","Gutter Cleaning","Pressure Washing","House Washing","Seal Coating","Holiday Lighting"];
const SIZES = ["Small","Medium","Large"];
const STOREYS = ["1 storey","2 storeys","3+ storeys"];
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
    "Home Size":   { select: { name: pick(clean(d.homeSize), SIZES, "Medium") } },
    "Stories":     { select: { name: pick(clean(d.stories), STOREYS, "2 storeys") } },
    "Timeline":    { select: { name: pick(clean(d.timeline), TIMELINES, "ASAP") } },
  };

  if (services.length) props["Services"] = { multi_select: services };
  if (clean(d.phone))  props["Phone"]    = { phone_number: clean(d.phone, 40) };
  if (clean(d.email))  props["Email"]    = { email: clean(d.email, 120) };
  if (clean(d.address)) props["Address"] = { rich_text: [{ text: { content: clean(d.address, 300) } }] };
  if (clean(d.notes))  props["Notes"]    = { rich_text: [{ text: { content: clean(d.notes, 1800) } }] };

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
  const services = (Array.isArray(d.services) ? d.services : []).join(", ") || "(none picked)";
  const body = [
    "*** NEW LEAD FROM META AD ***",
    "",
    `Name: ${clean(d.name)}`,
    `Phone: ${clean(d.phone)}`,
    `Email: ${clean(d.email)}`,
    `Address: ${clean(d.address) || "(not given)"}, ${clean(d.city)}`,
    "",
    `Services: ${services}`,
    `Home: ${clean(d.homeSize)} / ${clean(d.stories)}`,
    `Timeline: ${clean(d.timeline)}`,
    "",
    `Notes: ${clean(d.notes) || "(none)"}`,
    "",
    "Saved to the Ad Leads database in Notion.",
  ].join("\n");

  const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(LEAD_EMAIL)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      _subject: `NEW AD LEAD: ${clean(d.name)} (${clean(d.timeline)})`,
      _template: "table",
      _captcha: "false",
      name: clean(d.name),
      phone: clean(d.phone),
      email: clean(d.email),
      message: body,
    }),
  });
  if (!r.ok) throw new Error(`Email ${r.status}`);
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
