// SkinProof fit widget: <div id="skinproof-fit" data-product="ID"></div><script src="https://skinproof-ai.vercel.app/embed.js"></script>
(async function () {
  const el = document.getElementById("skinproof-fit"); if (!el) return;
  const base = new URL(document.currentScript ? document.currentScript.src : location.href).origin;
  let last = null; try { last = JSON.parse(localStorage.getItem("sp_last")); } catch (e) {}
  let label = last?.label || "your scan";
  if (!last) { const r = await (await fetch(base + "/samples/priya/result.json")).json(); last = { scores: Object.fromEntries(r.output.filter(o => o.ui_score !== undefined).map(o => [o.type, o.ui_score])) }; label = "sample face Priya"; }
  const j = await (await fetch(base + "/api/shop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scores: last.scores }) })).json();
  const p = j.products.find(x => x.id === el.dataset.product); if (!p) return;
  const ing = document.getElementById("ing"); if (ing) ing.textContent = "Ingredients: " + p.ingredients;
  const col = p.fit >= 65 ? "#1f8a5b" : p.fit >= 45 ? "#c27c0e" : "#c2410c";
  const group = l => { const m = new Map(); for (const c of l) { const [k, v] = c.split(" — "); if (!m.has(k)) m.set(k, []); if (v && !m.get(k).includes(v)) m.get(k).push(v); } return [...m].map(([k, v]) => v.length ? k + " — " + v.join(", ") : k); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  el.innerHTML = `<div style="border:1px solid #e3ddd5;border-radius:14px;padding:.8rem 1rem;margin:.8rem 0;font:14px/1.45 system-ui,sans-serif;background:#fcfaf7">
   <div style="display:flex;gap:.8rem;align-items:center"><div style="background:${col};color:#fff;font-weight:800;font-size:1.3rem;border-radius:10px;width:52px;height:52px;display:grid;place-items:center">${p.fit}</div>
   <div><b>${esc(p.verdict)} for ${esc(label)}</b><div style="color:#666">SkinProof fit · #${p.rank} of ${j.products.length} for this skin</div></div></div>
   <div style="margin-top:.5rem">${p.hits.length ? "Targets: " + [...new Set(p.hits.map(h => h.concern + " (" + h.active.split(" (")[0] + ")"))].map(esc).join(", ") : "Doesn't target this shopper's priorities"}</div>
   ${p.cautions.length ? `<div style="color:#8a3b12">⚠ ${group(p.cautions).map(esc).join("; ")}</div>` : `<div style="color:#1f8a5b">No cautions for this skin</div>`}
   <div style="margin-top:.4rem"><a href="${base}/#shop" style="color:#16767d">Scan your skin / see better matches in SkinProof →</a></div></div>`;
})();
