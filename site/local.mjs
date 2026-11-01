// Local harness: node site/local.mjs <path> [json-body]  — runs the worker with a static ASSETS stub.
import fs from "node:fs"; import path from "node:path";
const dist = process.argv[2]; const route = process.argv[3]; const body = process.argv[4];
const w = (await import(path.resolve(dist, "worker.mjs"))).default;
const env = { ASSETS: { fetch: async (req) => { const p = new URL(req.url).pathname; const f = path.join(dist, p === "/" ? "index.html" : p); return fs.existsSync(f) ? new Response(fs.readFileSync(f)) : new Response("nf", { status: 404 }); } } };
const req = new Request("https://local.test" + route, body ? { method: "POST", headers: { "content-type": "application/json" }, body } : {});
const r = await w.fetch(req, env, {}); console.log(r.status, (await r.text()).slice(0, process.env.FULL ? 1e7 : 3000));
