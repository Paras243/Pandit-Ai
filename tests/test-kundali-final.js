"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("./netlify/functions/kundali-matching"), "utf8");
assert.match(source, /vargas:\s*\["D9"\]/, "D9 request must explicitly select D9 varga");

const calls = [];
const json = value => ({ ok: true, status: 200, text: async () => JSON.stringify(value) });
const chart = lagna => ({ lagna: { sign: lagna }, planets: {
  sun: { sign: "aries" }, moon: { sign: "taurus" }, mars: { sign: "gemini" },
  mercury: { sign: "cancer" }, jupiter: { sign: "leo" }, venus: { sign: "virgo" },
  saturn: { sign: "libra" }, rahu: { sign: "scorpio" }, ketu: { sign: "taurus" }
}});

global.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  const body = JSON.parse(options.body || "{}");
  calls.push({ path, body });
  if (path.endsWith("/match/ashtakoot")) return json({ data: { total: 22.5, max: 36, conclusion: "Acceptable match", kootas: [] } });
  if (path.endsWith("/match/dashakoot")) return json({ data: { score: 6, max: 10, poruthams: [], rajju_agrees: true } });
  if (path.endsWith("/match/papasamyam")) return json({ data: { groom: { total: 4 }, bride: { total: 9 }, result: "not_satisfactory" } });
  if (path.endsWith("/match/manglik")) return json({ data: { both_manglik: false, person_a: { manglik: false }, person_b: { manglik: true } } });
  if (path.endsWith("/kundli/divisional")) {
    assert.deepEqual(body.vargas, ["D9"]);
    const sign = body.birth.place.query.includes("Groom") ? "capricorn" : "cancer";
    return json({ data: { charts: { D9: { lagna: sign, planets: { mars: "scorpio", moon: "taurus", venus: "libra" } } } } });
  }
  if (path.endsWith("/kundli")) {
    const lagna = body.birth.place.query.includes("Groom") ? "virgo" : "pisces";
    return json({ data: chart(lagna) });
  }
  if (path.endsWith("/dasha/vimshottari/current")) return json({ data: { at: "2026-11-14", mahadasha: { planet: "saturn" }, antardasha: { planet: "mercury" } } });
  if (path.endsWith("/dasha/vimshottari")) return json({ data: { periods: [] } });
  if (path.endsWith("/kundli/shadbala")) return json({ data: { planets: [] } });
  throw new Error(`Unexpected mocked endpoint: ${path}`);
};

process.env.ASTROLOGICS_API_KEY = "test-key";
const handler = require("./netlify/functions/kundali-matching").handler;
(async () => {
  const result = await handler({ httpMethod: "POST", body: JSON.stringify({
    consent: true, language: "en",
    personA: { name: "Test Groom", gender: "male", role: "groom", date: "2000-01-01", time: "10:00", place: "Groom City" },
    personB: { name: "Test Bride", gender: "female", role: "bride", date: "2001-02-02", time: "11:00", place: "Bride City" }
  }) });
  assert.equal(result.statusCode, 200);
  const payload = JSON.parse(result.body);
  assert.equal(payload.success, true);
  assert.equal(payload.advanced.personA.marriageChart.d9.planetaryPlacementsAvailable, true);
  assert.equal(payload.advanced.personB.marriageChart.d9.planetaryPlacementsAvailable, true);
  assert.equal(payload.advanced.finalReview.score, 45);
  assert.equal(payload.advanced.finalReview.complete, true);
  assert.equal(calls.filter(call => call.path.endsWith("/kundli/divisional")).length, 2);
  console.log("PASS: D9 varga request, both-person D9 extraction, combined score, and complete weighted coverage.");
})().catch(error => { console.error(error); process.exitCode = 1; });
