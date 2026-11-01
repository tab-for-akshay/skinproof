// SkinProof — server worker (one file). Built by Tab, an AI assistant, for team lead Akshay Wagh.
// All YouCam API calls happen here, server-side. Keys are injected at deploy time and never reach the browser.
const SECRETS = {};
const KB = __KB__;
const CATALOG = __CATALOG__;
const NOISE = __NOISE__;
const YC = "https://yce-api-01.makeupar.com";
const RESERVE_UNITS = 60;          // keep a floor so judges always find the app working
const SCANS_PER_IP_PER_HOUR = 8;
const SD_ALL = ["wrinkle","droopy_upper_eyelid","droopy_lower_eyelid","firmness","acne","moisture","eye_bag","dark_circle_v2","age_spot","radiance","redness","oiliness","pore","texture","tear_trough","skin_type"];
const SD_BREAKOUT = ["acne","redness","oiliness","pore"];
const SIM_KEYS = { acne:"acne", redness:"redness", oiliness:"oiliness", pore:"pores", texture:"texture", wrinkle:"wrinkle", age_spot:"spots", radiance:"radiance", eye_bag:"eye_bags", dark_circle_v2:"dark_circle" };
const LABELS = { wrinkle:"Wrinkles", droopy_upper_eyelid:"Upper eyelid", droopy_lower_eyelid:"Lower eyelid", firmness:"Firmness", acne:"Acne", moisture:"Moisture", eye_bag:"Eye bags", dark_circle_v2:"Dark circles", age_spot:"Spots", radiance:"Radiance", redness:"Redness", oiliness:"Oiliness", pore:"Pores", texture:"Texture", tear_trough:"Tear trough" };
const ERR = {
  error_no_face: "We couldn't find a face. Use a clear, front-facing selfie.",
  error_src_face_out_of_bound: "Your face is too close to the edge. Step back a little so your whole face and some space around it are in the photo.",
  error_pose: "Please face the camera straight on.",
  error_face_parsing: "The photo is too dark or blurry to read the skin. Try even daylight.",
  error_exceed_max_image_size: "That image is too large. Try a normal phone selfie.",
  exceed_max_filesize: "That file is too large (max 10 MB).",
  error_decode_image: "We couldn't read that image file. Use a JPG or PNG.",
  error_nsfw_content_detected: "That image can't be analysed. Use a plain selfie.",
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const hits = new Map();
function limited(ip) {
  const now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (h.length >= SCANS_PER_IP_PER_HOUR) return true;
  h.push(now); hits.set(ip, h); return false;
}
let unitCache = { at: 0, units: null };
async function units(force) {
  if (!force && Date.now() - unitCache.at < 60e3 && unitCache.units !== null) return unitCache.units;
  try {
    const r = await fetch(YC + "/s2s/v1.0/client/credit", { headers: { authorization: "Bearer " + SECRETS.YOUCAM_API_KEY } });
    const j = await r.json();
    const u = (j.results || []).reduce((a, x) => a + (x.amount_dec ?? x.amount ?? 0), 0);
    unitCache = { at: Date.now(), units: u };
  } catch (e) { /* keep last */ }
  return unitCache.units;
}
async function yc(path, init = {}) {
  const r = await fetch(YC + path, { ...init, headers: { authorization: "Bearer " + SECRETS.YOUCAM_API_KEY, "content-type": "application/json", ...(init.headers || {}) } });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
async function uploadImage(kind, bytes, type) {
  const name = "selfie." + (type === "image/png" ? "png" : "jpg");
  const f = await yc(`/s2s/v2.0/file/${kind}`, { method: "POST", body: JSON.stringify({ files: [{ content_type: type, file_name: name, file_size: bytes.byteLength }] }) });
  if (f.status !== 200) throw new Error("file_api_" + f.status);
  const file = f.j.data.files[0], rq = file.requests[0];
  const put = await fetch(rq.url, { method: rq.method || "PUT", headers: rq.headers, body: bytes });
  if (!put.ok) throw new Error("upload_" + put.status);
  return file.file_id;
}
async function readImage(req) {
  const type = (req.headers.get("content-type") || "").split(";")[0];
  if (!["image/jpeg", "image/png"].includes(type)) return { err: "Please send a JPG or PNG photo." };
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength < 10e3) return { err: "That photo is too small." };
  if (bytes.byteLength > 8e6) return { err: "That photo is too large (max 8 MB)." };
  return { bytes, type };
}
function normalize(output) {
  const out = { concerns: [], skin_type: {}, overall: null, skin_age: null };
  for (const o of output || []) {
    if (o.type === "all") out.overall = Math.round(o.score * 10) / 10;
    else if (o.type === "skin_age") out.skin_age = o.score;
    else if (o.type === "skin_type") out.skin_type[o.region || "whole"] = { type: o.skin_type, mask: (o.mask_urls || [])[0] || null };
    else if (o.type === "resize_image") out.photo = (o.mask_urls || [])[0] || null;
    else if (o.ui_score !== undefined) out.concerns.push({ type: o.type, label: LABELS[o.type] || o.type, ui: o.ui_score, raw: Math.round(o.raw_score * 10) / 10, mask: (o.mask_urls || [])[0] || null, noise: NOISE[o.type] ?? 3 });
  }
  out.concerns.sort((a, b) => a.ui - b.ui);
  return out;
}
// ---------- product check (grounded) ----------
function parseIngredients(text) {
  // Copes with text pasted from shop pages: "Ingredients:" labels, percentages, bullets, line breaks, "may contain" tails.
  let t = String(text || "").toLowerCase().replace(/[\u200b\u00a0\r]/g, " ");
  t = t.replace(/\b(full )?(active |inactive |other )?ingredients?\s*(list)?\s*:/g, ",").replace(/\[(more|less)\]/g, " ");
  t = t.replace(/\(?\s*\d+(\.\d+)?\s*%\s*\)?/g, " ").replace(/\b(may contain|\+\/-)\b/g, ",");
  return t.split(/[,\n;•·|]+/).map(s => s.replace(/[*.†‡]/g, " ").replace(/\s+/g, " ").trim()).filter(s => s && s.length < 90).slice(0, 90);
}
function wordHit(tok, syn) {
  const i = tok.indexOf(syn); if (i < 0) return false;
  const b = i === 0 || /[^a-z0-9]/.test(tok[i - 1]), a = i + syn.length >= tok.length || /[^a-z0-9]/.test(tok[i + syn.length]);
  return b && a;
}
// Ingredients are listed by amount down to 1%; below that, order is free. Preservatives sit at or under ~1%,
// so the first preservative is used as a rough "1% line". Low-dose actives (retinoids, peptides, BHA) still work under it.
const ONE_PCT = ["phenoxyethanol", "ethylhexylglycerin", "sodium benzoate", "potassium sorbate", "chlorphenesin", "benzyl alcohol", "methylparaben", "caprylyl glycol", "1,2-hexanediol", "disodium edta"];
const LOW_DOSE = ["retinol", "adapalene", "peptides", "salicylic_acid", "fragrance", "essential_oils", "bakuchiol"];
function onePctLine(list) { const i = list.findIndex(t => ONE_PCT.some(p => t.includes(p))); return i < 0 ? list.length : i; }
function matchKB(list) {
  const found = [], line = onePctLine(list);
  for (const act of KB.actives) {
    let pos = -1;
    for (let i = 0; i < list.length && pos < 0; i++) if (act.syn.some(s => wordHit(list[i], s))) pos = i;
    if (pos < 0) continue;
    const below = pos > line, low = LOW_DOSE.includes(act.id);
    const posw = below && !low ? 0.5 : pos < 5 ? 1 : pos < 12 ? 0.85 : 0.7;
    found.push({ ...act, position: pos + 1, posw, dose: below ? (low ? "below the ~1% line (fine for this active)" : "below the ~1% line (likely a token amount)") : pos < 5 ? "top 5 (main ingredient)" : "above the ~1% line" });
  }
  return found;
}
function recognised(list) { return list.filter(t => KB.actives.some(a => a.syn.some(s => wordHit(t, s)))).length; }
const EYE = ["dark_circle_v2", "eye_bag", "tear_trough", "droopy_upper_eyelid", "droopy_lower_eyelid"];
function priorities(scores, eyeProduct) {
  // Eye-area concerns only count for eye products: a face serum should not be marked down for not treating eye bags.
  const arr = Object.entries(scores || {}).filter(([k, v]) => LABELS[k] && typeof v === "number" && (eyeProduct ? true : !EYE.includes(k))).sort((a, b) => a[1] - b[1]);
  let p = arr.filter(([, v]) => v < 75).slice(0, 3);
  if (!p.length) p = arr.slice(0, 2);
  return p.map(([k, v]) => ({ type: k, label: LABELS[k], ui: v, weight: (100 - v) / 100 }));
}
function assess(scores, list, product, rinseOff) {
  // Rinse-off products (cleansers) sit on skin for a minute, so their actives count half.
  rinseOff = rinseOff ?? /cleanser|face ?wash|micellar/i.test(product || "");
  const m = matchKB(list).map(a => rinseOff && Object.keys(a.targets).length ? { ...a, posw: a.posw * 0.5, dose: a.dose + ", rinse-off" } : a), pri = priorities(scores, /\beye/i.test(product || ""));
  let ben = 0, wsum = 0; const perConcern = [];
  for (const p of pri) wsum += p.weight;
  for (const p of pri) {
    let best = null;
    for (const a of m) { const s = a.targets[p.type]; if (s) { const v = (s / 3) * a.posw; if (!best || v > best.v) best = { v, a: a.name, strength: s, dose: a.dose }; } }
    const share = wsum ? p.weight / wsum : 0, pts = Math.round(80 * share * (best ? best.v : 0));
    ben += (best ? best.v : 0) * p.weight;
    perConcern.push({ ...p, share: Math.round(share * 100), points: pts, max_points: Math.round(80 * share), best: best ? { active: best.a, strength: best.strength, dose: best.dose } : null });
  }
  const benefit = wsum ? ben / wsum : 0;
  const cautions = [];
  for (const a of m) for (const [c, note] of Object.entries(a.caution || {})) {
    const v = scores?.[c];
    const irritant = (a.flags || []).includes("irritant");
    if (typeof v === "number" && v < 72) cautions.push({ active: a.name, concern: LABELS[c], your_score: v, note, severity: irritant && a.position <= 10 ? 2 : 1 });
  }
  const perActive = {};
  for (const c of cautions) perActive[c.active] = Math.min(15, (perActive[c.active] || 0) + (c.severity === 2 ? 12 : 6));
  let penalty = Object.values(perActive).reduce((s, v) => s + v, 0); penalty = Math.min(40, penalty);
  const base = 20, gained = perConcern.reduce((s, p) => s + p.points, 0);
  const fit = Math.max(0, Math.min(100, base + gained - penalty));
  const verdict = fit >= 65 ? "Good match" : fit >= 45 ? "Partial match" : "Poor match";
  const sim = {};
  for (const p of perConcern) if (p.best && p.best.strength >= 2 && SIM_KEYS[p.type]) sim[SIM_KEYS[p.type]] = Math.min(0.55, 0.15 + 0.1 * p.best.strength);
  // A trial tracks every concern this formula meaningfully targets (strength 2+) that still has room to improve.
  const tgt = {};
  for (const a of m) for (const [c, s] of Object.entries(a.targets)) if (s >= 2 && LABELS[c] && typeof scores?.[c] === "number" && scores[c] < 85) tgt[c] = Math.max(tgt[c] || 0, s);
  const track = Object.keys(tgt).sort((x, y) => scores[x] - scores[y]).slice(0, 5);
  const weeks = Math.max(4, ...m.filter(a => track.some(t => a.targets[t])).map(a => a.weeks || 0));
  const flags = [...new Set(m.flatMap(a => a.flags || []))];
  return { fit, verdict, benefit: Math.round(benefit * 100),
    breakdown: { base, gained, penalty, per_active_penalty: perActive },
    coverage: { parsed: list.length, recognised: recognised(list), one_pct_line: onePctLine(list) < list.length ? onePctLine(list) + 1 : null },
    priorities: perConcern, matches: m.map(a => ({ id: a.id, name: a.name, position: a.position, dose: a.dose, targets: a.targets, note: a.note, src: (a.src || []).map(k => KB.sources[k]).filter(Boolean) })), cautions, simulate: sim, trial: { track: track.length ? track : pri.map(p => p.type), weeks: Math.min(12, weeks) }, flags };
}
async function chat(messages, wantPrivate) {
  const tries = [], CFU = `https://api.cloudflare.com/client/v4/accounts/${SECRETS.CF_ACCOUNT}/ai/v1/chat/completions`;
  if (wantPrivate && SECRETS.PRIV_URL) tries.push({ who: "private", url: SECRETS.PRIV_URL + "/chat/completions", key: SECRETS.PRIV_KEY, body: { model: "local", max_tokens: 420, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } }, ms: 25000 });
  if (SECRETS.CF_TOKEN) tries.push({ who: "open", url: CFU, key: SECRETS.CF_TOKEN, body: { model: "@cf/openai/gpt-oss-120b", max_tokens: 1400, temperature: 0.3 }, ms: 20000 });
  tries.push({ who: "open", url: "https://api.groq.com/openai/v1/chat/completions", key: SECRETS.GROQ_API_KEY, body: { model: "openai/gpt-oss-120b", reasoning_effort: "low", max_tokens: 1400, temperature: 0.3 }, ms: 20000 });
  if (SECRETS.CF_TOKEN) tries.push({ who: "open", url: CFU, key: SECRETS.CF_TOKEN, body: { model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", max_tokens: 900, temperature: 0.3 }, ms: 15000 });
  tries.push({ who: "hosted", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: SECRETS.GEMINI_API_KEY, body: { model: "gemini-3.5-flash-lite", max_tokens: 1400, temperature: 0.3 }, ms: 15000 });
  let attempts = 0;
  for (const t of tries) {
    attempts++;
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), t.ms);
      const r = await fetch(t.url, { method: "POST", signal: ctl.signal, headers: { authorization: "Bearer " + t.key, "content-type": "application/json" }, body: JSON.stringify({ ...t.body, messages }) });
      clearTimeout(tm);
      const j = await r.json();
      const text = j?.choices?.[0]?.message?.content;
      if (r.ok && text && text.trim() && extractJSON(text)) return { text, who: t.who, attempts };
    } catch (e) { /* try the next model; failures are never shown to the shopper */ }
  }
  return { text: null, who: null, attempts };
}
function extractJSON(t) { try { const a = t.indexOf("{"), b = t.lastIndexOf("}"); return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
function guard(ex, allowedNames) {
  // Code guard: list every knowledge-base active the AI text names that the product does not contain.
  const text = JSON.stringify(ex).toLowerCase(), bad = [];
  for (const a of KB.actives) {
    if (allowedNames.includes(a.name)) continue;
    const words = [a.name.toLowerCase().split(" (")[0], ...a.syn.filter(s => s.length > 6)];
    if (words.some(w => text.includes(w))) bad.push(a.name);
  }
  return bad;
}
function fallbackExplain(a, product) {
  const top = a.priorities.map(p => p.best ? `${p.label} (${p.ui}/100): ${p.best.active} targets it` : `${p.label} (${p.ui}/100): nothing in this formula targets it`);
  return { headline: `${a.verdict} for your skin (${a.fit}/100)`, why: top, watch_out: a.cautions.map(c => `${c.active}: ${c.note}`), how_to_use: ["Patch test on the inner arm or jawline for a few days first.", "Change one product at a time, so SkinProof can tell what worked.", `Re-scan every 2 weeks for ${a.trial.weeks} weeks in the same light.`] };
}
async function explain(a, product, wantPrivate) {
  const facts = { product, verdict: a.verdict, fit: a.fit, your_priorities: a.priorities.map(p => ({ concern: p.label, score: p.ui, targeted_by: p.best?.active || null, strength: p.best?.strength || 0 })), actives_found: a.matches.map(m => ({ name: m.name, position_in_list: m.position, note: m.note })), cautions: a.cautions.map(c => ({ active: c.active, concern: c.concern, note: c.note })), trial_weeks: a.trial.weeks };
  const sys = "You are SkinProof's product-fit explainer. Write for a shopper deciding whether to buy. Use ONLY the facts in the JSON you are given: never mention an ingredient that is not in actives_found, never invent percentages, studies or claims, never diagnose a disease. Scores are 1-100 where higher means healthier-looking skin. Be specific to the shopper's measured scores. Your headline must agree with the verdict field. Answer ONLY with JSON: {\"headline\": string (max 12 words), \"why\": [2-3 short strings], \"watch_out\": [0-3 short strings], \"how_to_use\": [2-3 short strings]}. Suggest seeing a dermatologist if the shopper reports pain, cysts or a worsening rash.";
  let r = await chat([{ role: "system", content: sys }, { role: "user", content: JSON.stringify(facts) }], wantPrivate);
  let ex = r.text ? extractJSON(r.text) : null, blocked = [];
  if (ex) { blocked = guard(ex, a.matches.map(m => m.name)); if (blocked.length) ex = null; }
  if (ex && ex.headline) ex.headline = `${a.verdict}: ${String(ex.headline).replace(/^(good|partial|poor) match[:,.\s-]*/i, "")}`;
  const g = { checked: !!r.text, blocked };
  if (!ex || !ex.headline) return { ...fallbackExplain(a, product), brain: blocked.length ? "Plain facts (the AI draft named an ingredient this product doesn't contain, so the guard discarded it)" : "Plain facts (AI explanation unavailable right now)", guard: g };
  return { ...ex, brain: r.who === "private" ? "Written privately by our self-hosted open model from the facts above" : "Written by an open AI model from the facts above, checked by the ingredient guard", guard: g };
}
// ---------- routes ----------
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), p = url.pathname, ip = req.headers.get("cf-connecting-ip") || "x";
    try {
      if (p === "/api/health") { const u = await units(url.searchParams.has("fresh")); return json({ ok: true, live: u === null ? true : u > RESERVE_UNITS + 16, units: u === null ? null : Math.floor(u) }); }
      if (p === "/api/scan" && req.method === "POST") {
        const u = await units(); if (u !== null && u < RESERVE_UNITS + 16) return json({ error: "Live scans are paused: this demo's free YouCam units are used up. Try the sample faces." }, 503);
        if (limited(ip)) return json({ error: "That's a lot of scans in an hour. Please try again later, or use a sample face." }, 429);
        const img = await readImage(req); if (img.err) return json({ error: img.err }, 400);
        const mode = url.searchParams.get("mode") === "breakout" ? "breakout" : "full";
        const fid = await uploadImage("skin-analysis", img.bytes, img.type);
        const t = await yc("/s2s/v2.0/task/skin-analysis", { method: "POST", body: JSON.stringify({ src_file_id: fid, dst_actions: mode === "breakout" ? SD_BREAKOUT : SD_ALL, miniserver_args: { enable_mask_overlay: true }, format: "json", ...(url.searchParams.get("camkit") === "1" ? { pf_camera_kit: true } : {}) }) });
        if (t.status !== 200) return json({ error: "The skin analysis service didn't accept that photo. Try a clear, front-facing photo in daylight." }, 502);
        unitCache.at = 0;
        return json({ task_id: t.j.data.task_id, mode });
      }
      let m;
      if ((m = p.match(/^\/api\/scan\/([A-Za-z0-9_\-+=\/]+)$/))) {
        const t = await yc("/s2s/v2.0/task/skin-analysis/" + encodeURIComponent(m[1]));
        const d = t.j?.data || {};
        if (d.task_status === "success") return json({ status: "success", ...normalize(d.results?.output) });
        if (d.task_status === "error") return json({ status: "error", error: ERR[d.error] || ("Analysis failed (" + d.error + "). Try another photo.") });
        return json({ status: d.task_status || "running" });
      }
      if (p === "/api/simulate" && req.method === "POST") {
        const u = await units(); if (u !== null && u < RESERVE_UNITS + 6) return json({ error: "Simulation is paused: the demo's free units are used up." }, 503);
        if (limited(ip)) return json({ error: "Too many requests this hour." }, 429);
        const img = await readImage(req); if (img.err) return json({ error: img.err }, 400);
        const params = {}; for (const k of Object.values(SIM_KEYS)) { const v = parseFloat(url.searchParams.get(k)); if (v > 0 && v <= 1) params[k] = Math.min(0.6, v); }
        if (!Object.keys(params).length) return json({ error: "Nothing to simulate for this product." }, 400);
        const fid = await uploadImage("skin-simulation", img.bytes, img.type);
        const t = await yc("/s2s/v2.0/task/skin-simulation", { method: "POST", body: JSON.stringify({ src_file_id: fid, ...params }) });
        if (t.status !== 200) return json({ error: "The simulation service didn't accept that photo. Try a front-facing photo with the whole face in frame." }, 502);
        unitCache.at = 0;
        return json({ task_id: t.j.data.task_id, params });
      }
      if ((m = p.match(/^\/api\/simulate\/([A-Za-z0-9_\-+=\/]+)$/))) {
        const t = await yc("/s2s/v2.0/task/skin-simulation/" + encodeURIComponent(m[1]));
        const d = t.j?.data || {};
        if (d.task_status === "success") return json({ status: "success", url: d.results?.url });
        if (d.task_status === "error") return json({ status: "error", error: ERR[d.error] || ("Simulation failed (" + d.error + ").") });
        return json({ status: d.task_status || "running" });
      }
      if (p === "/api/check" && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        const list = parseIngredients(b.ingredients);
        if (list.length < 2) return json({ error: "Paste the full ingredient list (INCI), separated by commas." }, 400);
        const a = assess(b.scores || {}, list, b.product);
        const ex = await explain(a, String(b.product || "This product").slice(0, 120), !!b.private);
        return json({ ...a, explanation: ex, parsed: list.length });
      }
      if (p === "/api/shop" && req.method === "POST") {
        // Rank the catalogue against this person's measured scores. Pure code, no AI, no YouCam units.
        const b = await req.json().catch(() => ({}));
        const rows = CATALOG.products.map(pr => { const a = assess(b.scores || {}, parseIngredients(pr.ingredients), pr.name, /cleanser/i.test(pr.category));
          return { id: pr.id, brand: pr.brand, name: pr.name, category: pr.category, source: pr.source, shop: pr.shop, ingredients: pr.ingredients, fit: a.fit, verdict: a.verdict,
            hits: a.priorities.filter(x => x.best).map(x => ({ concern: x.label, active: x.best.active })), cautions: [...new Set(a.cautions.map(c => c.active + " — " + c.concern.toLowerCase()))] }; });
        rows.sort((x, y) => y.fit - x.fit || x.cautions.length - y.cautions.length);
        return json({ products: rows, note: CATALOG.note });
      }
      if (p === "/api/kb") return json(KB);
      return env.ASSETS.fetch(req);
    } catch (e) {
      return json({ error: "Something went wrong on our side. Please try again." }, 500);
    }
  },
};
