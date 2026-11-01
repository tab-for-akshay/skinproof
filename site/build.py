#!/usr/bin/env python3
"""Build the single-file worker for SkinProof: inlines the knowledge base and measured noise bands.
Secrets are NOT added here; deploy tooling injects them at publish time only."""
import json, os, shutil, sys
here = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "dist")
shutil.rmtree(out, ignore_errors=True); shutil.copytree(os.path.join(here, "public"), out)
kb = json.load(open(os.path.join(here, "public", "kb.json")))
nt = json.load(open(os.path.join(here, "public", "samples", "noise_test.json")))["max_abs_delta"]
noise = {k: max(3, v + 1) for k, v in nt.items()}
src = open(os.path.join(here, "worker.src.mjs")).read().replace("__KB__", json.dumps(kb)).replace("__NOISE__", json.dumps(noise)).replace("__CATALOG__", json.dumps(json.load(open(os.path.join(here, "public", "catalog.json")))))
open(os.path.join(out, "worker.mjs"), "w").write(src)
json.dump({"kind": "worker", "entry": "worker.mjs", "worker": {"compatibility_date": "2026-08-01", "compatibility_flags": ["nodejs_compat"], "html_handling": "auto-trailing-slash", "not_found_handling": "404-page"}}, open(os.path.join(out, "tab-site.json"), "w"))
print("built", out)
