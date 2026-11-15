"use strict";

/*
 * Paras Baba — Advanced Kundali Matching (single Netlify function)
 *
 * Keeps the existing request contract:
 * POST /.netlify/functions/kundali-matching
 * {
 *   consent: true,
 *   personA: { date: "YYYY-MM-DD", time: "HH:MM", place: "City, Country" },
 *   personB: { date: "YYYY-MM-DD", time: "HH:MM", place: "City, Country" },
 *   language?: "en" | "hi"
 * }
 *
 * Existing response contract is preserved: success, provider, data (Ashtakoota),
 * meta, warnings. New material is additive under advanced.
 *
 * Provider operations below are the same operations already used by the
 * project's astrology function. Calls are bounded and concurrency-limited
 * to improve latency without launching an uncontrolled request burst.
 */

const BASE_URL = "https://api.astrologics.in/v1";
const ASHTAKOOT_URL = `${BASE_URL}/match/ashtakoot`;
const MAX_BODY_BYTES = 12000;
const REQUEST_TIMEOUT_MS = 2200;
const MAX_PROVIDER_CONCURRENCY = 1;
const MIN_PROVIDER_INTERVAL_MS = 500;
let lastProviderRequestAt = 0;
let activeProviderRequests = 0;
const providerQueue = [];
async function withProviderSlot(task) {
  if (activeProviderRequests >= MAX_PROVIDER_CONCURRENCY) {
    await new Promise(resolve => providerQueue.push(resolve));
  }
  activeProviderRequests += 1;
  try { return await task(); }
  finally {
    activeProviderRequests -= 1;
    const next = providerQueue.shift();
    if (next) next();
  }
}
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
];

const SIGN_LORDS = {
  aries: "mars", taurus: "venus", gemini: "mercury", cancer: "moon",
  leo: "sun", virgo: "mercury", libra: "venus", scorpio: "mars",
  sagittarius: "jupiter", capricorn: "saturn", aquarius: "saturn", pisces: "jupiter"
};

const NAKSHATRA_NAMES = [
  "ashwini", "bharani", "krittika", "rohini", "mrigashira", "ardra",
  "punarvasu", "pushya", "ashlesha", "magha", "purva_phalguni",
  "uttara_phalguni", "hasta", "chitra", "swati", "vishakha",
  "anuradha", "jyeshtha", "mula", "purva_ashadha", "uttara_ashadha",
  "shravana", "dhanishta", "shatabhisha", "purva_bhadrapada",
  "uttara_bhadrapada", "revati"
];

function respond(statusCode, data) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(data) };
}

function validCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function cleanPerson(person, label) {
  if (!person || typeof person !== "object" || Array.isArray(person)) {
    throw new Error(`${label} birth details are required.`);
  }
  const date = String(person.date || "").trim();
  const time = String(person.time || "").trim();
  const place = typeof person.place === "string"
    ? person.place.trim()
    : String(person.place?.query || "").trim();
  const name = String(person.name || "").trim().slice(0, 70);
  const gender = ["male", "female", "other", "prefer_not_to_say"].includes(person.gender)
    ? person.gender : "prefer_not_to_say";
  const role = person.role === "bride" ? "bride" : person.role === "groom" ? "groom" : null;

  if (!validCalendarDate(date)) throw new Error(`${label}: enter a valid birth date.`);
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
    throw new Error(`${label}: enter birth time in HH:MM format.`);
  }
  if (place.length < 2 || place.length > 120) {
    throw new Error(`${label}: enter a birth place (2–120 characters).`);
  }
  if (!role) throw new Error(`${label}: select whether this person is the groom or bride.`);

  return {
    date, time, name, gender, role,
    birth: { date, time, place: { query: place }, timezone: "auto" }
  };
}

function roleOrderedBirths(personA, personB) {
  if (personA.role === personB.role) {
    throw new Error("Select one Groom and one Bride so South Indian Porutham and Papasamyam can be calculated correctly.");
  }
  return personA.role === "groom"
    ? { groom: personA.birth, bride: personB.birth, groomPerson: personA, bridePerson: personB }
    : { groom: personB.birth, bride: personA.birth, groomPerson: personB, bridePerson: personA };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Retry only rate limits and transient server failures. This is deliberately
// bounded: it reduces bursts without holding a Netlify invocation forever.
async function providerPost(apiKey, path, body) {
  // One bounded attempt per provider call. Retrying inside a 30-second
  // serverless invocation makes the whole customer request slower and can
  // amplify rate limits. Missing calculations are reported as partial data.
  return withProviderSlot(async () => {
    const waitMs = Math.max(0, MIN_PROVIDER_INTERVAL_MS - (Date.now() - lastProviderRequestAt));
    if (waitMs) await sleep(waitMs);
    lastProviderRequestAt = Date.now();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); }
    catch { throw new Error("AstroLogics returned a non-JSON response."); }
    if (response.ok) return payload;
    const message = payload?.error?.message || payload?.message || "AstroLogics calculation failed.";
    const error = new Error(String(message).slice(0, 250));
    error.status = response.status;
    error.code = payload?.error?.code || payload?.code || null;
    error.candidates = payload?.candidates || payload?.error?.candidates;
    throw error;
  });
}

function unwrap(payload) {
  return payload?.data ?? payload;
}

function extractChart(payload) {
  const outer = unwrap(payload);
  const data = outer?.data ?? outer;
  return data?.data ?? data;
}

async function getPersonCalculations(apiKey, birth, language = "en") {
  const requestBody = {
    birth,
    options: { lang: language, ayanamsa: "lahiri", house_system: "whole_sign" }
  };

  // Every person's operations are sequential. The handler also processes
  // Person A and Person B sequentially, avoiding the previous 10-request burst.
  const result = {};
  // Matching needs D1, D9 and current Dasha. Full Vimshottari timelines and
  // Shadbala belong to the separate Phaladesh report; fetching them again here
  // duplicated work and amplified provider rate limits.
  const operations = [
    ["birthChart", "/kundli", requestBody],
    ["divisionalCharts", "/kundli/divisional", { ...requestBody, vargas: ["D9"] }],
    ["currentDasha", "/dasha/vimshottari/current", { ...requestBody, at: new Date().toISOString() }]
  ];

  await Promise.all(operations.map(async ([name, path, body]) => {
    try {
      const payload = await providerPost(apiKey, path, body);
      result[name] = {
        success: true,
        data: unwrap(payload),
        meta: payload?.meta || null,
        warnings: Array.isArray(payload?.warnings) ? payload.warnings.slice(0, 5) : []
      };
    } catch (error) {
      result[name] = {
        success: false,
        error: error.message || "This calculation could not be completed.",
        status: error.status || null
      };
    }
  }));
  return result;
}

function getBirthChart(calculations) {
  const item = calculations?.birthChart;
  if (!item?.success) return null;
  const raw = item.data;
  return raw?.data ?? raw;
}

function getDivisionalChart(calculations, chartName) {
  const item = calculations?.divisionalCharts;
  if (!item?.success) return null;
  const raw = item.data?.data ?? item.data;
  return raw?.charts?.[chartName] || raw?.charts?.[chartName.toLowerCase()] || raw?.[chartName] || raw?.[chartName.toLowerCase()] || null;
}

function getPlanet(chart, id) {
  const planets = chart?.planets;
  if (Array.isArray(planets)) return planets.find(p => String(p.id || p.name).toLowerCase() === id) || null;
  if (planets && typeof planets === "object") {
    const value = planets[id];
    if (typeof value === "string") return { id, sign: value };
    return value || null;
  }
  return null;
}

function getSignIndex(sign) {
  return SIGNS.indexOf(String(sign || "").toLowerCase());
}

function houseFromSigns(lagnaSign, planetSign) {
  const lagna = getSignIndex(lagnaSign);
  const sign = getSignIndex(planetSign);
  if (lagna < 0 || sign < 0) return null;
  return ((sign - lagna + 12) % 12) + 1;
}

function getHouse(chart, planetId, lagnaSign) {
  const planet = getPlanet(chart, planetId);
  if (!planet) return null;
  const supplied = Number(planet.house);
  if (Number.isInteger(supplied) && supplied >= 1 && supplied <= 12) return supplied;
  return houseFromSigns(lagnaSign, planet.sign);
}

function chartLagna(chart) {
  const value = chart?.lagna?.sign || chart?.lagna || null;
  if (value && typeof value === "object") return value.sign || value.name || value.rashi || null;
  return value;
}

function hasPlanetaryPlacements(chart) {
  const planets = chart?.planets;
  return Array.isArray(planets) ? planets.length > 0 : Boolean(planets && typeof planets === "object" && Object.keys(planets).length);
}

function seventhHouseSummary(chart, label) {
  const lagna = chartLagna(chart);
  const seventhHouseSign = getSignIndex(lagna) < 0 ? null : SIGNS[(getSignIndex(lagna) + 6) % 12];
  const seventhLord = seventhHouseSign ? SIGN_LORDS[seventhHouseSign] : null;
  const lordPlanet = seventhLord ? getPlanet(chart, seventhLord) : null;
  const lordHouse = seventhLord ? getHouse(chart, seventhLord, lagna) : null;
  const occupants = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"]
    .filter(id => getHouse(chart, id, lagna) === 7);
  return {
    chart: label,
    lagna,
    seventhHouseSign,
    seventhLord,
    seventhLordSign: lordPlanet?.sign || null,
    seventhLordHouse: lordHouse,
    seventhHouseOccupants: occupants,
    available: Boolean(lagna && seventhHouseSign)
  };
}

function manglikFromReference(chart, referenceSign) {
  const mars = getPlanet(chart, "mars");
  if (!mars) return { available: false, reference: referenceSign, house: null, consideredManglik: null };
  const house = houseFromSigns(referenceSign, mars.sign);
  if (!house) return { available: false, reference: referenceSign, house: null, consideredManglik: null };
  return {
    available: true,
    reference: referenceSign,
    house,
    consideredManglik: [1, 2, 4, 7, 8, 12].includes(house)
  };
}

function getD9LagnaFromD1(chart) {
  const signs = chart?.divisional_lagnas || chart?.divisionalLagnas || {};
  const value = signs.D9 || signs.d9 || null;
  if (value && typeof value === "object") return value.sign || value.name || value.rashi || null;
  return value;
}

function calculationReport(calculations, personLabel) {
  const expected = ["birthChart", "divisionalCharts", "currentDasha"];
  const successful = expected.filter(key => calculations?.[key]?.success).length;
  const errors = expected.filter(key => calculations?.[key] && !calculations[key].success).map(key => ({
    calculation: key,
    status: calculations[key].status || null,
    message: String(calculations[key].error || "Calculation unavailable.").slice(0, 220)
  }));
  return { person: personLabel, successful, expected: expected.length, percentage: Math.round(successful / expected.length * 100), errors };
}

function manglikAnalysis(calculations) {
  const d1 = getBirthChart(calculations);
  if (!d1) return { available: false, reason: "D1 birth chart was not returned." };
  const lagna = chartLagna(d1);
  const moon = getPlanet(d1, "moon")?.sign || null;
  const venus = getPlanet(d1, "venus")?.sign || null;
  const d1Checks = [
    manglikFromReference(d1, lagna),
    manglikFromReference(d1, moon),
    manglikFromReference(d1, venus)
  ].map((item, index) => ({ ...item, referenceName: ["Lagna", "Moon", "Venus"][index] }));
  const d9 = getDivisionalChart(calculations, "D9");
  const d9Lagna = chartLagna(d9) || getD9LagnaFromD1(d1);
  const d9HasPlanets = hasPlanetaryPlacements(d9);
  const d9Check = d9HasPlanets && d9Lagna ? manglikFromReference(d9, d9Lagna) : null;
  const flaggedReferences = d1Checks.filter(item => item.available && item.consideredManglik).map(item => item.referenceName);
  const overallManglik = flaggedReferences.length > 0;
  const lagnaOnlyManglik = Boolean(d1Checks[0]?.available && d1Checks[0]?.consideredManglik);
  const primary = d1Checks[0];
  const modifiers = [];
  const marsSign = getPlanet(d1, "mars")?.sign;
  if (["aries", "scorpio"].includes(marsSign)) modifiers.push("Mars is in its own sign in D1; some traditions treat this as a mitigating factor.");
  if (marsSign === "capricorn") modifiers.push("Mars is exalted in Capricorn in D1; some traditions treat this as a mitigating factor.");
  const jupiter = getPlanet(d1, "jupiter");
  if (jupiter?.sign && marsSign && jupiter.sign === marsSign) modifiers.push("Mars and Jupiter share a sign in D1; some traditions consider Jupiter's association mitigating.");

  return {
    available: true,
    rule: "Local D1 screening only: Mars in houses 1, 2, 4, 7, 8 or 12 counted separately from Lagna, Moon and Venus. The provider's Manglik-matching endpoint is shown separately and takes precedence for the couple-level Manglik verdict.",
    d1: d1Checks,
    overall: overallManglik ? "Manglik by the selected three-reference D1 screening" : "Not Manglik by the selected three-reference D1 screening",
    isManglik: overallManglik,
    lagnaOnlyManglik,
    flaggedReferences,
    d9: d9Check ? { ...d9Check, lagna: d9Lagna, planetaryPlacementsAvailable: true, note: "Supplementary D9 check; not substituted for the D1 assessment." } : { available: false, lagna: d9Lagna, lagnaAvailable: Boolean(d9Lagna), planetaryPlacementsAvailable: false, note: d9Lagna ? "D9 Lagna sign is available, but D9 planetary placements were not returned." : "D9 chart details were not returned." },
    preliminaryStatus: overallManglik
      ? `Mars is in a screened house from ${flaggedReferences.join(", ")}; classified as Manglik under this selected rule.`
      : "Mars is not in a commonly screened Manglik house from Lagna, Moon or Venus.",
    modifiers,
    cancellationConclusion: "No universal cancellation has been asserted. Cancellation rules vary by regional and textual tradition; the listed modifiers are evidence for review, not an automatic cancellation."
  };
}

function marriageChartAnalysis(calculations) {
  const d1 = getBirthChart(calculations);
  const d9 = getDivisionalChart(calculations, "D9");
  if (!d1) return { available: false, reason: "D1 chart unavailable." };

  const d1Summary = seventhHouseSummary(d1, "D1");
  const d9Lagna = chartLagna(d9) || getD9LagnaFromD1(d1);
  const d9Summary = d9 && hasPlanetaryPlacements(d9)
    ? { ...seventhHouseSummary(d9, "D9"), lagnaAvailable: Boolean(d9Lagna), planetaryPlacementsAvailable: true }
    : { available: false, chart: "D9", lagna: d9Lagna, lagnaAvailable: Boolean(d9Lagna), planetaryPlacementsAvailable: false, note: d9Lagna ? "D9 Lagna sign is available, but D9 planetary placements could not be retrieved." : "D9 Lagna and planetary placements are unavailable." };
  const venus = getPlanet(d1, "venus");
  const jupiter = getPlanet(d1, "jupiter");
  const mars = getPlanet(d1, "mars");
  const shadbala = calculations?.planetaryStrength?.data?.planets || [];
  const strengthFor = id => shadbala.find(p => String(p.id).toLowerCase() === id) || null;

  return {
    available: true,
    d1: {
      lagna: chartLagna(d1),
      seventhHouse: d1Summary,
      venus: venus ? { sign: venus.sign || null, house: getHouse(d1, "venus", chartLagna(d1)) } : null,
      jupiter: jupiter ? { sign: jupiter.sign || null, house: getHouse(d1, "jupiter", chartLagna(d1)) } : null,
      mars: mars ? { sign: mars.sign || null, house: getHouse(d1, "mars", chartLagna(d1)) } : null
    },
    d9: d9Summary,
    planetaryStrength: {
      venus: strengthFor("venus"),
      jupiter: strengthFor("jupiter"),
      mars: strengthFor("mars")
    }
  };
}

function compareDasha(calculationsA, calculationsB) {
  const a = calculationsA?.currentDasha?.data?.data ?? calculationsA?.currentDasha?.data;
  const b = calculationsB?.currentDasha?.data?.data ?? calculationsB?.currentDasha?.data;
  if (!a || !b) return { available: false, reason: "Current Dasha data was not available for both profiles." };
  const fields = ["mahadasha", "antardasha", "pratyantardasha"];
  const result = {};
  for (const field of fields) {
    const planetA = a[field]?.planet || null;
    const planetB = b[field]?.planet || null;
    result[field] = {
      personA: planetA,
      personB: planetB,
      samePeriodLord: Boolean(planetA && planetB && planetA === planetB)
    };
  }
  return {
    available: true,
    personAAt: a.at || null,
    personBAt: b.at || null,
    periods: result,
    note: "Dasha comparison is descriptive timing context, not a compatibility score or a prediction of marriage outcomes."
  };
}

function nakshatraNumber(person) {
  const value = String(person?.nakshatra || "").toLowerCase().replace(/[ -]/g, "_");
  const index = NAKSHATRA_NAMES.indexOf(value);
  return index >= 0 ? index + 1 : null;
}

function southIndianReadiness(ashtakootaData) {
  const a = ashtakootaData?.person_a;
  const b = ashtakootaData?.person_b;
  const aNo = nakshatraNumber(a);
  const bNo = nakshatraNumber(b);
  return {
    available: false,
    status: "requires_ruleset",
    personA: { nakshatra: a?.nakshatra || null, nakshatraNumber: aNo, rashi: a?.rashi || null },
    personB: { nakshatra: b?.nakshatra || null, nakshatraNumber: bNo, rashi: b?.rashi || null },
    reason: "Nakshatra and Rashi inputs are present, but South Indian Porutham conventions differ by region. A named, versioned 10-Porutham ruleset must be selected before producing pass/fail results. No unsupported score is fabricated."
  };
}

function validateAshtakoota(data) {
  const total = Number(data?.total);
  const max = Number(data?.max);
  if (!Number.isFinite(total) || !Number.isFinite(max) || max <= 0 || total < 0 || total > max || !Array.isArray(data?.kootas)) return false;
  return true;
}

function buildFinalReview(ashtakoota, advanced) {
  const components = [];
  const add = (id, label, score, max, note) => {
    if (Number.isFinite(score) && Number.isFinite(max) && max > 0 && score >= 0 && score <= max) {
      components.push({ id, label, earned: score, available: max, note });
    }
  };

  // The combined index deliberately uses only four explicit, provider-backed
  // matching measures. D1/D9 and Dasha remain qualitative review factors.
  add("ashtakoota", "Ashtakoota", Number(ashtakoota?.total) / Number(ashtakoota?.max) * 40, 40,
    "Provider's 36-point Guna Milan scaled to a 40-point contribution.");
  const dash = advanced?.southIndianPorutham?.data;
  if (advanced?.southIndianPorutham?.success && Number.isFinite(Number(dash?.score)) && Number(dash?.max) > 0) {
    add("dashakoot", "Tamil 10-Porutham", Number(dash.score) / Number(dash.max) * 25, 25,
      "Provider's ten-Porutham result scaled to 25 points; Rajju is also shown as an essential check.");
  }
  const papa = advanced?.papasamyam?.data;
  if (advanced?.papasamyam?.success && papa && Number.isFinite(Number(papa.groom?.total)) && Number.isFinite(Number(papa.bride?.total))) {
    const papasamyamPoints = papa.result === "satisfactory" ? 20 : papa.result === "not_satisfactory" ? 0 : null;
    add("papasamyam", "Papasamyam balance", papasamyamPoints, 20,
      "Uses the provider's count-method satisfactory/not-satisfactory verdict; this is a traditional comparison, not a probability.");
  }
  const manglik = advanced?.manglikCompatibility?.data;
  if (advanced?.manglikCompatibility?.success && typeof manglik?.both_manglik === "boolean") {
    const a = manglik.person_a?.manglik;
    const b = manglik.person_b?.manglik;
    const bothKnown = typeof a === "boolean" && typeof b === "boolean";
    const points = !bothKnown ? null : (a === b ? 15 : 5);
    add("manglik", "Manglik compatibility", points, 15,
      "Mutual Manglik status receives full points when statuses match; a mismatch receives partial points and requires traditional review.");
  }

  const availableWeight = components.reduce((sum, item) => sum + item.available, 0);
  const earnedWeight = components.reduce((sum, item) => sum + item.earned, 0);
  const score = availableWeight > 0 ? Math.round(earnedWeight / availableWeight * 100) : null;
  const complete = availableWeight === 100;
  const missing = [
    ...(!advanced?.southIndianPorutham?.success ? ["Tamil 10-Porutham"] : []),
    ...(!advanced?.papasamyam?.success ? ["Papasamyam"] : []),
    ...(!advanced?.manglikCompatibility?.success ? ["Provider Manglik compatibility"] : [])
  ];
  const dashData = advanced?.southIndianPorutham?.data;
  const strengths = [];
  const cautions = [];
  const kootas = Array.isArray(ashtakoota?.kootas) ? ashtakoota.kootas : [];
  kootas.forEach(k => {
    const ratio = Number(k.max) > 0 ? Number(k.score) / Number(k.max) : null;
    if (ratio !== null && ratio >= 0.8) strengths.push(k.label || k.name);
    if (ratio !== null && ratio < 0.4) cautions.push(k.label || k.name);
  });
  if (dashData?.poruthams) {
    dashData.poruthams.filter(x => x.result === "agrees").forEach(x => strengths.push(`Tamil 10-Porutham: ${x.label}`));
    dashData.poruthams.filter(x => x.result === "does_not_agree").forEach(x => cautions.push(`Tamil 10-Porutham: ${x.label}`));
  }
  if (dashData && dashData.rajju_agrees === false) cautions.push("Tamil 10-Porutham: Rajju");
  const manglikA = manglik?.person_a?.manglik;
  const manglikB = manglik?.person_b?.manglik;
  const manglikPair = typeof manglikA === "boolean" && typeof manglikB === "boolean"
    ? (manglikA === manglikB ? "The provider reports matching Manglik status for both profiles." : "The provider reports different Manglik status; this needs a tradition-specific review.")
    : "Provider Manglik compatibility was not available.";
  return {
    label: complete ? "Combined traditional compatibility index" : "Provisional combined compatibility index",
    score,
    outOf: 100,
    complete,
    availableWeight,
    missingComponents: missing,
    components,
    formula: "Ashtakoota 40% + Tamil 10-Porutham 25% + Papasamyam balance 20% + Manglik compatibility 15%. Available components are proportionally normalized when a provider calculation is missing; the report is marked provisional.",
    gunaScore: { total: Number(ashtakoota?.total), max: Number(ashtakoota?.max), conclusion: ashtakoota?.conclusion || null },
    strengths: [...new Set(strengths)].slice(0, 10),
    areasForReview: [...new Set(cautions)].slice(0, 10),
    manglikComparison: manglikPair,
    manglikMethodNote: "The provider couple-level Manglik verdict and the local D1 Lagna/Moon/Venus screening are separate methods. If they differ, show both with their source labels; do not silently override one with the other or call the difference an error.",
    yoniMethodNote: "Ashtakoota Yoni and Tamil 10-Porutham Yoni are separate traditional measures. A low Ashtakoota Yoni score can coexist with an agreeing Tamil Yoni Porutham result.",
    chartCompleteness: { weightedMeasuresComplete: complete, d1D9AndDashaAreSeparate: true, note: "Weighted-score completeness means all four score components returned; it does not mean every chart calculation, especially D9 planetary placements, succeeded." },
    qualitativeFactors: {
      d1D9: "D1 and D9 marriage indicators are discussed qualitatively; they are not assigned invented numerical points.",
      dasha: "Vimshottari Dasha comparison is interpretive timing context, not a validated compatibility score."
    },
    overallAssessment: score === null
      ? "A combined compatibility index could not be calculated because the core Ashtakoota result was unavailable."
      : complete
        ? "All four weighted matching measures were returned. Read the score together with the individual findings, essential Porutham checks, D1/D9 indicators and practical relationship considerations."
        : `A provisional combined index is shown using the ${components.length} available weighted measures. Missing calculations are excluded rather than treated as favourable; obtain the missing provider results for a complete review.`,
    confidence: complete ? "All four weighted matching measures were returned; chart coverage and qualitative limitations are shown separately." : `Incomplete: ${missing.join(", ")} unavailable. The score is normalized over the available measures and is not a probability of marital success.`
  };
}

exports.handler = async event => {
  if (event.httpMethod !== "POST") return respond(405, { error: "POST method required." });
  const apiKey = process.env.ASTROLOGICS_API_KEY;
  if (!apiKey) return respond(500, { error: "AstroLogics API key is not configured on the server." });

  const rawBody = event.body || "";
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return respond(413, { error: "Matching request is too large." });

  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON request." });
  }

  if (body.consent !== true) {
    return respond(400, { error: "Consent is required before sending both birth profiles to AstroLogics." });
  }

  let personA;
  let personB;
  let rolePair;
  try {
    personA = cleanPerson(body.personA, "Person A");
    personB = cleanPerson(body.personB, "Person B");
    if (personA.role === personB.role) throw new Error("Choose one Groom and one Bride. You can swap the roles at any time.");
    rolePair = roleOrderedBirths(personA, personB);
  } catch (error) {
    return respond(400, { error: error.message });
  }

  const language = body.language === "hi" ? "hi" : "en";
  try {
    // Serialize and pace provider calls. Only D1, D9 and current Dasha are
    // fetched for each person; full Phaladesh timelines/strengths are not duplicated.
    const ashtakootPromise = providerPost(apiKey, "/match/ashtakoot", {
      person_a: personA.birth, person_b: personB.birth
    });
    const secondaryResults = {};
    const secondaryCalls = [
      ["dashakoot", "/match/dashakoot", {
        person_a: rolePair.groom, person_b: rolePair.bride,
        minimum_agreeing: 5,
        options: { ayanamsa: "lahiri", house_system: "whole_sign", lang: language }
      }],
      ["papasamyam", "/match/papasamyam", {
        person_a: rolePair.groom, person_b: rolePair.bride,
        method: "count", include_ketu: false,
        options: { ayanamsa: "lahiri", house_system: "whole_sign", lang: language }
      }],
      ["manglikCompatibility", "/match/manglik", {
        person_a: rolePair.groom, person_b: rolePair.bride,
        options: { ayanamsa: "lahiri", house_system: "whole_sign", lang: language }
      }]
    ];
    const secondaryPromise = Promise.all(secondaryCalls.map(async ([key, path, request]) => {
      try {
        const result = await providerPost(apiKey, path, request);
        secondaryResults[key] = { success: true, data: unwrap(result), meta: result?.meta || null, warnings: result?.warnings || [] };
      } catch (error) {
        secondaryResults[key] = { success: false, error: error.message || "Provider calculation unavailable.", status: error.status || null };
      }
    }));
    const [ashtakootPayload] = await Promise.all([ashtakootPromise, secondaryPromise]);

    const [calculationsA, calculationsB] = await Promise.all([
      getPersonCalculations(apiKey, personA.birth, language),
      getPersonCalculations(apiKey, personB.birth, language)
    ]);

    const ashtakoota = unwrap(ashtakootPayload);
    if (!validateAshtakoota(ashtakoota)) {
      return respond(502, { error: "AstroLogics returned an incomplete Ashtakoot result. No compatibility score was displayed." });
    }

    const chartA = getBirthChart(calculationsA);
    const chartB = getBirthChart(calculationsB);
    const advanced = {
      version: "1.1.0",
      language,
      tradition: {
        northIndian: "Ashtakoota (provider-calculated; maximum 36 points)",
        southIndian: "AstroLogics conventional Tamil 10-Porutham; regional almanacs differ",
        ayanamsa: "lahiri",
        houseSystem: "whole_sign"
      },
      personA: {
        name: personA.name || "Person A", gender: personA.gender, role: personA.role,
        available: Boolean(chartA),
        calculations: calculationsA,
        manglik: manglikAnalysis(calculationsA),
        marriageChart: marriageChartAnalysis(calculationsA)
      },
      personB: {
        name: personB.name || "Person B", gender: personB.gender, role: personB.role,
        available: Boolean(chartB),
        calculations: calculationsB,
        manglik: manglikAnalysis(calculationsB),
        marriageChart: marriageChartAnalysis(calculationsB)
      },
      dashaComparison: compareDasha(calculationsA, calculationsB),
      roleAssignment: {
        personA: { name: personA.name || "Person A", gender: personA.gender, role: personA.role },
        personB: { name: personB.name || "Person B", gender: personB.gender, role: personB.role },
        groom: { name: rolePair.groomPerson.name || (rolePair.groomPerson === personA ? "Person A" : "Person B"), person: rolePair.groomPerson === personA ? "personA" : "personB" },
        bride: { name: rolePair.bridePerson.name || (rolePair.bridePerson === personA ? "Person A" : "Person B"), person: rolePair.bridePerson === personA ? "personA" : "personB" }
      },
      southIndianPorutham: secondaryResults.dashakoot,
      papasamyam: secondaryResults.papasamyam,
      manglikCompatibility: secondaryResults.manglikCompatibility,
      providerManglikByPerson: (() => {
        const result = secondaryResults.manglikCompatibility?.data || {};
        const groomResult = result.person_a || null;
        const brideResult = result.person_b || null;
        return {
          personA: personA.role === "groom" ? groomResult : brideResult,
          personB: personB.role === "groom" ? groomResult : brideResult
        };
      })(),
      calculationCoverage: {
        personA: Object.values(calculationsA).filter(x => x?.success).length,
        personB: Object.values(calculationsB).filter(x => x?.success).length,
        expectedPerPerson: 3,
        details: [calculationReport(calculationsA, "Person A"), calculationReport(calculationsB, "Person B")]
      },
      matchingMeasureCoverage: Object.fromEntries(
        Object.entries(secondaryResults).map(([key, value]) => [key, { success: Boolean(value.success), status: value.status || null, error: value.error || null }])
      ),
      limitations: [
        "Manglik screening uses the stated common 1/2/4/7/8/12-house convention; regional variations may differ.",
        "Manglik modifiers are not treated as automatic dosha cancellation.",
        "D9 is requested explicitly with vargas:[D9]; D9 houses are derived only when the provider returns D9 planetary signs and D9 Lagna.",
        "The combined index uses the four explicitly weighted provider-backed measures; D1/D9 and Dasha remain qualitative.",
        "Astrological interpretations are traditional and should not replace consent, communication, or practical relationship decisions."
      ]
    };

    advanced.finalReview = buildFinalReview(ashtakoota, advanced);
    const warnings = [
      ...(Array.isArray(ashtakootPayload?.warnings) ? ashtakootPayload.warnings.slice(0, 5) : []),
      ...(!chartA ? ["Person A's D1 chart was unavailable; some advanced checks are incomplete."] : []),
      ...(!chartB ? ["Person B's D1 chart was unavailable; some advanced checks are incomplete."] : []),
      ...(!getDivisionalChart(calculationsA, "D9") ? ["Person A's D9 chart was unavailable."] : []),
      ...(!getDivisionalChart(calculationsB, "D9") ? ["Person B's D9 chart was unavailable."] : [])
    ].slice(0, 12);

    return respond(200, {
      success: true,
      provider: "astrologics",
      data: ashtakoota, // Preserved for the current frontend.
      people: { personA: { name: personA.name, gender: personA.gender, role: personA.role }, personB: { name: personB.name, gender: personB.gender, role: personB.role } },
      advanced,
      meta: ashtakootPayload?.meta || null,
      providerErrors: [
        ...calculationReport(calculationsA, "Person A").errors,
        ...calculationReport(calculationsB, "Person B").errors,
        ...Object.entries(secondaryResults).filter(([, value]) => !value.success).map(([calculation, value]) => ({
          calculation, status: value.status || null, message: String(value.error || "Calculation unavailable.").slice(0, 220)
        }))
      ],
      warnings
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    const status = timeout ? 504 : (error.status >= 400 && error.status < 500 ? error.status : 502);
    const candidates = error?.candidates;
    return respond(status, {
      error: timeout
        ? "Kundali matching timed out while requesting chart calculations. Please try again."
        : String(error.message || "Unable to complete Kundali matching.").slice(0, 300),
      code: error.code || null,
      candidates: Array.isArray(candidates) ? candidates.slice(0, 8) : undefined
    });
  }
};
