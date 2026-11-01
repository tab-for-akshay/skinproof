# SkinProof — is your skincare actually working?

**Live:** https://skinproof.sites.tab.bot/  ·  **Demo video:** _(link added at submission)_  ·  **Licence:** MIT

> Built by Tab, an AI assistant, for team lead Akshay Wagh.

SkinProof meets the three moments in the YouCam Skin AI brief: **right before a purchase**, **right after a bad breakout**, and **in front of the mirror, wondering whether a product is working**.

1. **Scan** — YouCam **AI Skin Analysis** measures 15 concerns plus skin type, with a mask overlay for each one. You can upload a photo or use the YouCam **JS Camera Kit** guided capture. A cheaper 4-concern **breakout check** (acne, redness, oiliness, pores) is also available, and a breakout opens an *after a breakout* panel: what to do, what to pause, gentle picks that fit, and **cover it today** (a sheer-tint try-on with Makeup VTO).
2. **Shop what fits** — 25 real products, each with its published ingredient list, are ranked against *your* three weakest measured concerns. Each product shows what it targets, any cautions for your skin, a brand-site link and a price-comparison link. A callout separates the *best all-rounder* from the *strongest product for each of your concerns*. Tinted products have a **👁 Try it on** button that uses YouCam **Makeup VTO** on your own photo.
3. **Check any product** — paste any INCI list. SkinProof matches it against an open, sourced knowledge base of 35 actives and uses ingredient order as a rough strength guide. It then shows the fit-score arithmetic line by line. An open AI model writes a plain-language explanation **from those facts only**; a code guard throws out any draft that names an ingredient the product doesn't contain. YouCam **AI Skin Simulation** then shows a moderate, realistic target for the concerns the product actually targets.
4. **Trials** — re-scan every two weeks. A change counts only if it is **bigger than the measured noise** and **holds over two check-ins**. Untargeted *control* concerns should stay flat, and redness is always watched for irritation. The verdict is one of: *Working — keep it* · *Too early to call* · *Not working for you* · *Pause it: redness is up*, with a confidence label. You can download calendar reminders (.ics) for the check-ins.

## YouCam APIs used (all server-side, keys never reach the browser)
| API | Where | Why |
|---|---|---|
| AI Skin Analysis (SD, 15 concerns + skin type, mask overlays) | every scan and trial check-in | the measurement everything else rests on |
| AI Skin Simulation | product check → “realistic target” | shows the target, sized to the evidence for that product |
| JS Camera Kit (skincare face-detection mode) | “Use guided camera” | steadier captures → less noise between check-ins |
| AI Image Generator V2 | sample faces | the demo uses no real person's face |
| Makeup VTO (skin-smoothing tint) | “👁 Try it on” on tinted products; “cover it today” after a breakout | see a tinted SPF / BB finish on your own face before buying |
| Unit System API (credit) | `/api/health`, scan guard | live scans pause before the free units run out; units left are shown on the page |

## Architecture
```
browser (vanilla JS, no build)            one worker (site/worker.src.mjs → worker.mjs)
 ├─ resize photo → POST /api/scan  ─────▶  upload to YouCam file API → Skin Analysis task
 ├─ poll /api/scan/:id             ◀─────  normalised scores + mask URLs
 ├─ POST /api/shop {scores}        ─────▶  rank catalogue: parse INCI → match KB → fit (code only)
 ├─ POST /api/check {ingredients}  ─────▶  same fit maths + AI explanation from facts + ingredient guard
 ├─ POST /api/simulate?acne=…      ─────▶  Skin Simulation task (strengths from evidence, capped 0.6)
 ├─ POST /api/vto?cover=75         ─────▶  Makeup VTO task (skin_smooth tint) for try-on
 ├─ /embed.js on any store page    ─────▶  same /api/shop scoring → fit card next to “Add to bag”
 └─ trials in localStorage                 static assets via env.ASSETS
```
- **Fit score** = 20 base + up to 80 points shared across your 3 weakest concerns (each concern's share is proportional to how low it is) × the best active's evidence strength (1–3) × an ingredient-position factor − caution penalties (capped per active). Rinse-off products count half. Every term is shown in the UI.
- **Ingredient position.** Ingredients are listed by amount down to 1%. The first preservative is used as a rough “1% line”; actives below it count half, except low-dose actives such as retinoids, peptides and BHA.
- **Noise band.** Three synthetic faces were each re-analysed after +10% brightness with JPEG recompression and after a 3° tilt with a shifted crop (6 re-captures per concern). Band = max(3, largest change + 1). Real-life capture is noisier, so the band is a floor; SkinProof adds a capture checklist, the two-check-in rule and a confidence label. Data: `site/public/samples/noise_test.json`.
- **AI explainer chain.** open gpt-oss-120b (two providers), then Llama 3.3 70B, then a hosted model. An optional *private mode* runs on our own self-hosted open model. If every model is unavailable, the user sees the plain facts, never an error code.
- **Privacy.** Photos go to the YouCam API for analysis and are not stored by SkinProof. Scores and trials stay in the browser. There is a per-IP hourly limit and a unit reserve.

## For judges: the fastest path
Open the site and press **▶ Judges: 90-second guided tour**. It loads a sample face, ranks the shop, opens the reasoning for the strongest acne match, and ends on the two trials (one says *keep it*, one says *pause*). The retailer widget is at `/retailer.html`.

## Impact
Skincare buyers churn through products without knowing whether any of them worked. Most give up after a few weeks, before actives such as retinoids or azelaic acid usually show results, or they keep paying for something that does nothing for them. For a retailer, SkinProof is a decision layer that does three things:
- it recommends only products that target a shopper's measured concerns;
- it warns before a likely mismatch (for example fragrance on reactive skin), which reduces returns;
- it brings the shopper back every two weeks with a reason to re-scan.

It also refuses to over-claim: the noise band and the “Pause” verdict are there so a store cannot spin a placebo into a success story.

## Roadmap
- The retailer widget (live demo at `/retailer.html`) as a real integration: SKU → INCI feed → fit, plus add-to-cart tracking.
- Real-user pilot: n≈20, four weeks, the same phone and light, to measure real-world capture noise and calibrate the bands per concern.
- Push or email check-in reminders, and an optional account to sync trials across devices.
- A larger knowledge base (UV filters, preservatives, more humectants) with per-ingredient match rates published.
- Shade-matched VTO for tinted SPF and concealer, using the brand's own shade data (today's try-on previews the finish, not the shade).

## Run it yourself
```bash
git clone https://github.com/tab-for-akshay/skinproof && cd skinproof/site
python3 build.py dist            # inlines the knowledge base, catalogue and noise bands into dist/worker.mjs
node local.mjs dist /api/kb      # quick local check of a route (no keys needed for /api/kb, /api/shop, /api/check)
```
To deploy, put `dist/` on any Workers-compatible host with static assets (`env.ASSETS`). Set the secrets object at the top of `worker.mjs` at deploy time (`YOUCAM_API_KEY`, and optionally the AI keys). Never commit keys. YouCam API keys: https://yce.makeupar.com/ (API console).

## Repo map
- `site/worker.src.mjs` — the whole backend (routes, YouCam calls, fit maths, guard)
- `site/public/` — front end, `kb.json` (35 sourced actives), `catalog.json` (25 products), `samples/` (cached real YouCam results for the synthetic faces), `retailer.html` + `embed.js` (store widget demo)
- `ROUNDS.md` + `rounds/` — every critique round (v1 → v2 → v3) and what changed
- `SUBMISSION_DRAFT.md` — the Devpost text with a judging-criteria table
- `docs/` — screenshots

## AI disclosure
Built by Tab, an AI assistant, for team lead Akshay Wagh. The idea, code, knowledge base, catalogue, copy, sample faces (YouCam AI Image Generator V2), demo check-in images (YouCam Skin Simulation and an image filter), video and this README were produced by Tab, an AI assistant, working for team lead Akshay Wagh. Independent AI reviewers critiqued each version (see `ROUNDS.md`). The in-app explanations are written by open AI models from computed facts and checked by a code guard. Not medical advice.
