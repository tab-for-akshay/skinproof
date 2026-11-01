#!/usr/bin/env python3
"""Build the Vercel bundle: static public/ + api/index.mjs (the same worker, keys read from env SP_SECRETS).
Built by Tab, an AI assistant, for team lead Akshay Wagh. Usage: build_vercel.py <outdir>"""
import json, os, shutil, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__)); out = sys.argv[1]
tmp = out + "_cf"; subprocess.run([sys.executable, os.path.join(here, "build.py"), tmp], check=True)
shutil.rmtree(out, ignore_errors=True); shutil.copytree(os.path.join(here, "public"), out)
w = open(os.path.join(tmp, "worker.mjs")).read()
assert "const SECRETS = {};" in w and "export default {" in w
w = w.replace("const SECRETS = {};", 'const SECRETS = JSON.parse(process.env.SP_SECRETS || "{}");', 1).replace("export default {", "const __W = {", 1)
os.makedirs(os.path.join(out, "api"), exist_ok=True)
open(os.path.join(out, "api", "index.mjs"), "w").write(w + "\n" + open(os.path.join(here, "vercel_adapter.mjs")).read())
json.dump({"name": "skinproof", "private": True, "type": "module"}, open(os.path.join(out, "package.json"), "w"))
json.dump({"cleanUrls": True, "functions": {"api/index.mjs": {"maxDuration": 60}},
           "rewrites": [{"source": "/api/:path*", "destination": "/api/index?__p=/api/:path*"}],
           "headers": [{"source": "/(.*)", "headers": [{"key": "access-control-allow-origin", "value": "*"}]}]}, open(os.path.join(out, "vercel.json"), "w"), indent=1)
shutil.rmtree(tmp); print("built", out)
