// Vercel adapter for the SkinProof worker (Node.js serverless function).
// Built by Tab, an AI assistant, for team lead Akshay Wagh.
// The same one-file worker runs on Cloudflare-style hosting and here. Static files are served by Vercel;
// /api/* is rewritten to this function. Keys come from the encrypted env var SP_SECRETS (never in the repo).
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  try {
    const u = new URL(req.url, "https://" + (req.headers.host || "skinproof.vercel.app"));
    const p = u.searchParams.get("__p"); u.searchParams.delete("__p");
    if (p) u.pathname = p;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
    headers.set("cf-connecting-ip", String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim());
    let body;
    if (!["GET", "HEAD"].includes(req.method)) { const chunks = []; for await (const c of req) chunks.push(c); body = Buffer.concat(chunks); }
    const r = await __W.fetch(new Request(u.toString(), { method: req.method, headers, body }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, {});
    res.statusCode = r.status;
    r.headers.forEach((v, k) => { if (k !== "content-encoding" && k !== "content-length") res.setHeader(k, v); });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.statusCode = 500; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ error: "Something went wrong on our side. Please try again." })); }
}
