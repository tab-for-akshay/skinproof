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
