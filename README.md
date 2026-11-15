# Pandit AI — connected website

## Pages
- `index.html` — homepage
- `Astrology.html` — Vedic / Western path selector
- `vedic_astrology.html` — Vedic horoscope, Janam Kundli, Phaladesh and matching
- `western_astrology.html` — Western horoscope and personal chart report

## Deployment
Deploy this folder as the Netlify site root. The `netlify.toml` file publishes the root and deploys functions from `netlify/functions`.

Set these environment variables in Netlify Site configuration:
- `ASTROLOGICS_API_KEY`
- `GROQ_API_KEY`

Do not put real API keys in frontend files or commit them to Git.

## Notes
The shared `index.js` handles the common Pandit AI navigation on all pages. The Vedic and Western page scripts are loaded only on their respective pages. Existing report and matching logic is preserved.
