



SkinProof: judge review, v1 · Wajo




Skip to content
Judge review
Prepared with Fo
Made for Tab
Updated 1 Nov 2026
SkinProof · YouCam Skin AI & eCommerce Hackathon · v1
SkinProof: judge review, v1
A strict judge's read of the v1 entry: live site walked end to end, eight fixes ranked by score impact, four criteria scored.
AI-generated illustration
I opened the site and ran the judge path: Priya's scan, the BHA + niacinamide product check, the Skin Simulation target, and the demo trial. What follows is the v1 review as it stands.
The short version: 
there is a real product here, and the noise-band trial logic is the best idea in the entry, but the demo hides its best moves and shows its worst one.
 My first product check ended with your own model erroring on screen. My second look for the repository found a promise, not a link. Both are fixable in a day and both cost points today.
SCORES
Implementation 7 · Design 6 · Impact 6 · Idea 7
Roughly a 6.5 overall as it stands. Every point below is something you can ship before the deadline; the first four are the ones that move the needle.
01
Top 8 fixes, by score impact
1. Publish the repository before a judge asks for it
The footer says "Source (MIT)" but the entry says the repo "will be public." Until it is, "genuine non-trivial code" is a claim I cannot check, and judges score what they can see. Push it, flip it public, and link it in the Devpost body and the footer today. This is the cheapest ten minutes in the whole list and it guards the heaviest-weighted criterion.
Technological Implementation
2. Never show a judge a 429
My first product check ended with: "Explanation written by: gpt-oss-20b (Groq) · gpt-oss-120b (Groq): no answer (429)." Your fallback chain works, so the failure is survivable, but the error text is the visible record of it, and model names plus status codes are your plumbing, not the user's business. Retry the chain server-side; if every model fails, show the grounded facts table anyway under a calm line like "AI explanation unavailable, here are the matched facts." The facts survive, the error does not.
Design
3. Close the loop at the point of purchase
The theme moment is "right before a purchase," but the product check is a paste-a-textbox with no store in sight, and the entry title says eCommerce. Add 10 to 20 real products with real INCI lists, brand, and price, each with a "Where to buy" link, so a check ends in a buy, avoid, or compare decision. That single change turns a measurement tool into the retail product the hackathon name promises, and it feeds criteria 1, 3, and 4 at once.
Impact · retail value
4. Show the system saying no
The demo trial is all good news: four of five concerns improve and the verdict is "Working — keep it." The most persuasive thing SkinProof owns is its discrimination logic, the noise band, the two-check-in rule, and the "Pause: redness up" verdict, and I never saw any of it fire. Add a second demo trial, the fragranced night cream, that ends "Not working" or "Pause: redness up," plus a mid-trial "Too early" state. A judge cannot credit logic they never watch decide against the product.
Impact · demo shows it
5. Make "Start a trial" start a trial
For a new user the button is a dead end: nothing appears in the Trials section. Start a real trial with the checked product's targeted concerns, persist it, and give the check-in a schedule, even just an .ics download. While you are there: the demo serum check targets Moisture, Oiliness, and Acne, yet the demo trial tracks Acne, Redness, Oiliness, Pores, and Texture; a judge will notice the trial is not the product's own. And fix "Start a 8-week trial" to "an 8-week trial."
Design
6. Show the arithmetic behind the 70
"70 · Good match" arrives with no visible rubric, so it reads as a vibe. Show the breakdown: each priority's contribution with its evidence dots, the caution penalty, and what would have pushed it to a poor match. Add an explicit "3 of 10 ingredients not in the knowledge base" count so coverage gaps are visible instead of silent. A defensible number is worth more than a confident one.
Implementation
7. Use INCI position as a concentration proxy
You already parse ingredient order; use it. Salicylic acid at #4 is roughly one percent; niacinamide claims cap near five; a fragrance in the top five is a different caution than one at the bottom. One table change and the fit score becomes defensible to a judge who knows skincare, which is exactly the judge this hackathon attracts.
Implementation · idea depth
8. Put one real capture in the demo
Synthetic faces are honest and well labeled, and the disclosure is a credit to you, but "the demo shows it solved" wants at least one real path: one team selfie through the Camera Kit guided capture with consent, or a 30-second recorded run embedded on the page. Also surface the Breakout check mode in the demo flow; a judge on a desktop without a webcam will never find it, and it is one of your three theme moments.
Impact
02
The scores
Scored as it stands, v1
Criterion
Score
What decided it
Technological Implementation
7
Five YouCam APIs integrated server-side, a unit-budget guard, a measured noise calibration, a sourced knowledge base with links that resolve, and an anti-hallucination guard on the LLM. Held back by an unverifiable repo and an error shown to the user.
Design
6
Coherent single-flow product with clear copy and honest labeling, but the demo's first impression includes a 429, the trial loop dead-ends, and a grammar slip sits on a primary button.
Potential Impact
6
The problem and the moment are real and well chosen, but the demo is fully synthetic end to end and the purchase moment, the one the theme names first, has no store attached.
Quality of Idea
7
Calling a change real only above measured noise, held over two check-ins, is genuinely non-obvious and grounded, and Simulation-as-target is a clever fit. Held back because the VTO and eCommerce half of the hackathon's title is absent and the discriminating cases are never shown.
03
What is already working
Do not sand these down while fixing the rest. The noise table in "How it works" is the single most credible artifact in the entry; you measured your own error bars instead of assuming them, and it should be promoted into the hero pitch, not left in the footer. The server-side-only API posture with a live unit counter is both correct and visible. The actives list cites AAD, DermNet, and PubMed with working links, which is more than most entries will do. And the theme coverage is real: before purchase, after breakout, and the mirror moment each get a feature. The skeleton is sound. Ship the eight fixes and this climbs from a 6.5 into contention.
Sources
SkinProof live site, reviewed 2026-11-01
Prepared with Fo · Wajo
Made for Tab

