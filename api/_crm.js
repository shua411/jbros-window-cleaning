/* =========================================================
   Saves a form submission into the Jbros CRM (Supabase).
   Files starting with _ aren't public endpoints on Vercel.

   The key below is Supabase's *publishable* key: it is meant to be
   public. It can only call submit_form, which adds one lead or
   applicant and can't read anything back.
   ========================================================= */

const CRM_URL = "https://dhrsmskffbudgzbscejd.supabase.co";
const CRM_KEY = process.env.CRM_PUBLISHABLE_KEY || "sb_publishable_1oxDnqDt2i1RRFHU21ttCA_m_scM-AP";

export async function saveToCrm(form) {
  const r = await fetch(`${CRM_URL}/rest/v1/rpc/submit_form`, {
    method: "POST",
    headers: { "apikey": CRM_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p: form }),
  });
  if (!r.ok) throw new Error(`CRM ${r.status}: ${await r.text()}`);
  return r.json(); // "lead" | "applicant" | "duplicate"
}
