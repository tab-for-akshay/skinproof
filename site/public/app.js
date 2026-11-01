// SkinProof front end. Built by Tab, an AI assistant, for team lead Akshay Wagh.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LABELS = { wrinkle:"Wrinkles", droopy_upper_eyelid:"Upper eyelid", droopy_lower_eyelid:"Lower eyelid", firmness:"Firmness", acne:"Acne", moisture:"Moisture", eye_bag:"Eye bags", dark_circle_v2:"Dark circles", age_spot:"Spots", radiance:"Radiance", redness:"Redness", oiliness:"Oiliness", pore:"Pores", texture:"Texture", tear_trough:"Tear trough" };
const COLORS = ["#16767d","#c2410c","#7c3aed","#c27c0e","#1f8a5b","#be185d"];
let NOISE = {}, SAMPLES = null, cur = null, lastCheck = null;
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { localStorage.setItem(k, JSON.stringify(v)); } };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function status(el, msg, err) { el.textContent = msg || ""; el.classList.toggle("err", !!err); }
function scoreColor(v) { return v >= 80 ? "#1f8a5b" : v >= 70 ? "#16767d" : v >= 60 ? "#c27c0e" : "#c2410c"; }

// ---------- normalise (same shape as the server) ----------
function normalize(output) {
  const out = { concerns: [], skin_type: {}, overall: null, skin_age: null };
  for (const o of output || []) {
    if (o.type === "all") out.overall = Math.round(o.score * 10) / 10;
    else if (o.type === "skin_age") out.skin_age = o.score;
    else if (o.type === "skin_type") out.skin_type[o.region || "whole"] = { type: o.skin_type, mask: o.mask || null };
    else if (o.ui_score !== undefined) out.concerns.push({ type: o.type, label: LABELS[o.type] || o.type, ui: o.ui_score, raw: Math.round(o.raw_score * 10) / 10, mask: o.mask || null, noise: NOISE[o.type] ?? 3 });
  }
  out.concerns.sort((a, b) => a.ui - b.ui);
  return out;
}
const scoresOf = r => Object.fromEntries(r.concerns.map(c => [c.type, c.ui]));
async function loadSample(key) { const j = await (await fetch(`/samples/${key}/result.json`)).json(); return { ...normalize(j.output), photo: j.photo, label: j.label }; }

// ---------- health ----------
async function health() {
  try { const h = await (await fetch("/api/health")).json();
    $("#liveState").textContent = h.live ? `Live scans on · ${h.units ?? "?"} YouCam units left in this demo's free pool` : "Demo mode: this demo's free YouCam units are used up — sample faces and the demo trial still work.";
    if (!h.live) { $("#camBtn").disabled = true; }
  } catch (e) { $("#liveState").textContent = ""; }
}

// ---------- scan ----------
function mode() { return $$('input[name=mode]').find(i => i.checked).value; }
async function toJpeg(blob, maxSide = 1600) {
  const img = await createImageBitmap(blob); const s = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  if (Math.min(c.width, c.height) < 480) throw new Error("That photo is too small — use at least 480 px on the short side.");
  return await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
}
async function liveScan(blob, camkit) {
  const st = $("#scanStatus");
  if (!$("#consent").checked) { status(st, "Please tick the consent box first — your photo goes to the YouCam API for analysis.", true); $("#consent").focus(); return; }
  try {
    status(st, "Preparing photo…"); const jpg = await toJpeg(blob);
    status(st, "Uploading to YouCam AI Skin Analysis…");
    const r = await fetch(`/api/scan?mode=${mode()}${camkit ? "&camkit=1" : ""}`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: jpg });
    const j = await r.json(); if (!r.ok) return status(st, j.error || "Scan failed.", true);
    for (let i = 0; i < 45; i++) {
      await sleep(i < 3 ? 2500 : 2000); status(st, `Analysing ${mode() === "breakout" ? "4" : "15"} concerns… ${(i + 1) * 2}s`);
      const p = await (await fetch(`/api/scan/${encodeURIComponent(j.task_id)}`)).json();
      if (p.status === "success") { const res = { ...p, photo: p.photo || URL.createObjectURL(jpg), label: "Your scan" }; cur = { source: "live", result: res, blob: jpg }; saveLast(res); render(res); status(st, ""); return; }
      if (p.status === "error") return status(st, p.error, true);
    }
    status(st, "The analysis is taking unusually long. Please try again.", true);
  } catch (e) { status(st, e.message || String(e), true); }
}
function saveLast(res) { store.set("sp_last", { date: new Date().toISOString().slice(0, 10), scores: scoresOf(res), overall: res.overall, skin_type: res.skin_type?.whole?.type || null, label: res.label }); updateCheckFor(); loadShop(); }
function render(res) {
  $("#result").classList.remove("hidden");
  const photo = $("#resPhoto"); photo.src = res.photo; photo.dataset.base = res.photo;
  $("#photoCap").textContent = "Tap a concern to see where it is";
  $("#overall").textContent = res.overall ? Math.round(res.overall) : "–";
  $("#ringBar").style.strokeDashoffset = 327 - 327 * ((res.overall || 0) / 100);
  $("#skinAge").textContent = res.skin_age ?? "–";
  $("#skinType").textContent = res.skin_type?.whole?.type ?? (mode() === "breakout" ? "n/a (breakout check)" : "–");
  $("#zones").textContent = res.skin_type?.t_zone ? `${res.skin_type.t_zone.type} / ${res.skin_type.u_zone?.type ?? "–"}` : "–";
  const pri = res.concerns.filter(c => c.ui < 75).slice(0, 3);
  $("#prio").innerHTML = (pri.length ? "<span class='small muted'>Your priorities:</span> " + pri.map(c => `<span class="chip">${esc(c.label)} ${c.ui}</span>`).join(" ") : "<span class='chip ok'>No concern below 75 — maintenance mode</span>");
  $("#concerns").innerHTML = res.concerns.map((c, i) => `<button class="c" data-i="${i}"><div class="top2"><span>${esc(c.label)}</span><span style="color:${scoreColor(c.ui)}">${c.ui}<small class="muted" title="Measurement noise: re-photographing the same face moved this score by up to ${c.noise - 1} points, so changes smaller than ±${c.noise} are ignored in trials."> ±${c.noise}</small></span></div><div class="bar2"><i style="width:${c.ui}%;background:${scoreColor(c.ui)}"></i></div></button>`).join("");
  $$("#concerns .c").forEach(b => b.onclick = () => { $$("#concerns .c").forEach(x => x.classList.remove("on")); b.classList.add("on"); const c = res.concerns[+b.dataset.i]; if (c.mask) { photo.src = c.mask; $("#photoCap").textContent = c.label + " — highlighted by YouCam"; } });
  $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
}
async function pickSample(key) {
  const st = $("#scanStatus"); status(st, "Loading sample scan (real YouCam results, cached)…");
  const res = await loadSample(key); cur = { source: "sample", key, result: res }; saveLast(res); render(res); status(st, "");
}
function loadCamKit() {
  return new Promise((ok, bad) => {
    if (window.YMK) return ok();
    window.YMKAsyncInit = () => ok();
    const s = document.createElement("script"); s.src = "https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js"; s.onerror = () => bad(new Error("Couldn't load the YouCam Camera Kit (network or content blocker).")); document.body.appendChild(s);
    setTimeout(() => window.YMK ? ok() : bad(new Error("The YouCam Camera Kit took too long to load.")), 12000);
  });
}
async function openCam() {
  const st = $("#scanStatus");
  if (!$("#consent").checked) { status(st, "Please tick the consent box first.", true); $("#consent").focus(); return; }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { status(st, "This browser can't open the camera here. Upload a photo instead — front-facing, daylight, no filter.", true); return; }
  try {
    status(st, "Asking for camera permission…");
    const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }); probe.getTracks().forEach(t => t.stop());
  } catch (e) {
    const why = e.name === "NotAllowedError" ? "Camera permission was declined." : e.name === "NotFoundError" ? "No camera found on this device." : "The camera couldn't start (" + e.name + ").";
    status(st, why + " You can upload a photo instead.", true); return;
  }
  try {
    status(st, "Opening the YouCam guided camera…"); await loadCamKit();
    if (!window.__camBound) { window.__camBound = true;
      YMK.addEventListener("faceDetectionCaptured", async (r) => { const it = r.images?.[0]; if (!it) return; YMK.close(); const blob = typeof it.image === "string" ? await (await fetch(it.image)).blob() : it.image; liveScan(blob, true); });
      YMK.addEventListener("cameraFailed", () => status(st, "The camera stopped. You can upload a photo instead.", true)); }
    YMK.init({ faceDetectionMode: "skincare", imageFormat: "base64", language: "enu", width: Math.min(480, innerWidth - 40), height: 520 });
    YMK.openCameraKit(); status(st, "Line up your face; it captures automatically when light and angle are right.");
  } catch (e) { status(st, e.message + " You can upload a photo instead.", true); }
}

// ---------- shop ----------
let SHOP = null, SHOPCAT = "All";
async function loadShop() {
  const l = store.get("sp_last", null); if (!l) return;
  $("#shopFor").innerHTML = `Ranked for: <b>${esc(l.label || "your scan")}</b> — ${topThree(l.scores)}`;
  try { const r = await fetch("/api/shop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scores: l.scores }) }); SHOP = await r.json(); renderShop(); } catch (e) { $("#shopList").innerHTML = "<p class='status err'>Couldn't load the catalogue. Try again.</p>"; }
}
function renderShop() {
  if (!SHOP) return;
  const cats = ["All", ...new Set(SHOP.products.map(p => p.category.split(" (")[0]))];
  $("#shopFilters").innerHTML = cats.map(c => `<button class="chipbtn ${c === SHOPCAT ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  $$("#shopFilters .chipbtn").forEach(b => b.onclick = () => { SHOPCAT = b.dataset.c; renderShop(); });
  const list = SHOP.products.filter(p => SHOPCAT === "All" || p.category.startsWith(SHOPCAT)).slice(0, SHOPCAT === "All" ? 9 : 30);
  $("#shopList").innerHTML = list.map(p => { const g = p.fit >= 65 ? "g-good" : p.fit >= 45 ? "g-mid" : "g-bad";
    return `<div class="prod"><div class="prod-top"><div class="fitbadge ${g}">${p.fit}</div><div><div class="small muted">${esc(p.brand)} · ${esc(p.category)}</div><b>${esc(p.name)}</b></div></div>
    <div class="small">${p.hits.length ? [...new Map(p.hits.map(h => [h.concern, h])).values()].map(h => `<span class="chip t">${esc(h.concern)} · ${esc(h.active.split(" (")[0])}</span>`).join(" ") : "<span class='muted'>Targets none of your priorities</span>"}</div>
    ${p.cautions.length ? `<div class="small warnline">⚠ ${p.cautions.map(esc).join("; ")}</div>` : `<div class="small okline">No cautions for your skin</div>`}
    <div class="row"><button class="btn small-btn" data-why="${esc(p.id)}">Why ${p.fit}?</button><a class="btn ghost small-btn" href="${esc(p.shop)}" target="_blank" rel="noopener">Where to buy ↗</a></div></div>`; }).join("");
  $$("#shopList [data-why]").forEach(b => b.onclick = () => { const p = SHOP.products.find(x => x.id === b.dataset.why); $("#pName").value = p.brand + " " + p.name; $("#pIng").value = p.ingredients; location.hash = "#check"; runCheck(); });
  $("#shopNote").innerHTML = esc(SHOP.note) + " Ingredient lists: INCIDecoder (linked on each check).";
}
function topThree(scores) { const eye = ["dark_circle_v2", "eye_bag", "tear_trough", "droopy_upper_eyelid", "droopy_lower_eyelid"]; return "priorities " + Object.entries(scores).filter(([k]) => !eye.includes(k)).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k, v]) => `${LABELS[k]} ${v}`).join(", "); }

// ---------- product check ----------
const EX = [
  ["Clear-Pore BHA + Niacinamide Serum", "Aqua, Niacinamide, Glycerin, Salicylic Acid, Zinc PCA, Panthenol, Sodium Hyaluronate, Allantoin, Xanthan Gum, Phenoxyethanol"],
  ["Bright-C 15% Serum", "Aqua, Ascorbic Acid, Propylene Glycol, Glycerin, Tocopherol, Ferulic Acid, Sodium Hyaluronate, Panthenol, Phenoxyethanol"],
  ["Rose Velvet Rich Night Cream", "Aqua, Cetearyl Alcohol, Shea Butter, Parfum, Alcohol Denat., Rosa Damascena Flower Oil, Lavandula Angustifolia Oil, Limonene, Linalool, Glycerin, Dimethicone"],
  ["Renew Retinol + Peptide Cream", "Aqua, Glycerin, Squalane, Niacinamide, Retinol, Palmitoyl Tripeptide-1, Ceramide NP, Sodium Hyaluronate, Tocopherol, Phenoxyethanol"],
];
function updateCheckFor() {
  const l = store.get("sp_last", null);
  $("#checkFor").innerHTML = l ? `Checking against: <b>${esc(l.label || "your scan")}</b> (${l.date}) — ${topThree(l.scores)}` : "No scan yet. Scan first, or pick a sample face above.";
}
async function runCheck() {
  const st = $("#checkStatus"), l = store.get("sp_last", null);
  if (!l) return status(st, "Scan first (or pick a sample face) so we know what your skin needs.", true);
  status(st, "Matching ingredients and scoring fit…"); $("#checkOut").classList.add("hidden");
  const body = { product: $("#pName").value || "This product", ingredients: $("#pIng").value, scores: l.scores, private: $("#private").checked };
  try {
    const r = await fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) return status(st, j.error || "Check failed.", true);
    lastCheck = { ...j, product: body.product, ingredients: body.ingredients }; status(st, ""); renderCheck(lastCheck);
  } catch (e) { status(st, "Network error. Try again.", true); }
}
function renderCheck(j) {
  const g = j.fit >= 65 ? "g-good" : j.fit >= 45 ? "g-mid" : "g-bad", ex = j.explanation || {}, bd = j.breakdown || {}, cov = j.coverage || {};
  const simKeys = Object.keys(j.simulate || {}), an = /^[8]|^1[18]$/.test(String(j.trial.weeks)) ? "an" : "a";
  const src = SHOP?.products?.find(p => (p.brand + " " + p.name) === j.product);
  $("#checkOut").innerHTML = `
  <div class="fit"><div><div class="gauge ${g}">${j.fit}<small>${esc(j.verdict)}</small></div>
    <table class="maths small"><tr><td>Starting point</td><td>${bd.base}</td></tr>${j.priorities.map(p => `<tr><td>${esc(p.label)} (${p.share}% weight)</td><td>+${p.points}<span class="muted">/${p.max_points}</span></td></tr>`).join("")}${bd.penalty ? `<tr><td>Cautions for your skin</td><td class="neg">−${bd.penalty}</td></tr>` : ""}<tr class="tot"><td>Fit</td><td>${j.fit}</td></tr></table></div>
   <div><h3>${esc(ex.headline || j.verdict)}</h3>
    <div class="box"><h4>Your priorities vs. this formula</h4><table><tr><th>Concern</th><th>You</th><th>Best match in formula</th></tr>${j.priorities.map(p => `<tr><td>${esc(p.label)}</td><td>${p.ui}</td><td>${p.best ? `<span class="chip t">${esc(p.best.active)}</span> <span title="evidence strength">${"●".repeat(p.best.strength)}${"○".repeat(3 - p.best.strength)}</span> <span class="muted">${esc(p.best.dose || "")}</span>` : "<span class='muted'>nothing in this formula</span>"}</td></tr>`).join("")}</table>
    <p class="small muted">● evidence strength from the sourced knowledge base. Recognised ${cov.recognised} of ${cov.parsed} ingredients (the rest are bases, textures and preservatives we don't score)${cov.one_pct_line ? ` · ingredients after #${cov.one_pct_line} are probably under 1%` : ""}. Ingredient order is only a rough guide to amount.</p></div>
    ${ex.why?.length ? `<div class="box"><h4>Why</h4><ul>${ex.why.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${(ex.watch_out?.length || j.cautions.length) ? `<div class="box"><h4>Watch out</h4><ul>${(ex.watch_out?.length ? ex.watch_out : j.cautions.map(c => `${c.active}: ${c.note}`)).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${ex.how_to_use?.length ? `<div class="box"><h4>How to use it</h4><ul>${ex.how_to_use.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    <details class="box"><summary><b>Facts the explanation was written from (${j.matches.length} actives)</b></summary>${j.matches.map(m => `<div class="small"><b>${esc(m.name)}</b> <span class="muted">#${m.position}, ${esc(m.dose || "")} — ${esc(m.note)}</span> ${m.src.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(" · ")}</div>`).join("") || "<p class='small muted'>No known actives from our list.</p>"}</details>
    <p class="small muted">${esc(ex.brain || "")}${ex.guard?.checked ? (ex.guard.blocked?.length ? "" : " · Guard: no ingredient outside this formula was named.") : ""}${src ? ` · <a href="${esc(src.source)}" target="_blank" rel="noopener">Ingredient list source</a> · <a href="${esc(src.shop)}" target="_blank" rel="noopener">Where to buy ↗</a>` : ""}</p>
    <div class="row">${simKeys.length ? `<button class="btn" id="simBtn">✨ Show a realistic target (YouCam Skin Simulation)</button>` : ""}<button class="btn primary" id="trialBtn">Start ${an} ${j.trial.weeks}-week trial</button></div>
    <div id="simOut"></div></div></div>`;
  $("#checkOut").classList.remove("hidden");
  if ($("#simBtn")) $("#simBtn").onclick = () => runSim(j.simulate);
  $("#trialBtn").onclick = () => startTrial(j);
}
async function runSim(params) {
  const out = $("#simOut"); out.innerHTML = "<p class='status'>Simulating a moderate, realistic improvement for the targeted concerns…</p>";
  try {
    let blob, before;
    if (cur?.source === "live" && cur.blob) { blob = cur.blob; before = URL.createObjectURL(blob); }
    else { const key = cur?.key || "priya"; const base = key.split("_")[0]; before = `/samples/${base}/full.jpg`; blob = await (await fetch(before)).blob(); }
    const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, v.toFixed(2)]));
    const r = await fetch("/api/simulate?" + q, { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
    const j = await r.json(); if (!r.ok) { out.innerHTML = `<p class="status err">${esc(j.error)}</p>`; return; }
    for (let i = 0; i < 40; i++) { await sleep(2000); const p = await (await fetch(`/api/simulate/${encodeURIComponent(j.task_id)}`)).json();
      if (p.status === "success") { out.innerHTML = `<div class="ba" id="ba"><img src="${before}" alt="before"><div class="after"><img src="${esc(p.url)}" alt="simulated"></div><span class="lbl" style="left:8px">Target (simulated)</span><span class="lbl" style="right:8px">Today</span><input type="range" min="0" max="100" value="50" aria-label="Compare"></div><p class="small muted">YouCam AI Skin Simulation at ${Object.entries(params).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", ")} — a moderate target for this product's evidence, not a promise.</p>`;
        const ba = $("#ba"), af = ba.querySelector(".after"), ai = af.querySelector("img"); const fit = () => ai.style.width = ba.clientWidth + "px"; fit(); addEventListener("resize", fit); ba.querySelector("input").oninput = e => af.style.width = e.target.value + "%"; return; }
      if (p.status === "error") { out.innerHTML = `<p class="status err">${esc(p.error)}</p>`; return; } }
  } catch (e) { out.innerHTML = `<p class="status err">${esc(e.message)}</p>`; }
}

// ---------- trials ----------
const CONTROL_POOL = ["wrinkle", "eye_bag", "firmness", "dark_circle_v2", "tear_trough", "droopy_upper_eyelid"];
const CHECKLIST = "Same room and window light, no flash · phone at arm's length, straight on · hair off the face, no makeup · same time of day";
function controlsFor(track) { return CONTROL_POOL.filter(c => !track.includes(c)).slice(0, 2); }
function startTrial(j) {
  const l = store.get("sp_last", null); if (!l) return;
  const t = store.get("sp_trials", []);
  const tr = { id: Date.now(), product: j.product, start: l.date, track: j.trial.track, controls: controlsFor(j.trial.track), weeks: j.trial.weeks, checkins: [{ date: l.date, label: "Baseline", scores: l.scores }] };
  t.unshift(tr); store.set("sp_trials", t); renderTrials();
  setTimeout(() => { $("#trials").scrollIntoView({ behavior: "smooth" }); const c = $(`[data-trialcard="${tr.id}"]`); if (c) { c.classList.add("flash"); } }, 50);
}
function ics(tr) {
  const d0 = new Date(tr.start + "T09:00:00"), ev = [], pad = n => String(n).padStart(2, "0"), f = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T090000`;
  for (let w = 2; w <= tr.weeks; w += 2) { const d = new Date(d0.getTime() + w * 7 * 864e5); ev.push(`BEGIN:VEVENT\r\nUID:skinproof-${tr.id}-${w}@skinproof.sites.tab.bot\r\nDTSTAMP:${f(new Date())}\r\nDTSTART:${f(d)}\r\nDURATION:PT10M\r\nSUMMARY:SkinProof check-in (week ${w}): ${tr.product.replace(/[,;\\]/g, " ")}\r\nDESCRIPTION:Re-scan at https://skinproof.sites.tab.bot/#trials — ${CHECKLIST}\r\nEND:VEVENT`); }
  const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SkinProof//EN\r\n${ev.join("\r\n")}\r\nEND:VCALENDAR\r\n`], { type: "text/calendar" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "skinproof-checkins.ics"; a.click();
}
function verdict(tr) {
  const base = tr.checkins[0].scores, n = tr.checkins.length, last = tr.checkins[n - 1].scores, prev = n > 2 ? tr.checkins[n - 2].scores : null;
  const days = (Date.parse(tr.checkins[n - 1].date) - Date.parse(tr.checkins[0].date)) / 864e5;
  const row = (k, kind) => { const nz = NOISE[k] ?? 3, d = (last[k] ?? 0) - (base[k] ?? 0), dp = prev ? (prev[k] ?? 0) - (base[k] ?? 0) : null;
    const st = d >= nz && dp !== null && dp >= nz ? "improving" : d >= nz ? "early" : d <= -nz ? "worse" : "flat"; return { k, d, nz, st, kind }; };
  const rows = tr.track.map(k => row(k, "tracked"));
  const safety = tr.track.includes("redness") ? null : row("redness", "safety");
  const controls = (tr.controls || controlsFor(tr.track)).map(k => row(k, "control"));
  const redWorse = rows.find(r => r.k === "redness" && r.st === "worse") || (safety && safety.st === "worse" ? safety : null);
  const imp = rows.filter(r => r.st === "improving"), early = rows.filter(r => r.st === "early");
  const strong = imp.filter(r => r.d >= 2 * r.nz).length;
  let v, cls, why, conf = "";
  if (n < 2) { v = "Baseline saved"; cls = "v-wait"; why = `Next check-in in 2 weeks. ${CHECKLIST}.`; }
  else if (redWorse) { v = "Pause it: redness is up"; cls = "v-bad"; why = `Redness fell ${-redWorse.d} points (noise ±${redWorse.nz}) — possible irritation. Stop for a week; see a dermatologist if it persists.`; conf = Math.abs(redWorse.d) >= 2 * redWorse.nz ? "high confidence" : "moderate confidence"; }
  else if (imp.length >= Math.ceil(rows.length / 2)) { v = "Working — keep it"; cls = "v-good"; why = `${imp.length} of ${rows.length} tracked concerns improved beyond noise on two check-ins in a row.`; conf = strong >= Math.ceil(rows.length / 2) ? "high confidence" : "moderate confidence"; }
  else if (days < tr.weeks * 7) { v = "Too early to call"; cls = "v-wait"; why = `${imp.length} confirmed and ${early.length} early signals out of ${rows.length}. Keep going to week ${tr.weeks}.`; }
  else { v = "Not working for you"; cls = "v-bad"; why = `After ${Math.round(days / 7)} weeks, fewer than half the tracked concerns improved beyond noise. Consider switching.`; conf = "moderate confidence"; }
  const ctlMoved = controls.filter(r => r.st !== "flat").length;
  return { v, cls, why, conf, rows, extra: [...(safety ? [safety] : []), ...controls], ctlMoved };
}
function chart(tr) {
  const W = 640, Hh = 230, PL = 40, PR = 46, PT = 14, PB = 34, n = tr.checkins.length, xs = i => PL + (n === 1 ? (W - PL - PR) / 2 : i * (W - PL - PR) / (n - 1));
  const keys = [...tr.track, ...(tr.track.includes("redness") ? [] : ["redness"])];
  const all = tr.checkins.flatMap(c => keys.map(k => c.scores[k] ?? 50)); const lo = Math.max(0, Math.floor((Math.min(...all) - 6) / 10) * 10), hi = Math.min(100, Math.max(...all) + 4);
  const y = v => PT + (hi - v) / (hi - lo) * (Hh - PT - PB);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Score trend">`;
  for (let g = Math.ceil(lo / 10) * 10; g <= hi; g += 10) s += `<line x1="${PL}" x2="${W - PR}" y1="${y(g)}" y2="${y(g)}" stroke="#eee"/><text x="${PL - 8}" y="${y(g) + 4}" font-size="11" text-anchor="end" fill="#888">${g}</text>`;
  keys.forEach((k, j) => { const col = k === "redness" && !tr.track.includes("redness") ? "#be185d" : COLORS[j % COLORS.length], b = tr.checkins[0].scores[k] ?? 50, nz = NOISE[k] ?? 3, dash = k === "redness" && !tr.track.includes("redness") ? ' stroke-dasharray="5 4"' : "";
    s += `<rect x="${PL}" width="${W - PL - PR}" y="${y(Math.min(100, b + nz))}" height="${y(b - nz) - y(Math.min(100, b + nz))}" fill="${col}" opacity=".07"/>`;
    s += `<polyline fill="none" stroke="${col}" stroke-width="2.5"${dash} points="${tr.checkins.map((c, i) => `${xs(i)},${y(c.scores[k] ?? b)}`).join(" ")}"/>`;
    tr.checkins.forEach((c, i) => s += `<circle cx="${xs(i)}" cy="${y(c.scores[k] ?? b)}" r="4" fill="${col}"/>`); });
  tr.checkins.forEach((c, i) => s += `<text x="${xs(i)}" y="${Hh - 10}" font-size="11" text-anchor="${n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"}" fill="#555">${esc(c.label)} · ${c.date.slice(5)}</text>`);
  return s + "</svg>" + `<div class="legend">${keys.map((k, j) => `<span><i style="background:${k === "redness" && !tr.track.includes("redness") ? "#be185d" : COLORS[j % COLORS.length]}"></i>${LABELS[k]}${k === "redness" && !tr.track.includes("redness") ? " (safety watch)" : ""}</span>`).join("")}<span class="muted">shaded = baseline ± noise</span></div>`;
}
const STATUS = { improving: "✅ improving (confirmed)", early: "↗ early signal", worse: "⚠ worse", flat: "— within noise" };
function trialRow(tr, r) { const label = r.kind === "control" ? `${LABELS[r.k]} <span class="chip">control</span>` : r.kind === "safety" ? `${LABELS[r.k]} <span class="chip">safety watch</span>` : LABELS[r.k];
  const st = r.kind === "control" ? (r.st === "flat" ? "— flat, as expected" : "moved: check capture conditions") : STATUS[r.st];
  return `<tr class="${r.kind}"><td>${label}</td><td>${tr.checkins[0].scores[r.k] ?? "–"}</td><td>${tr.checkins.at(-1).scores[r.k] ?? "–"}</td><td><b style="color:${r.d > 0 ? "#1f8a5b" : r.d < 0 ? "#c2410c" : "#555"}">${r.d > 0 ? "+" : ""}${r.d}</b></td><td>±${r.nz}</td><td>${st}</td></tr>`; }
function trialCard(tr, demo) {
  const v = verdict(tr);
  return `<div class="trial" data-trialcard="${tr.id || ""}"><div class="trial-head"><div><b>${esc(tr.product)}</b>${demo ? ` <span class="chip t">demo · ${esc(demo)}</span>` : ""}<div class="small muted">Started ${tr.start} · ${tr.weeks}-week trial · tracking ${tr.track.map(k => LABELS[k]).join(", ")}</div></div><div class="vbox"><div class="verdict ${v.cls}">${esc(v.v)}</div>${v.conf ? `<div class="small muted">${v.conf}</div>` : ""}<div class="small">${esc(v.why)}</div></div></div>
   ${tr.checkins.length > 2 ? `<div class="timeline small">${tr.checkins.slice(1).map((c, i) => { const vv = verdict({ ...tr, checkins: tr.checkins.slice(0, i + 2) }); return `<span class="tl ${vv.cls}">${esc(c.label)}: <b>${esc(vv.v)}</b></span>`; }).join("<span class='muted'>→</span>")}</div>` : ""}
   ${tr.checkins[0].photo ? `<div class="thumbs">${tr.checkins.map(c => `<figure><img src="${c.photo}" alt="${esc(c.label)} photo"><figcaption>${esc(c.label)}</figcaption></figure>`).join("")}</div>` : ""}
   ${chart(tr)}
   <table><tr><th>Concern</th><th>Baseline</th><th>Latest</th><th>Change</th><th>Noise</th><th>Status</th></tr>${v.rows.map(r => trialRow(tr, r)).join("")}${v.extra.map(r => trialRow(tr, r)).join("")}</table>
   ${demo ? "" : `<p class="small muted">Before each check-in: ${CHECKLIST}.</p><div class="row"><label class="btn primary"><input type="file" accept="image/jpeg,image/png" hidden data-trial="${tr.id}">📷 Add a check-in scan</label><button class="btn" data-ics="${tr.id}">📅 Add check-in reminders</button><button class="btn ghost" data-del="${tr.id}">Delete</button></div>`}</div>`;
}
let DEMOS = null;
async function demoTrials() {
  if (DEMOS) return DEMOS; DEMOS = [];
  for (const d of SAMPLES.demo_trials) { const cis = []; for (const c of d.checkins) { const r = await loadSample(c.sample); cis.push({ date: c.date, label: c.label, scores: scoresOf(r), photo: r.photo }); }
    DEMOS.push({ product: d.product, start: d.start, track: d.track, controls: d.controls, weeks: d.weeks, tag: d.tag, checkins: cis }); }
  return DEMOS;
}
async function renderTrials() {
  const t = store.get("sp_trials", []), demos = await demoTrials();
  $("#trialList").innerHTML = (t.length ? t.map(x => trialCard(x, false)).join("") : `<p class="pill-note">No trial of yours yet — run a product check and tap “Start trial”. Two demo trials below.</p>`) + demos.map(d => trialCard(d, d.tag)).join("");
  $$("#trialList input[data-trial]").forEach(inp => inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return; const id = +inp.dataset.trial;
    if (!$("#consent").checked) { alert("Tick the consent box in the Scan section first."); location.hash = "#scan"; return; }
    location.hash = "#scan"; await liveScan(f, false);
    if (cur?.source === "live") { const all = store.get("sp_trials", []), tr = all.find(x => x.id === id); tr.checkins.push({ date: new Date().toISOString().slice(0, 10), label: `Check-in ${tr.checkins.length}`, scores: scoresOf(cur.result) }); store.set("sp_trials", all); renderTrials(); location.hash = "#trials"; }
  });
  $$("#trialList [data-ics]").forEach(b => b.onclick = () => ics(store.get("sp_trials", []).find(x => x.id === +b.dataset.ics)));
  $$("#trialList [data-del]").forEach(b => b.onclick = () => { store.set("sp_trials", store.get("sp_trials", []).filter(x => x.id !== +b.dataset.del)); renderTrials(); });
}

// ---------- boot ----------
(async function boot() {
  health();
  try { const nt = await (await fetch("/samples/noise_test.json")).json(); for (const [k, v] of Object.entries(nt.max_abs_delta)) NOISE[k] = Math.max(3, v + 1);
    $("#noiseTable").innerHTML = `<table><tr><th>Concern</th><th>Mean Δ</th><th>Max Δ</th><th>Band</th></tr>${Object.entries(nt.max_abs_delta).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `<tr><td>${LABELS[k]}</td><td>${nt.mean_abs_delta?.[k] ?? "–"}</td><td>${v}</td><td>±${NOISE[k]}</td></tr>`).join("")}</table>`; } catch (e) {}
  SAMPLES = await (await fetch("/samples/index.json")).json();
  $("#sampleRow").innerHTML = SAMPLES.faces.map(f => `<button class="sample" data-k="${f.key}"><img src="/samples/${f.key}/photo.jpg" alt=""><span><b>${f.name}, ${f.age}</b><br><small class="muted">${f.blurb}</small></span></button>`).join("");
  $$("#sampleRow .sample").forEach(b => b.onclick = () => pickSample(b.dataset.k));
  $("#file").onchange = e => e.target.files[0] && liveScan(e.target.files[0], false);
  $("#camBtn").onclick = openCam;
  $$(".examples button").forEach(b => b.onclick = () => { const e = EX[+b.dataset.ex]; $("#pName").value = e[0]; $("#pIng").value = e[1]; });
  $("#checkBtn").onclick = runCheck;
  $("#heroDemo").onclick = () => { location.hash = "#trials"; };
  $("#breakoutLink").onclick = () => { const r = $$('input[name=mode]').find(i => i.value === "breakout"); if (r) r.checked = true; };
  if (store.get("sp_last", null)) loadShop();
  updateCheckFor(); renderTrials();
})();
