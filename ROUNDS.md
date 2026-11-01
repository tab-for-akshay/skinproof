# SkinProof — critique rounds

Built by Tab, an AI assistant, for team lead Akshay Wagh.

Each round: the live site plus a written description went to independent reviewers acting as strict judges. Full reviews are kept in `rounds/`.

## Round 1 — v1 reviewed (1 Nov 2026, ~20:10–20:20 UTC)
Reviewers:
- **Fo** (wajo.ai agent; opened the live site and ran the judge path). Scores: Implementation 7 · Design 6 · Impact 6 · Idea 7.
- **Gemini 3.5 Flash-Lite** (text + 4 screenshots). The first choice, Groq gpt-oss-120b, answered "Rate limit reached … tokens per day (TPD): Limit 200000", so Gemini took the second-critic seat.
- **Arden** (Skydive agent; opened the site, probed the API, read app.js and kb.json, tried the repo link).
- Supplementary: Nemotron 3.5 Super VL looked at the screenshots for visual problems.

Top 3 changes taken into v2:
1. **The eCommerce half.** All three said there was no store. v2 adds a "Shop what fits" catalogue of real products with their real INCI lists, each ranked against your scan and linking to where to buy it.
2. **Show the system saying no, and show the maths.** v2 adds a second demo trial that ends "Pause: redness is up", control (untargeted) concerns in every trial, the fit-score arithmetic, knowledge-base coverage ("x of y ingredients recognised"), and INCI position used as a rough concentration proxy. The noise band is now measured on three faces, not one.
3. **Never show plumbing; make the loop close.** v2 removes model names and error codes from the UI and falls back calmly; "Start a trial" adds a calendar reminder (.ics); there is a public repo; chart labels, a checkbox and a grammar slip are fixed; the ingredient parser copes with pasted shop text.

## Round 2: v2 reviewed (1 Nov 2026, ~20:31–20:35 UTC)
Reviewers:
- **Fo** opened the live site and ran the whole flow again. Scores: Implementation 8 · Design 7 · Impact 6 · Idea 9. In Fo's words: "The best idea I've seen in this brief."
- **Gemini 3.5 Flash-Lite** (text plus v2 screenshots). Scores: 9 · 8 · 9 · 9.
- **Arden** (Skydive) read the live site and the repo. Scores: 9 · 7 · 6 · 8. Arden's words: "the trials engine actually says 'stop'", but "no video, no AR try-on … and all demo evidence is synthetic".

Top 3 changes taken into v3:
1. **VTO and real commerce.** v3 adds a **YouCam Makeup VTO** try-on: on tinted products, and as "cover it today" after a breakout. It adds direct **brand-site links** for 22 of the 25 products, next to a price-comparison link. There is also a **retailer widget** (one script tag) shown on a mock store product page.
2. **The demo explains itself.** The shop is pre-ranked for a sample face, so there is no empty "scan first" wall. A callout shows the "best all-rounder vs strongest for each of your concerns", and each check opens with "#k of 25 for you". The scan card has YouCam mask thumbnails, and each trial shows the YouCam mask at the first and latest check-in. There is a 90-second guided tour button for judges.
3. **Honest wording and the breakout moment.** Redness is now worded "score dropped … lower = redder skin". The simulated demo trial is labelled "not an expected result". Eye-area concerns are kept out of skincare priorities. A breakout scan opens an "after a breakout" panel (do / pause / gentle picks / cover it today). Trials add patch-test reminders and a printable summary for a dermatologist.

## Round 3: v3 final check (1 Nov 2026, ~20:45–20:49 UTC)
- **Fo** ran the guided tour end to end, the breakout VTO, a tinted-product try-on, the Differin check, the trials and the retailer widget. "Everything I clicked worked … all API calls returned 200 and every image loaded." Scores: Implementation 8 · Design 7.5 · Impact 8.5 · Idea 8.5.
- Fixes taken into v3.1 (all done): the demo video is recorded and linked; two caption slips fixed (lower-case "a" after a full stop; the breakout-check wording); the duplicated caution line is merged ("Salicylic acid (BHA) — redness, moisture"), in the shop and in the retailer widget; brand-site links now cover 24 of 25 products (La Roche-Posay Effaclar BB has no current product page on the brand's sites, so it keeps the price-comparison link only).
- v3.1 is hosted on Vercel (https://skinproof-ai.vercel.app/) with the sites.tab.bot mirror, and was re-tested at phone size (390 px): guided tour, VTO try-on, product check, Skin Simulation and the retailer widget all returned 200, with no console errors and no sideways scrolling.

Not done, on purpose: a trial on a real person's face. The demo deliberately uses no real person's face; a consented real-user pilot is the first roadmap item.
