/**
 * Paras Baba — Predictive Jyotish Intelligence Engine v2.5.6
 * ----------------------------------------------------
 * Deterministic evidence extraction and transparent traditional-indication
 * scoring for AstroLogics reports.
 *
 * IMPORTANT:
 * - No planetary positions, divisional placements, yogas or dates are calculated.
 * - Periods are emitted only when an explicit Dasha start and end date are found.
 * - Scores are traditional-indication indices, NOT real-world probabilities.
 * - A score is withheld unless multiple independent structured signals exist.
 * - Unknown AstroLogics payload shapes are reported as unavailable, not guessed.
 *
 * CommonJS / Netlify:
 *   const { buildAIContext } = require("./vedic-prediction-engine");
 */

"use strict";

const ENGINE_NAME = "paras-baba-predictive-jyotish-engine";
const ENGINE_VERSION = "3.0.0";

const LIMITS = Object.freeze({
  maxDepth: 8,
  maxNodes: 2400,
  maxEvidence: 48,
  maxPerSource: 14,
  maxText: 240,
  maxDashaPeriods: 54
});

const PLANETS = new Set([
  "sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn",
  "rahu", "ketu", "uranus", "neptune", "pluto"
]);

const ZODIAC_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
];

// The Vedic frontend's Phaladesh request explicitly selects whole_sign.
// Divisional-house numbers derived below are labelled as derived, never provider-returned.
const DIVISIONAL_HOUSE_SYSTEM = "whole_sign";

const CHARTS = Object.freeze({
  D1: { label: "Rashi / Birth chart", aliases: ["d1", "rashi", "birthchart", "janmakundli"] },
  D2: { label: "Hora", aliases: ["d2", "hora", "horachart"] },
  D9: { label: "Navamsa", aliases: ["d9", "navamsa", "navamsha", "navamsachart"] },
  D10: { label: "Dashamsha", aliases: ["d10", "dashamsha", "dashamsa", "dasamsa", "dasamsha"] },
  D4: { label: "Chaturthamsha", aliases: ["d4", "chaturthamsha", "chaturthamsa", "turiyamsha"] },
  D24: { label: "Chaturvimshamsha", aliases: ["d24", "chaturvimshamsha", "siddhamsha", "siddhamsa"] }
});

const SOURCE_GROUPS = Object.freeze({
  chart: { label: "Birth chart", aliases: ["birthchart", "kundli", "natalchart"] },
  divisional: { label: "Divisional charts", aliases: ["divisionalcharts", "divisional"] },
  dasha: { label: "Vimshottari Dasha", aliases: ["vimshottaridasha", "dasha"] },
  currentDasha: { label: "Current Dasha", aliases: ["currentdasha"] },
  yogas: { label: "Yogas", aliases: ["yogas", "yoga"] },
  wealth: { label: "Wealth analysis", aliases: ["wealthanalysis", "wealth"] },
  strength: { label: "Planetary strength", aliases: ["planetarystrength", "shadbala"] }
});

const TOPICS = Object.freeze({
  career: {
    label: "Career & Profession",
    aliases: ["career", "profession", "job", "employment", "occupation", "business", "work"],
    sources: ["chart", "divisional", "dasha", "currentDasha", "yogas", "strength"],
    concepts: ["career", "profession", "occupation", "employment", "10th", "tenth", "6th", "sixth", "11th", "eleventh", "dashamsha", "d10", "mahadasha", "antardasha", "sun", "saturn", "mars", "mercury", "jupiter"]
  },
  education: {
    label: "Education",
    aliases: ["education", "study", "studies", "exam", "higher studies", "learning"],
    sources: ["chart", "divisional", "dasha", "currentDasha", "yogas", "strength"],
    concepts: ["education", "study", "learning", "4th", "5th", "9th", "mercury", "jupiter", "dasha"]
  },
  marriage: {
    label: "Marriage & Relationships",
    aliases: ["marriage", "relationship", "spouse", "partner", "love"],
    sources: ["chart", "divisional", "dasha", "currentDasha", "yogas", "strength"],
    concepts: ["marriage", "relationship", "spouse", "partner", "7th", "seventh", "venus", "jupiter", "navamsa", "d9", "dasha"]
  },
  finance: {
    label: "Finance & Wealth",
    aliases: ["finance", "wealth", "money", "income", "savings", "assets"],
    sources: ["chart", "divisional", "dasha", "currentDasha", "yogas", "wealth", "strength"],
    concepts: ["wealth", "finance", "income", "savings", "2nd", "11th", "d2", "hora", "jupiter", "venus", "dasha"]
  },
  travel: {
    label: "Foreign Travel & Relocation",
    aliases: ["travel", "foreign travel", "abroad", "relocation", "settlement"],
    sources: ["chart", "divisional", "dasha", "currentDasha", "yogas"],
    concepts: ["travel", "foreign", "abroad", "relocation", "12th", "9th", "4th", "7th", "rahu", "ketu", "dasha"]
  },
  dasha: {
    label: "Dasha & Timing",
    aliases: ["dasha", "timing", "period", "mahadasha", "antardasha"],
    sources: ["chart", "dasha", "currentDasha"],
    concepts: ["dasha", "mahadasha", "antardasha", "pratyantardasha", "period", "start", "end"]
  },
  kundali_matching: {
    label: "Kundali Matching",
    aliases: ["kundali matching", "guna milan", "ashtakoot", "compatibility matching"],
    sources: [],
    concepts: []
  },
  overall: {
    label: "Overall Chart Overview",
    aliases: ["overall", "overview", "full chart", "kundali", "general"],
    sources: ["chart", "divisional", "dasha", "currentDasha", "yogas", "wealth", "strength"],
    concepts: []
  }
});

const SENSITIVE_KEYS = new Set([
  "birth", "birthdetails", "personaldata", "fullname", "email", "phone",
  "phonenumber", "address", "latitude", "longitude", "placeid", "requestid",
  "docurl", "metadataprivate"
]);

const CAREER_HOUSES = new Set([6, 10, 11]);
const GOVERNMENT_PLANETS = new Set(["sun", "saturn"]);
const SUPPORTIVE_YOGA_TERMS = [
  "rajyoga", "raja yoga", "dharmakarmadhipati", "dharma karmadhipati",
  "amala yoga", "karma yoga", "vipreet raj yoga", "viparita raja yoga"
];

// Topic-specific rules are intentionally transparent and conservative. These
// are traditional indication indices, never empirical probabilities.
const DOMAIN_PROFILES = Object.freeze({
  education: {
    label: "Education & Learning", divisional: "D24", houses: [4, 5, 9],
    planets: ["mercury", "jupiter", "moon"],
    yogaTerms: ["saraswati", "vidya", "buddhi", "education", "learning"],
    guidance: "Study continuity, learning style, examination preparation and higher-learning choices"
  },
  marriage: {
    label: "Marriage & Relationships", divisional: "D9", houses: [2, 7, 11],
    planets: ["venus", "jupiter", "moon", "mars", "saturn"],
    yogaTerms: ["vivaha", "marriage", "kalatra", "darapada", "relationship"],
    guidance: "Partnership expectations, communication, emotional maturity and commitment"
  },
  finance: {
    label: "Finance & Wealth", divisional: "D2", houses: [2, 5, 9, 11],
    planets: ["jupiter", "venus", "mercury", "saturn"],
    yogaTerms: ["dhana", "lakshmi", "artha", "wealth", "finance"],
    guidance: "Earning patterns, savings discipline, resource management and financial planning"
  },
  travel: {
    label: "Foreign Travel & Relocation", divisional: "D4", houses: [3, 9, 12],
    planets: ["rahu", "moon", "jupiter", "saturn", "ketu"],
    yogaTerms: ["foreign", "travel", "pravrajya", "relocation", "migration"],
    guidance: "Travel, relocation and foreign opportunities; distinguish temporary travel from settlement"
  },
  overall: {
    label: "Overall Life Overview", divisional: "D9", houses: [1, 5, 9, 10, 11],
    planets: ["sun", "moon", "mercury", "jupiter", "saturn"],
    yogaTerms: [],
    guidance: "A balanced overview of temperament, direction, opportunities and areas requiring steady effort"
  }
});

function normalizeKey(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanText(value, max = LIMITS.maxText) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapCalculation(item) {
  if (!item || typeof item !== "object") {
    return { available: false, data: null, error: "Calculation was not returned." };
  }
  if (Object.prototype.hasOwnProperty.call(item, "success")) {
    return {
      available: item.success === true && item.data != null,
      data: item.data ?? null,
      error: item.success === true ? null : cleanText(item.error || "Calculation unavailable.")
    };
  }
  return { available: true, data: item, error: null };
}

function getCalculationIndex(calculations) {
  const index = {};
  for (const [key, wrapped] of Object.entries(calculations || {})) {
    const value = unwrapCalculation(wrapped);
    index[normalizeKey(key)] = { key, normalized: normalizeKey(key), ...value };
  }
  return index;
}

function findCalculation(index, groupName) {
  const aliases = SOURCE_GROUPS[groupName]?.aliases || [normalizeKey(groupName)];
  for (const alias of aliases) {
    const match = index[normalizeKey(alias)];
    if (match) return match;
  }
  return null;
}

function flattenFacts(value, path, output, state, depth = 0) {
  if (state.nodes >= LIMITS.maxNodes || depth > LIMITS.maxDepth || value == null) return;
  state.nodes += 1;

  if (["string", "number", "boolean"].includes(typeof value)) {
    if (typeof value !== "number" || Number.isFinite(value)) {
      output.push({ path, key: path.split(".").pop() || path, value: typeof value === "string" ? cleanText(value) : value });
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < Math.min(value.length, 100); i += 1) {
      flattenFacts(value[i], `${path}[${i}]`, output, state, depth + 1);
      if (state.nodes >= LIMITS.maxNodes) break;
    }
    return;
  }

  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(normalizeKey(key))) continue;
      flattenFacts(child, path ? `${path}.${key}` : key, output, state, depth + 1);
      if (state.nodes >= LIMITS.maxNodes) break;
    }
  }
}

function findNamedDivisionalChart(value, chartCode) {
  const config = CHARTS[chartCode];
  if (!config || value == null) return null;
  const aliases = new Set(config.aliases.map(normalizeKey));
  const queue = [{ value, path: "divisionalCharts", depth: 0 }];
  let visited = 0;

  while (queue.length && visited < LIMITS.maxNodes) {
    const current = queue.shift();
    visited += 1;
    if (current.depth > LIMITS.maxDepth || current.value == null) continue;

    if (Array.isArray(current.value)) {
      current.value.slice(0, 100).forEach((child, index) => {
        queue.push({ value: child, path: `${current.path}[${index}]`, depth: current.depth + 1 });
      });
      continue;
    }
    if (!isObject(current.value)) continue;

    for (const [key, child] of Object.entries(current.value)) {
      if (aliases.has(normalizeKey(key)) && child != null && (isObject(child) || Array.isArray(child))) {
        return { data: child, path: `${current.path}.${key}`, label: config.label, code: chartCode };
      }
    }

    // Provider may return an array of chart records with an explicit code/name field.
    const identityFields = ["chart", "chart_code", "division", "varga", "chart_name", "name", "type", "code"];
    for (const field of identityFields) {
      const match = Object.entries(current.value).find(([key]) => normalizeKey(key) === normalizeKey(field));
      if (match && typeof match[1] === "string" && aliases.has(normalizeKey(match[1]))) {
        return { data: current.value, path: current.path, label: config.label, code: chartCode };
      }
    }

    for (const [key, child] of Object.entries(current.value)) {
      if (SENSITIVE_KEYS.has(normalizeKey(key)) || child == null || typeof child !== "object") continue;
      queue.push({ value: child, path: `${current.path}.${key}`, depth: current.depth + 1 });
    }
  }
  return null;
}

function getField(object, aliases) {
  if (!isObject(object)) return undefined;
  const wanted = new Set(aliases.map(normalizeKey));
  for (const [key, value] of Object.entries(object)) {
    if (wanted.has(normalizeKey(key))) return value;
  }
  return undefined;
}

function normalizePlanet(value) {
  const normalized = normalizeKey(value);
  return PLANETS.has(normalized) ? normalized : null;
}

function normalizeSign(value) {
  const normalized = normalizeKey(value);
  return ZODIAC_SIGNS.includes(normalized) ? normalized : null;
}

function deriveWholeSignHouse(lagnaValue, planetSignValue) {
  const lagna = normalizeSign(lagnaValue);
  const planetSign = normalizeSign(planetSignValue);
  if (!lagna || !planetSign) return null;
  const lagnaIndex = ZODIAC_SIGNS.indexOf(lagna);
  const planetIndex = ZODIAC_SIGNS.indexOf(planetSign);
  return ((planetIndex - lagnaIndex + 12) % 12) + 1;
}

function extractPlanetRecords(value, source, rootPath = source) {
  const records = [];
  const visited = { nodes: 0 };

  // AstroLogics' divisional-chart payload shape (confirmed from the user's
  // live console): { lagna: "taurus", planets: { sun: "aquarius", ... } }.
  // Convert these map entries into explicit planet/sign records. Since the
  // frontend requested whole_sign houses, derive the house from lagna + sign.
  if (isObject(value)) {
    const planetMap = getField(value, ["planets"]);
    const lagna = getField(value, ["lagna", "ascendant", "rising_sign", "lagna_sign"]);
    if (isObject(planetMap)) {
      const mapEntries = Object.entries(planetMap).filter(([key, sign]) =>
        normalizePlanet(key) && typeof sign === "string" && normalizeSign(sign)
      );
      for (const [key, sign] of mapEntries) {
        const planet = normalizePlanet(key);
        const derivedHouse = DIVISIONAL_HOUSE_SYSTEM === "whole_sign"
          ? deriveWholeSignHouse(lagna, sign)
          : null;
        records.push({
          planet,
          planetLabel: planet.charAt(0).toUpperCase() + planet.slice(1),
          sign: normalizeSign(sign),
          house: derivedHouse,
          houseSource: derivedHouse == null ? null : "derived_from_whole_sign_lagna",
          degree: null,
          source,
          path: `${rootPath}.planets.${key}`
        });
      }
      if (mapEntries.length) return records;
    }
  }

  function walk(node, path, depth) {
    if (node == null || depth > LIMITS.maxDepth || visited.nodes >= LIMITS.maxNodes) return;
    visited.nodes += 1;
    if (Array.isArray(node)) {
      node.slice(0, 100).forEach((child, i) => walk(child, `${path}[${i}]`, depth + 1));
      return;
    }
    if (!isObject(node)) return;

    const identity = getField(node, ["planet", "planet_name", "id", "name", "label"]);
    const planet = normalizePlanet(identity);
    const signValue = getField(node, ["sign", "sign_name", "sign_label", "rashi", "rashi_name", "zodiac"]);
    const houseValue = getField(node, ["house", "house_number", "bhava", "house_no"]);
    const degreeValue = getField(node, ["degree", "degree_in_sign", "longitude", "position_degree"]);
    const house = Number(houseValue);

    if (planet && (signValue != null || houseValue != null || degreeValue != null)) {
      records.push({
        planet,
        planetLabel: planet.charAt(0).toUpperCase() + planet.slice(1),
        sign: signValue == null ? null : cleanText(signValue, 60),
        house: Number.isInteger(house) && house >= 1 && house <= 12 ? house : null,
        houseSource: Number.isInteger(house) && house >= 1 && house <= 12 ? "provider" : null,
        degree: Number.isFinite(Number(degreeValue)) ? Number(degreeValue) : null,
        source,
        path
      });
    }

    for (const [key, child] of Object.entries(node)) {
      if (SENSITIVE_KEYS.has(normalizeKey(key)) || child == null || typeof child !== "object") continue;
      walk(child, `${path}.${key}`, depth + 1);
    }
  }

  walk(value, rootPath, 0);
  const unique = new Map();
  for (const record of records) {
    const key = `${record.planet}|${record.sign}|${record.house}|${record.source}`;
    if (!unique.has(key)) unique.set(key, record);
  }
  return [...unique.values()];
}
function extractHouseLords(value, source) {
  const output = [];
  const visited = { nodes: 0 };

  function walk(node, path, depth) {
    if (node == null || depth > LIMITS.maxDepth || visited.nodes >= LIMITS.maxNodes) return;
    visited.nodes += 1;
    if (Array.isArray(node)) {
      node.slice(0, 100).forEach((child, i) => walk(child, `${path}[${i}]`, depth + 1));
      return;
    }
    if (!isObject(node)) return;

    const houseValue = getField(node, ["house", "house_number", "bhava", "house_no"]);
    const lordValue = getField(node, ["lord", "house_lord", "lord_planet", "ruler"]);
    const house = Number(houseValue);
    const lord = normalizePlanet(lordValue);
    if (Number.isInteger(house) && house >= 1 && house <= 12 && lord) {
      output.push({ house, lord, source, path });
    }

    for (const [key, child] of Object.entries(node)) {
      if (SENSITIVE_KEYS.has(normalizeKey(key)) || child == null || typeof child !== "object") continue;
      walk(child, `${path}.${key}`, depth + 1);
    }
  }
  walk(value, source, 0);
  return output;
}

function parseDate(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text) return null;

  // ISO date or datetime: 2026-11-13 or 2026-11-13T00:00:00Z.
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[T\s])/);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d)) return date.toISOString().slice(0, 10);
  }

  // Day-first numeric date: 13-11-2026 or 13/11/2026.
  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:$|[T\s])/);
  if (match) {
    const [, d, m, y] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d)) return date.toISOString().slice(0, 10);
  }

  // Common provider display formats: 13 Nov 2026 / Nov 13, 2026.
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed) && /[a-z]{3,}/i.test(text)) {
    const date = new Date(parsed);
    if (date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 2200) return date.toISOString().slice(0, 10);
  }
  return null;
}

function dateInTimeZone(timeZone = "Asia/Kolkata", now = new Date()) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch {
    timeZone = "Asia/Kolkata";
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }
  const parts = Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function resolveReference(options = {}) {
  const timeZone = options.timeZone || process.env.ASTRO_TIME_ZONE || "Asia/Kolkata";
  const explicitDate = parseDate(options.referenceDate);
  return {
    referenceDate: explicitDate || dateInTimeZone(timeZone),
    timeZone
  };
}

function classifyPeriodDate(startDate, endDate, referenceDate) {
  if (!startDate || !endDate || startDate > endDate) return "invalid";
  if (endDate < referenceDate) return "past";
  if (startDate <= referenceDate && referenceDate <= endDate) return "active";
  return "upcoming";
}

function selectCurrentDashaChain(periods, referenceDate) {
  const active = periods
    .filter(period => period.dateStatus === "active" && period.withinParentDates !== false)
    .sort((a, b) => (b.parentHierarchy?.length || 0) - (a.parentHierarchy?.length || 0));
  if (!active.length) return null;
  const selected = active[0];
  const hierarchy = [
    ...(selected.parentHierarchy || []).map(parent => ({
      level: parent.level,
      planet: parent.lordLabel,
      startDate: parent.startDate,
      endDate: parent.endDate
    })),
    {
      level: selected.level,
      planet: selected.lordLabel,
      startDate: selected.startDate,
      endDate: selected.endDate
    }
  ];
  return {
    hierarchy,
    hierarchyLabel: hierarchy.map(item => `${item.planet} ${item.level}`).join(" → "),
    startDate: selected.startDate,
    endDate: selected.endDate,
    status: "active",
    hierarchyValid: selected.withinParentDates !== false
  };
}

function normalizeDashaLevel(value) {
  const normalized = normalizeKey(value);
  if (!normalized) return null;
  if (normalized.includes("pratyantar") || normalized.includes("pratyantardasha")) return "Pratyantardasha";
  if (normalized.includes("antar") && !normalized.includes("pratyantar")) return "Antardasha";
  if (normalized.includes("maha")) return "Mahadasha";
  if (normalized === "major" || normalized === "mainperiod") return "Mahadasha";
  if (normalized === "subperiod" || normalized === "minor") return "Antardasha";
  return null;
}

function inferDashaLevel(path, inheritedLevel, explicitValue) {
  const explicit = normalizeDashaLevel(explicitValue);
  if (explicit) return explicit;
  const fromPath = normalizeDashaLevel(path);
  return fromPath || inheritedLevel || "Dasha period";
}

function normalizeDashaLord(value) {
  const direct = normalizePlanet(value);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  // Provider labels such as "Rahu Mahadasha" or "Saturn (Antardasha)".
  for (const planet of [...PLANETS].sort((a, b) => b.length - a.length)) {
    if (new RegExp(`^${planet}(?:\\b|[_\\s-])`, "i").test(normalized)) return planet;
  }
  return null;
}

function extractDashaPeriods(value) {
  const periods = [];
  const visited = { nodes: 0 };
  const seen = new Set();
  const startAliases = ["start_date", "startDate", "from", "from_date", "date_from", "period_start", "begin_date", "start", "starts_at", "start_date_time", "startDateTime"];
  const endAliases = ["end_date", "endDate", "to", "to_date", "date_to", "period_end", "finish_date", "end", "ends_at", "end_date_time", "endDateTime"];
  const levelAliases = ["level", "dasha_level", "period_level", "period_type", "dasha_type", "sub_period_type", "period_name", "dasha_name", "type", "kind"];
  const lordAliases = [
    "pratyantardasha_lord", "pratyantar_dasha_lord", "antardasha_lord", "antar_dasha_lord",
    "mahadasha_lord", "maha_dasha_lord", "dasha_lord", "planet", "planet_name", "lord", "graha", "ruler",
    "period_name", "dasha_name", "name"
  ];

  function walk(node, path, depth, inheritedLevel, ancestors, keyHint) {
    if (node == null || depth > LIMITS.maxDepth || visited.nodes >= LIMITS.maxNodes) return;
    visited.nodes += 1;

    if (Array.isArray(node)) {
      node.slice(0, 100).forEach((child, index) =>
        walk(child, `${path}[${index}]`, depth + 1, inheritedLevel, ancestors, keyHint)
      );
      return;
    }
    if (!isObject(node)) return;

    const explicitLevel = getField(node, levelAliases);
    const normalizedExplicitLevel = normalizeDashaLevel(explicitLevel);
    const level = inferDashaLevel(path, inheritedLevel, explicitLevel);
    const startDate = parseDate(getField(node, startAliases));
    const endDate = parseDate(getField(node, endAliases));
    const lordValue = getField(node, lordAliases);
    const lord = normalizeDashaLord(lordValue) || normalizeDashaLord(keyHint);
    let nextAncestors = ancestors;

    if (startDate && endDate && lord && startDate <= endDate) {
      const hierarchy = ancestors.map(parent => ({
        lord: parent.lord,
        lordLabel: parent.lordLabel,
        level: parent.level,
        startDate: parent.startDate,
        endDate: parent.endDate
      }));
      const parent = hierarchy.length ? hierarchy[hierarchy.length - 1] : null;
      const ancestorsConsistent = ancestors.every(item => item.withinParentDates !== false);
      const withinImmediateParent = !parent || (startDate >= parent.startDate && endDate <= parent.endDate);
      const withinParentDates = ancestorsConsistent && withinImmediateParent;
      const record = {
        lord,
        lordLabel: lord.charAt(0).toUpperCase() + lord.slice(1),
        level,
        levelSource: normalizedExplicitLevel ? "provider_explicit" : (level !== "Dasha period" ? "path_or_parent_inferred" : "unclassified"),
        startDate,
        endDate,
        parentHierarchy: hierarchy,
        parentLevel: parent?.level || null,
        parentLord: parent?.lord || null,
        withinParentDates,
        hierarchyLabel: [...hierarchy, {
          lordLabel: lord.charAt(0).toUpperCase() + lord.slice(1),
          level
        }].map(item => `${item.lordLabel} ${item.level}`).join(" → "),
        sourcePath: path
      };
      const signature = [lord, startDate, endDate, level, hierarchy.map(item => `${item.lord}:${item.startDate}:${item.endDate}`).join(">")].join("|");
      if (!seen.has(signature)) {
        seen.add(signature);
        periods.push(record);
      }
      nextAncestors = [...ancestors, record];
    }

    for (const [key, child] of Object.entries(node)) {
      if (SENSITIVE_KEYS.has(normalizeKey(key)) || child == null || typeof child !== "object") continue;
      const childLevel = inferDashaLevel(key, level, null);
      const childKeyHint = normalizeDashaLord(key) ? key : null;
      walk(child, `${path}.${key}`, depth + 1, childLevel, nextAncestors, childKeyHint);
    }
  }

  walk(value, "vimshottariDasha", 0, null, [], null);

  return mergeDashaPeriods(periods).slice(0, LIMITS.maxDashaPeriods);
}

// AstroLogics can repeat the same lord/date interval in both the full timeline
// and a current-period summary, sometimes with a generic "Dasha period" label.
// Prefer the explicitly classified, deepest valid hierarchy for that exact
// interval so duplicate rows do not become duplicate job opportunities.
function mergeDashaPeriods(periods) {
  const byInterval = new Map();
  const quality = period => {
    const recognized = ["Mahadasha", "Antardasha", "Pratyantardasha"].includes(period.level) ? 1 : 0;
    const explicit = period.levelSource === "provider_explicit" ? 1 : 0;
    const depth = Array.isArray(period.parentHierarchy) ? period.parentHierarchy.length : 0;
    const valid = period.withinParentDates !== false ? 1 : 0;
    return recognized * 1000 + depth * 100 + explicit * 10 + valid;
  };
  for (const period of periods || []) {
    if (!period || !period.lord || !period.startDate || !period.endDate) continue;
    const key = `${period.lord}|${period.startDate}|${period.endDate}`;
    const existing = byInterval.get(key);
    if (!existing || quality(period) > quality(existing)) {
      byInterval.set(key, period);
    }
  }
  const levelOrder = { Mahadasha: 0, Antardasha: 1, Pratyantardasha: 2, "Dasha period": 3 };
  return [...byInterval.values()].sort((a, b) =>
    a.startDate.localeCompare(b.startDate) ||
    (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9) ||
    a.endDate.localeCompare(b.endDate)
  );
}

function extractYogaNames(value) {
  const names = [];
  const visited = { nodes: 0 };
  function walk(node, path, depth) {
    if (node == null || depth > LIMITS.maxDepth || visited.nodes >= LIMITS.maxNodes) return;
    visited.nodes += 1;
    if (Array.isArray(node)) {
      node.slice(0, 100).forEach((child, i) => walk(child, `${path}[${i}]`, depth + 1));
      return;
    }
    if (!isObject(node)) return;
    const candidate = getField(node, ["yoga_name", "name", "title", "yoga", "type"]);
    if (typeof candidate === "string" && candidate.trim()) {
      const present = getField(node, ["present", "is_present", "active", "exists", "formed"]);
      if (present !== false) names.push({ name: cleanText(candidate, 100), path });
    }
    for (const [key, child] of Object.entries(node)) {
      if (SENSITIVE_KEYS.has(normalizeKey(key)) || child == null || typeof child !== "object") continue;
      walk(child, `${path}.${key}`, depth + 1);
    }
  }
  walk(value, "yogas", 0);
  const unique = new Map();
  names.forEach(item => unique.set(normalizeKey(item.name), item));
  return [...unique.values()];
}

function extractStrengthSignals(value) {
  const signals = [];
  const visited = { nodes: 0 };
  function walk(node, path, depth, keyHint = null) {
    if (node == null || depth > LIMITS.maxDepth || visited.nodes >= LIMITS.maxNodes) return;
    visited.nodes += 1;
    if (Array.isArray(node)) {
      node.slice(0, 100).forEach((child, i) => walk(child, `${path}[${i}]`, depth + 1, null));
      return;
    }
    if (!isObject(node)) return;

    // AstroLogics may return either [{planet, strength_status}] or a map such
    // as {sun: {strength_status: "strong"}}. Accept both explicit shapes.
    const planet = normalizePlanet(getField(node, ["planet", "planet_name", "id", "name"]) || keyHint);
    const statusValue = getField(node, ["strength_status", "status", "dignity", "avastha", "condition"]);
    const isStrong = getField(node, ["is_strong", "strong"]);
    const isWeak = getField(node, ["is_weak", "weak"]);
    let status = null;
    if (isStrong === true) status = "strong";
    else if (isWeak === true) status = "weak";
    else if (typeof statusValue === "string") {
      const normalized = normalizeKey(statusValue);
      if (["strong", "verystrong", "high", "exalted", "ownsign", "moolatrikona"].includes(normalized)) status = "strong";
      else if (["weak", "veryweak", "low", "debilitated", "neecha"].includes(normalized)) status = "weak";
      else if (["average", "moderate", "neutral", "medium", "normal", "samanya"].includes(normalized)) status = "moderate";
    }
    if (planet && status) signals.push({ planet, status, sourcePath: path, statusSource: typeof statusValue === "string" ? cleanText(statusValue, 50) : (isStrong === true ? "is_strong" : "is_weak") });

    for (const [key, child] of Object.entries(node)) {
      if (SENSITIVE_KEYS.has(normalizeKey(key)) || child == null || typeof child !== "object") continue;
      walk(child, `${path}.${key}`, depth + 1, normalizePlanet(key));
    }
  }
  walk(value, "planetaryStrength", 0, null);
  const unique = new Map();
  signals.forEach(item => unique.set(`${item.planet}|${item.status}`, item));
  return [...unique.values()];
}

function topicFromQuestion(question, fallback) {
  const text = String(question || "").toLowerCase();
  if (!text.trim()) return { topic: TOPICS[fallback] ? fallback : "overall", intent: null };
  const governmentIntent = /(government|govt|public service|civil service|sarkari|state service|railway|ssc|police job|defence job)/i.test(text);
  const priority = ["career", "education", "marriage", "finance", "travel", "dasha"];
  for (const topic of priority) {
    const matched = TOPICS[topic].aliases.some(alias => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(text);
    });
    if (matched) return { topic, intent: topic === "career" && governmentIntent ? "government_service" : null };
  }
  if (governmentIntent) return { topic: "career", intent: "government_service" };
  return { topic: TOPICS[fallback] ? fallback : "overall", intent: null };
}

function labelForScore(score) {
  if (score == null) return "Not enough structured evidence to score";
  if (score >= 80) return "Very strong traditional indications";
  if (score >= 70) return "Strong traditional indications";
  if (score >= 60) return "Favourable traditional indications";
  if (score >= 45) return "Mixed or moderate indications";
  if (score >= 30) return "Limited supportive indications";
  return "Weak or conflicting traditional indications";
}

function signalGroup(source) {
  const key = normalizeKey(source);
  if (key === "d1" || key.includes("d1houselord")) return "D1";
  if (key === "d10" || key.includes("d10")) return "D10";
  if (key.includes("yoga")) return "Yogas";
  if (key.includes("strength")) return "Strength";
  if (key.includes("dasha")) return "Dasha";
  return source;
}

function createSignal(source, description, points, kind = "support") {
  return { source, sourceGroup: signalGroup(source), description, points, kind };
}

function assessCareer(report, index, chartData, dashaPeriods, referenceDate) {
  const d1 = chartData.D1.planets;
  const d10 = chartData.D10.planets;
  const d1Lords = chartData.D1.houseLords;
  const yogasCalc = findCalculation(index, "yogas");
  const strengthCalc = findCalculation(index, "strength");
  const yogaNames = yogasCalc?.available ? extractYogaNames(yogasCalc.data) : [];
  const strengths = strengthCalc?.available ? extractStrengthSignals(strengthCalc.data) : [];

  const d1CareerPlanets = d1.filter(p => p.house != null && CAREER_HOUSES.has(p.house));
  const d10CareerPlanets = d10.filter(p => p.house != null && CAREER_HOUSES.has(p.house));
  const careerLords = [...new Set(d1Lords.filter(x => CAREER_HOUSES.has(x.house)).map(x => x.lord))];
  const relevantPeriods = dashaPeriods.filter(period =>
    period.dateStatus === "active" || period.dateStatus === "upcoming"
  );

  // Overall chart scores use distinct, active/future Dasha lords only.
  // Historical periods remain in the full timeline for context but cannot
  // increase the current/future chart-potential reading.
  const relevantDashaLords = [...new Set(relevantPeriods
    .filter(period => [
      ...d1CareerPlanets.map(p => p.planet),
      ...d10CareerPlanets.map(p => p.planet),
      ...careerLords
    ].includes(period.lord))
    .map(period => period.lord))];

  const careerSignals = [];
  const governmentSignals = [];
  const careerContributions = { D1: 0, D10: 0, Dasha: 0, Yogas: 0, Strength: 0 };
  const governmentContributions = { D1: 0, D10: 0, Dasha: 0, Yogas: 0, Strength: 0 };

  if (d1CareerPlanets.length) {
    careerContributions.D1 += 7;
    careerSignals.push(createSignal("D1", `D1 explicitly places ${d1CareerPlanets.map(p => `${p.planetLabel} in house ${p.house}`).join(", ")} in career-related houses 6, 10 or 11.`, 7));
  }
  if (careerLords.length) {
    careerContributions.D1 += 5;
    careerSignals.push(createSignal("D1 house-lord data", `The provider explicitly identifies the lords of career-related houses as ${careerLords.join(", ")}.`, 5));
  }

  const d1GovernmentPlanets = d1CareerPlanets.filter(p => GOVERNMENT_PLANETS.has(p.planet));
  const d1GovernmentLords = d1Lords.filter(x => CAREER_HOUSES.has(x.house) && GOVERNMENT_PLANETS.has(x.lord));
  if (d1GovernmentPlanets.length) {
    const points = Math.min(8, d1GovernmentPlanets.length * 5);
    governmentContributions.D1 += points;
    governmentSignals.push(createSignal("D1", `D1 explicitly places ${d1GovernmentPlanets.map(p => `${p.planetLabel} in house ${p.house}`).join(", ")} in career-related houses.`, points));
  }
  if (d1GovernmentLords.length) {
    governmentContributions.D1 += 5;
    governmentSignals.push(createSignal("D1 house-lord data", `The provider identifies ${[...new Set(d1GovernmentLords.map(x => x.lord))].join(" and ")} as lords of career-related houses.`, 5));
  }

  if (d10CareerPlanets.length) {
    careerContributions.D10 += 10;
    careerSignals.push(createSignal("D10", `D10 explicitly places ${d10CareerPlanets.map(p => `${p.planetLabel} in house ${p.house}`).join(", ")} in career-related houses 6, 10 or 11.`, 10));
  }
  const d10GovernmentPlanets = d10CareerPlanets.filter(p => GOVERNMENT_PLANETS.has(p.planet));
  if (d10GovernmentPlanets.length) {
    const points = Math.min(10, d10GovernmentPlanets.length * 6);
    governmentContributions.D10 += points;
    governmentSignals.push(createSignal("D10", `D10 explicitly places ${d10GovernmentPlanets.map(p => `${p.planetLabel} in house ${p.house}`).join(", ")} in career-related houses.`, points));
  }

  const supportiveYogas = yogaNames.filter(yoga => {
    const normalized = normalizeKey(yoga.name);
    return SUPPORTIVE_YOGA_TERMS.some(term => normalized.includes(normalizeKey(term)));
  });
  if (supportiveYogas.length) {
    const points = Math.min(8, supportiveYogas.length * 4);
    careerContributions.Yogas += points;
    governmentContributions.Yogas += points;
    careerSignals.push(createSignal("Yogas", `AstroLogics returned these recognised traditional career/authority yoga names: ${supportiveYogas.map(y => y.name).join(", ")}.`, points));
    governmentSignals.push(createSignal("Yogas", `AstroLogics returned potentially career/authority-relevant yoga names: ${supportiveYogas.map(y => y.name).join(", ")}.`, points));
  }

  const careerRelevantPlanetSet = new Set([
    "sun", "saturn", ...careerLords,
    ...d1CareerPlanets.map(item => item.planet),
    ...d10CareerPlanets.map(item => item.planet)
  ]);
  const relevantStrengths = strengths.filter(s => careerRelevantPlanetSet.has(s.planet));
  const strongStrengths = relevantStrengths.filter(s => s.status === "strong");
  const weakStrengths = relevantStrengths.filter(s => s.status === "weak");
  const moderateStrengths = relevantStrengths.filter(s => s.status === "moderate");
  const supportiveFactors = [];
  const challengeFactors = [];
  if (d1CareerPlanets.length) supportiveFactors.push({
    source: "D1",
    text: d1CareerPlanets.map(p => `${p.planetLabel} in house ${p.house}`).join(", ")
  });
  if (d10CareerPlanets.length) supportiveFactors.push({
    source: "D10",
    text: d10CareerPlanets.map(p => `${p.planetLabel} in house ${p.house}`).join(", ")
  });
  if (supportiveYogas.length) supportiveFactors.push({
    source: "Yogas",
    text: supportiveYogas.map(y => y.name).join(", ")
  });
  if (strongStrengths.length) supportiveFactors.push({
    source: "Planetary strength",
    text: strongStrengths.map(s => `${s.planet} explicitly marked strong`).join(", ")
  });
  if (weakStrengths.length) challengeFactors.push({
    source: "Planetary strength",
    text: weakStrengths.map(s => `${s.planet} explicitly marked weak`).join(", ")
  });
  if (moderateStrengths.length) challengeFactors.push({
    source: "Planetary strength",
    text: moderateStrengths.map(s => `${s.planet} marked moderate/neutral`).join(", ")
  });
  // Placement-based traditional reading is deliberately kept separate from
  // formal Shadbala/strength statuses. It gives the customer useful strengths
  // and cautions without pretending that a placement is a measured strength.
  const traditionalStrengths = [];
  const areasToManage = [];
  const addReading = (target, source, planet, text) => {
    target.push({ source, planet, text });
  };
  const planetInSign = planet => `${planet.planetLabel}${planet.sign ? ` in ${planet.sign.charAt(0).toUpperCase()}${planet.sign.slice(1)}` : ""}`;
  const houseSourceLabel = planet => planet.houseSource === "derived_from_whole_sign_lagna"
    ? " (whole-sign house derived from divisional-chart Lagna)"
    : planet.houseSource === "provider" ? " (provider-supplied house)" : "";

  for (const planet of d1) {
    if (planet.house === 6) {
      addReading(traditionalStrengths, `D1 · Rashi${houseSourceLabel(planet)}`, planet.planetLabel,
        `${planetInSign(planet)} in the 6th house supports service, competitive effort, problem-solving and the ability to face obstacles.`);
      addReading(areasToManage, `D1 · Rashi${houseSourceLabel(planet)}`, planet.planetLabel,
        `${planetInSign(planet)} in the 6th house can make work and competition demanding. Channel the drive into regular preparation and avoid impatience, arguments or overexertion.`);
    }
    if (planet.house === 10) {
      const text = planet.planet === "rahu"
        ? `${planetInSign(planet)} in the 10th house intensifies ambition, visibility and the wish to build a distinct professional identity. It can favour unconventional routes, provided choices remain disciplined.`
        : planet.planet === "jupiter"
          ? `${planetInSign(planet)} in the 10th house is a supportive career indication associated in traditional Jyotish with responsibility, guidance, administration, teaching and public reputation.`
          : `${planetInSign(planet)} in the 10th house directly connects this planet with profession, responsibility and public standing.`;
      addReading(traditionalStrengths, `D1 · Rashi${houseSourceLabel(planet)}`, planet.planetLabel, text);
      if (planet.planet === "rahu") {
        addReading(areasToManage, `D1 · Rashi${houseSourceLabel(planet)}`, planet.planetLabel,
          `${planetInSign(planet)} in the 10th can make the career path ambitious but less predictable. Check opportunities carefully and avoid changing direction only for quick recognition.`);
      }
    }
    if (planet.house === 11) {
      addReading(traditionalStrengths, `D1 · Rashi${houseSourceLabel(planet)}`, planet.planetLabel,
        `${planetInSign(planet)} in the 11th house supports gains, helpful associations and progress through networks.`);
    }
    if (planet.planet === "saturn" && planet.house === 9) {
      addReading(traditionalStrengths, `D1 · Rashi${houseSourceLabel(planet)}`, planet.planetLabel,
        `${planetInSign(planet)} in the 9th house favours patience, structured learning and steady progress through long-term effort.`);
      addReading(areasToManage, `D1 · Rashi${houseSourceLabel(planet)}`, planet.planetLabel,
        `${planetInSign(planet)} in the 9th house asks for patience with examinations, mentors and formal institutions; avoid expecting every result immediately.`);
    }
  }

  for (const planet of d10) {
    if (planet.house === 10) {
      addReading(traditionalStrengths, `D10 · Dashamsha${houseSourceLabel(planet)}`, planet.planetLabel,
        `${planetInSign(planet)} in the 10th house of the profession chart supports responsibility, authority, leadership and visibility in work.`);
    }
    if (planet.house === 11) {
      addReading(traditionalStrengths, `D10 · Dashamsha${houseSourceLabel(planet)}`, planet.planetLabel,
        `${planetInSign(planet)} in the 11th house of the profession chart supports gains through networks, colleagues, coordination and professional associations.`);
    }
    if (planet.house === 8) {
      addReading(areasToManage, `D10 · Dashamsha${houseSourceLabel(planet)}`, planet.planetLabel,
        `${planetInSign(planet)} in the 8th house of the profession chart can describe a less linear work path involving research, complex responsibilities or professional transitions. Build resilience and keep skills current; this placement alone is not a denial of success.`);
    }
  }

  if (supportiveYogas.length) {
    supportiveYogas.forEach(yoga => addReading(traditionalStrengths, "Yogas", yoga.name,
      `${yoga.name} was returned by AstroLogics as present and is traditionally associated with authority, progress or the ability to rise after obstacles. The exact yoga formation is not independently recalculated here.`));
  }

  const uniqueReadings = list => [...new Map(list.map(item => [`${item.source}|${item.planet}|${item.text}`, item])).values()];
  const cleanTraditionalStrengths = uniqueReadings(traditionalStrengths).slice(0, 10);
  const cleanAreasToManage = uniqueReadings(areasToManage).slice(0, 8);
  const interpretiveSummary = cleanTraditionalStrengths.length
    ? `The clearest career supports in the supplied chart are: ${cleanTraditionalStrengths.slice(0, 4).map(item => item.text).join(" ")} ${cleanAreasToManage.length ? `The main areas to handle carefully are: ${cleanAreasToManage.slice(0, 3).map(item => item.text).join(" ")}` : "No specific placement-based caution was identified in the readable D1/D10 factors."}`
    : "The available report does not contain enough readable D1/D10 placement detail to describe specific career strengths and cautions.";

  const strengthWeakness = {
    calculationAvailable: Boolean(strengthCalc?.available),
    explicitStatusesFound: strengths.length,
    strongPlanets: strengths.filter(s => s.status === "strong").map(s => ({ planet: s.planet, sourcePath: s.sourcePath, statusSource: s.statusSource })),
    weakPlanets: strengths.filter(s => s.status === "weak").map(s => ({ planet: s.planet, sourcePath: s.sourcePath, statusSource: s.statusSource })),
    moderatePlanets: strengths.filter(s => s.status === "moderate").map(s => ({ planet: s.planet, sourcePath: s.sourcePath, statusSource: s.statusSource })),
    careerRelevantStrongPlanets: strongStrengths.map(s => s.planet),
    careerRelevantWeakPlanets: weakStrengths.map(s => s.planet),
    supportiveFactors,
    challengeFactors,
    traditionalStrengths: cleanTraditionalStrengths,
    areasToManage: cleanAreasToManage,
    interpretiveSummary,
    strengthDataNote: !strengthCalc?.available
      ? "AstroLogics did not return a usable planetary-strength calculation. The D1/D10 observations below are traditional placement interpretations, not formal Shadbala labels."
      : !strengths.length
        ? "AstroLogics returned a planetary-strength calculation, but no explicit strong/weak/moderate status could be read. The D1/D10 strengths and cautions below are placement-based interpretations only; numeric values are not converted into strength labels without the provider's scale and thresholds."
        : "Formal strong, weak and moderate labels are shown only where AstroLogics explicitly supplied them. Placement-based interpretations are listed separately and do not replace formal planetary-strength measurements."
  };
  if (relevantStrengths.length) {
    const careerSupport = Math.min(8, strongStrengths.length * 4);
    const careerChallenge = Math.min(8, weakStrengths.length * 4);
    careerContributions.Strength = careerSupport - careerChallenge;
    if (careerSupport) careerSignals.push(createSignal(
      "Explicit planetary strength",
      `${strongStrengths.map(s => `${s.planet} strong`).join(", ")} according to provider status fields.`,
      careerSupport,
      "support"
    ));
    if (careerChallenge) careerSignals.push(createSignal(
      "Explicit planetary strength",
      `${weakStrengths.map(s => `${s.planet} weak`).join(", ")} according to provider status fields; this is a counter-indication to weigh alongside supportive factors.`,
      -careerChallenge,
      "challenge"
    ));

    const govRelevant = relevantStrengths.filter(s => GOVERNMENT_PLANETS.has(s.planet));
    const govStrong = govRelevant.filter(s => s.status === "strong");
    const govWeak = govRelevant.filter(s => s.status === "weak");
    const govSupport = Math.min(8, govStrong.length * 4);
    const govChallenge = Math.min(8, govWeak.length * 4);
    governmentContributions.Strength = govSupport - govChallenge;
    if (govSupport) governmentSignals.push(createSignal(
      "Explicit planetary strength",
      `${govStrong.map(s => `${s.planet} strong`).join(", ")} according to provider status fields.`,
      govSupport,
      "support"
    ));
    if (govChallenge) governmentSignals.push(createSignal(
      "Explicit planetary strength",
      `${govWeak.map(s => `${s.planet} weak`).join(", ")} according to provider status fields; this is a counter-indication to weigh alongside supportive factors.`,
      -govChallenge,
      "challenge"
    ));
  }

  // Chart-potential scores are based on natal/divisional evidence. Dasha
  // activation is reported separately in dated windows so distant future
  // periods cannot inflate the underlying chart-potential score.
  const activeDashaLords = [...new Set(dashaPeriods
    .filter(period => period.dateStatus === "active" && period.withinParentDates !== false)
    .map(period => period.lord))];
  const dashaActivation = {
    activeLords: activeDashaLords,
    careerLinkedActiveLords: activeDashaLords.filter(lord =>
      d1CareerPlanets.some(planet => planet.planet === lord) ||
      d10CareerPlanets.some(planet => planet.planet === lord) || careerLords.includes(lord)
    ),
    governmentLinkedActiveLords: activeDashaLords.filter(lord =>
      GOVERNMENT_PLANETS.has(lord) && (
        d1CareerPlanets.some(planet => planet.planet === lord) ||
        d10CareerPlanets.some(planet => planet.planet === lord) || careerLords.includes(lord)
      )
    )
  };

  function finishAssessment(signals, contributions, category) {
    const independentGroups = [...new Set(signals.map(signal => signal.sourceGroup || signalGroup(signal.source)))];
    const hasSupport = signals.some(signal => signal.kind === "support" && signal.points > 0);
    const hasChallenge = signals.some(signal => signal.kind === "challenge" && signal.points < 0);
    if (independentGroups.length < 2 || !hasSupport) {
      return {
        score: null,
        label: "Not enough structured evidence to score",
        signalCount: signals.length,
        sourceCount: independentGroups.length,
        evidenceSources: independentGroups,
        status: "withheld",
        contributions,
        message: `The ${category} indication score is withheld because fewer than two independent structured evidence groups support a defensible assessment.`,
        signals
      };
    }
    const score = Math.max(0, Math.min(100, 50 + Object.values(contributions).reduce((sum, points) => sum + points, 0)));
    return {
      score,
      label: labelForScore(score),
      signalCount: signals.length,
      sourceCount: independentGroups.length,
      evidenceSources: independentGroups,
      status: hasChallenge ? "mixed_evidence" : "scored",
      contributions,
      message: "A traditional-indication index from explicit chart factors. It is not a real-world probability or a guarantee.",
      signals
    };
  }

  const career = finishAssessment(careerSignals, careerContributions, "career");
  const governmentService = finishAssessment(governmentSignals, governmentContributions, "government-service");

  // Each period is assessed from its own lord plus only the parent lords
  // explicitly supplied by AstroLogics. Parent scores are never copied to children.
  function assessPeriod(period, category) {
    const activeLords = [...new Set([
      ...(period.parentHierarchy || []).map(parent => parent.lord),
      period.lord
    ])];
    const ownLord = period.lord;
    const parentLords = activeLords.filter(lord => lord !== ownLord);
    const isGovernment = category === "government";
    const baseAssessment = isGovernment ? governmentService : career;

    const activeD1Career = d1CareerPlanets.filter(p => activeLords.includes(p.planet));
    const activeD10Career = d10CareerPlanets.filter(p => activeLords.includes(p.planet));
    const activeD1CareerLords = d1Lords.filter(item => CAREER_HOUSES.has(item.house) && activeLords.includes(item.lord));
    const activeD1Government = d1GovernmentPlanets.filter(p => activeLords.includes(p.planet));
    const activeD10Government = d10GovernmentPlanets.filter(p => activeLords.includes(p.planet));
    const activeD1GovernmentLords = d1GovernmentLords.filter(item => activeLords.includes(item.lord));
    const activeStrengths = strengths.filter(signal => activeLords.includes(signal.planet) &&
      (isGovernment ? GOVERNMENT_PLANETS.has(signal.planet) : careerRelevantPlanetSet.has(signal.planet)));

    const d1Links = isGovernment
      ? [...activeD1Government.map(p => `${p.planetLabel} in D1 house ${p.house}`), ...activeD1GovernmentLords.map(x => `${x.lord} is provider-identified lord of D1 house ${x.house}`)]
      : [...activeD1Career.map(p => `${p.planetLabel} in D1 house ${p.house}`), ...activeD1CareerLords.map(x => `${x.lord} is provider-identified lord of D1 house ${x.house}`)];
    const d10Links = isGovernment
      ? activeD10Government.map(p => `${p.planetLabel} in D10 house ${p.house}`)
      : activeD10Career.map(p => `${p.planetLabel} in D10 house ${p.house}`);
    const formalStrengthLinks = activeStrengths.map(signal => `${signal.planet} explicitly marked ${signal.status}`);

    // Sun and Saturn are treated as traditional government/service karakas in
    // this ruleset. Their explicit D1/D10 presence can provide a modest timing
    // activation even when the planet is not itself in houses 6/10/11. The
    // report says this is a karaka link, not a direct career-house placement.
    const governmentKarakaLinks = isGovernment
      ? activeLords.filter(lord => GOVERNMENT_PLANETS.has(lord) &&
          (d1.some(p => p.planet === lord) || d10.some(p => p.planet === lord)))
      : [];

    const recognizedLevel = ["Mahadasha", "Antardasha", "Pratyantardasha"].includes(period.level);
    const hasDirectActivation = d1Links.length > 0 || d10Links.length > 0 || formalStrengthLinks.length > 0;
    const hasGovernmentKarakaActivation = governmentKarakaLinks.length > 0;
    const hasTopicActivation = isGovernment
      ? hasDirectActivation || hasGovernmentKarakaActivation
      : hasDirectActivation;

    const contributions = {
      chartPotential: 0,
      D1: 0,
      D10: 0,
      governmentKaraka: 0,
      Strength: 0
    };
    const signals = [];
    const sources = [];
    let score = null;

    if (recognizedLevel && baseAssessment.score != null && hasTopicActivation) {
      // The base chart score already requires multiple independent chart/yoga
      // evidence groups. The timing score blends that chart foundation with
      // this exact period's own and parent-lord activations; it is recalculated
      // for every row and is never copied from the parent period.
      contributions.chartPotential = Math.round(Math.max(0, baseAssessment.score - 50) * 0.4);
      sources.push("Chart potential");
      signals.push(createSignal(
        "Overall chart assessment",
        `${isGovernment ? "Government-service" : "Career"} chart-potential index ${baseAssessment.score}/100 is the baseline for this period; the score is not an event probability.`,
        contributions.chartPotential
      ));

      if (d1Links.length) {
        const ownLink = (isGovernment ? activeD1Government : activeD1Career).some(p => p.planet === ownLord) ||
          (isGovernment ? activeD1GovernmentLords : activeD1CareerLords).some(item => item.lord === ownLord);
        contributions.D1 = ownLink ? 7 : 3;
        sources.push("D1");
        signals.push(createSignal("D1 Dasha activation", d1Links.join("; "), contributions.D1));
      }
      if (d10Links.length) {
        const ownLink = (isGovernment ? activeD10Government : activeD10Career).some(p => p.planet === ownLord);
        contributions.D10 = ownLink ? 10 : 4;
        sources.push("D10");
        signals.push(createSignal("D10 Dasha activation", d10Links.join("; "), contributions.D10));
      }
      if (governmentKarakaLinks.length && !d1Links.length && !d10Links.length) {
        const ownKaraka = governmentKarakaLinks.includes(ownLord);
        contributions.governmentKaraka = ownKaraka ? 5 : 2;
        sources.push("Government/service karaka activation");
        const placements = governmentKarakaLinks.map(lord => {
          const records = [...d1, ...d10].filter(item => item.planet === lord);
          return `${lord.charAt(0).toUpperCase()}${lord.slice(1)} (${records.map(item => `${item.source} house ${item.house ?? "not supplied"}`).join(", ")})`;
        });
        signals.push(createSignal(
          "Government/service karaka activation",
          `${placements.join("; ")}. This is a traditional karaka connection, not proof of a direct 6th/10th/11th-house placement.`,
          contributions.governmentKaraka
        ));
      }
      if (formalStrengthLinks.length) {
        const ownSignal = activeStrengths.find(item => item.planet === ownLord);
        const weighted = activeStrengths.reduce((sum, item) => {
          const weight = item.planet === ownLord ? 1 : 0.5;
          return sum + (item.status === "strong" ? 4 * weight : item.status === "weak" ? -4 * weight : 0);
        }, 0);
        contributions.Strength = Math.round(weighted);
        sources.push("Formal planetary strength");
        signals.push(createSignal(
          "Formal planetary strength",
          formalStrengthLinks.join("; "),
          contributions.Strength,
          contributions.Strength < 0 ? "challenge" : "support"
        ));
      }

      score = Math.max(0, Math.min(100,
        50 + Object.values(contributions).reduce((sum, value) => sum + value, 0)));
    }

    const distinctSources = [...new Set(sources)];
    const hasChallenge = signals.some(signal => signal.kind === "challenge");
    const ownLordLinks = [
      ...d1Links.filter(value => value.toLowerCase().startsWith(ownLord)),
      ...d10Links.filter(value => value.toLowerCase().startsWith(ownLord))
    ];
    const scoreBasis = {
      ownLord: ownLord.charAt(0).toUpperCase() + ownLord.slice(1),
      parentLords: parentLords.map(lord => lord.charAt(0).toUpperCase() + lord.slice(1)),
      ownLordHasDirectCareerLink: ownLordLinks.length > 0,
      activatedD1Factors: d1Links,
      activatedD10Factors: d10Links,
      formalStrengthFactors: formalStrengthLinks,
      governmentKarakaFactors: governmentKarakaLinks
    };

    return {
      score,
      label: score == null
        ? (!recognizedLevel ? "Unclassified dated period; score withheld" : baseAssessment.score == null
          ? "Overall chart assessment is not scored"
          : "No topic-specific Dasha activation found")
        : labelForScore(score),
      status: score == null ? "withheld" : hasChallenge ? "mixed_evidence" : "scored",
      recognizedLevel,
      evidenceSourceCount: distinctSources.length,
      evidenceSources: distinctSources,
      contributions,
      signals,
      activeLords: activeLords.map(lord => lord.charAt(0).toUpperCase() + lord.slice(1)),
      scoreBasis,
      note: !recognizedLevel
        ? "The provider supplied dates and a planetary lord but did not identify this as a Mahadasha, Antardasha or Pratyantardasha. It is shown for reference and is never ranked as a confirmed Dasha opportunity."
        : score == null
          ? baseAssessment.score == null
            ? `The overall ${isGovernment ? "government-service" : "career"} chart score is withheld, so this period cannot be given a timing index.`
            : `No supplied Dasha lord in this period has a readable ${isGovernment ? "government/service" : "career"} activation in the available D1/D10/strength data.`
          : "Period-specific traditional-indication index: a weighted blend of the scored natal chart foundation and this exact Dasha chain's own/parent-lord activations. This is not a job probability or guarantee."
    };
  }

  const validTimelinePeriods = dashaPeriods.filter(period => period.withinParentDates !== false &&
    ["past", "active", "upcoming"].includes(period.dateStatus));
  const dashaWindows = validTimelinePeriods.map(period => {
    const careerPeriod = assessPeriod(period, "career");
    const governmentPeriod = assessPeriod(period, "government");
    const hierarchy = [
      ...(period.parentHierarchy || []).map(parent => ({
        level: parent.level,
        planet: parent.lordLabel,
        startDate: parent.startDate,
        endDate: parent.endDate
      })),
      { level: period.level, planet: period.lordLabel, startDate: period.startDate, endDate: period.endDate }
    ];
    const dateStatusLabel = period.dateStatus === "past"
      ? "Past period (historical context)"
      : period.dateStatus === "active" ? "Currently active" : "Upcoming";
    return {
      period: period.level,
      level: period.level,
      windowType: period.parentHierarchy?.length ? "Combined nested period" : period.level,
      planet: period.lordLabel,
      startDate: period.startDate,
      endDate: period.endDate,
      dateStatus: period.dateStatus,
      dateStatusLabel,
      referenceDate,
      parentHierarchy: hierarchy.slice(0, -1),
      hierarchy,
      hierarchyLabel: period.hierarchyLabel,
      hierarchyValid: period.withinParentDates !== false,
      recognizedLevel: careerPeriod.recognizedLevel,
      activeLords: careerPeriod.activeLords,
      careerIndicationScore: careerPeriod.score,
      careerClassification: careerPeriod.label,
      governmentServiceIndicationScore: governmentPeriod.score,
      governmentServiceClassification: governmentPeriod.label,
      careerEvidenceSources: careerPeriod.evidenceSources,
      governmentEvidenceSources: governmentPeriod.evidenceSources,
      careerEvidenceSourceCount: careerPeriod.evidenceSourceCount,
      governmentEvidenceSourceCount: governmentPeriod.evidenceSourceCount,
      careerPeriodSignals: careerPeriod.signals,
      governmentPeriodSignals: governmentPeriod.signals,
      careerNote: careerPeriod.note,
      governmentServiceNote: governmentPeriod.note,
      scoreBasis: careerPeriod.scoreBasis,
      careerPeriodBasis: careerPeriod.scoreBasis,
      governmentPeriodBasis: governmentPeriod.scoreBasis,
      sourceLevel: period.levelSource || "path_or_parent_inferred",
      source: "AstroLogics Vimshottari Dasha dates"
    };
  }).sort((a, b) => a.startDate.localeCompare(b.startDate) ||
    ((a.hierarchy || []).length - (b.hierarchy || []).length) || a.endDate.localeCompare(b.endDate));

  const favourableCareer = dashaWindows.filter(window => window.recognizedLevel && window.careerIndicationScore != null && window.careerIndicationScore >= 60);
  const favourableGovernment = dashaWindows.filter(window => window.recognizedLevel && window.governmentServiceIndicationScore != null && window.governmentServiceIndicationScore >= 60);

  function rankOpportunities(list, scoreKey) {
    // Retain a broad Mahadasha/Antardasha and a nested child period when their
    // exact dates differ: each is a distinct planning window. Collapse only
    // exact same-planet/same-date duplicates, preferring the clearer hierarchy.
    const unique = new Map();
    for (const window of list) {
      const key = `${window.planet.toLowerCase()}|${window.startDate}|${window.endDate}`;
      const previous = unique.get(key);
      const depth = (window.hierarchy || []).length;
      const previousDepth = (previous?.hierarchy || []).length;
      if (!previous || depth > previousDepth ||
          (depth === previousDepth && (window[scoreKey] ?? -1) > (previous[scoreKey] ?? -1))) {
        unique.set(key, window);
      }
    }
    return [...unique.values()].sort((a, b) => (b[scoreKey] ?? -1) - (a[scoreKey] ?? -1) ||
      ((b.hierarchy || []).length - (a.hierarchy || []).length) ||
      a.startDate.localeCompare(b.startDate));
  }
  const rankCareer = list => rankOpportunities(list, "careerIndicationScore");
  const rankGovernment = list => rankOpportunities(list, "governmentServiceIndicationScore");
  const activeUpcoming = list => list.filter(window => window.recognizedLevel &&
    (window.dateStatus === "active" || window.dateStatus === "upcoming"));
  const timelineSummary = {
    referenceDate,
    periodsReturned: dashaWindows.length,
    pastCount: dashaWindows.filter(window => window.dateStatus === "past").length,
    activeCount: dashaWindows.filter(window => window.dateStatus === "active").length,
    upcomingCount: dashaWindows.filter(window => window.dateStatus === "upcoming").length,
    favourableCareerCount: favourableCareer.length,
    favourableGovernmentServiceCount: favourableGovernment.length,
    pastFavourableCareer: rankCareer(favourableCareer.filter(window => window.dateStatus === "past")).slice(0, 3),
    activeFavourableCareer: rankCareer(favourableCareer.filter(window => window.dateStatus === "active")).slice(0, 3),
    upcomingFavourableCareer: rankCareer(favourableCareer.filter(window => window.dateStatus === "upcoming")).slice(0, 5),
    pastFavourableGovernmentService: rankGovernment(favourableGovernment.filter(window => window.dateStatus === "past")).slice(0, 3),
    activeFavourableGovernmentService: rankGovernment(favourableGovernment.filter(window => window.dateStatus === "active")).slice(0, 3),
    upcomingFavourableGovernmentService: rankGovernment(favourableGovernment.filter(window => window.dateStatus === "upcoming")).slice(0, 5),
    strongestHistoricalCareerWindow: rankCareer(favourableCareer.filter(window => window.dateStatus === "past"))[0] || null,
    strongestUpcomingCareerWindow: rankCareer(favourableCareer.filter(window => window.dateStatus === "upcoming"))[0] || null,
    strongestHistoricalGovernmentWindow: rankGovernment(favourableGovernment.filter(window => window.dateStatus === "past"))[0] || null,
    strongestUpcomingGovernmentWindow: rankGovernment(favourableGovernment.filter(window => window.dateStatus === "upcoming"))[0] || null
  };
  const opportunitySummary = {
    referenceDate,
    currentCareerWindows: rankCareer(activeUpcoming(favourableCareer).filter(window => window.dateStatus === "active")).slice(0, 5),
    upcomingCareerWindows: rankCareer(activeUpcoming(favourableCareer).filter(window => window.dateStatus === "upcoming")).slice(0, 5),
    currentGovernmentServiceWindows: rankGovernment(activeUpcoming(favourableGovernment).filter(window => window.dateStatus === "active")).slice(0, 5),
    upcomingGovernmentServiceWindows: rankGovernment(activeUpcoming(favourableGovernment).filter(window => window.dateStatus === "upcoming")).slice(0, 5),
    note: "Only recognized Mahadasha, Antardasha and Pratyantardasha periods with explicit dates and scores are ranked. Broad parent periods and shorter nested periods are both shown when their exact date ranges differ; only exact same-planet/same-date duplicates are collapsed."
  };
  return {
    career,
    governmentService,
    strengthWeakness,
    dashaWindows,
    timelineSummary,
    opportunitySummary,
    dashaActivation,
    sourceAvailability: {
      D1: Boolean(findCalculation(index, "chart")?.available),
      D2: chartData.D2.usable,
      D9: chartData.D9.usable,
      D10: chartData.D10.usable,
      dashaPeriodsFound: dashaPeriods.length,
      activeOrUpcomingPeriodsFound: dashaWindows.filter(window => window.dateStatus === "active" || window.dateStatus === "upcoming").length,
      allTimelinePeriodsIncluded: dashaWindows.length,
      expiredPeriodsExcluded: dashaPeriods.filter(period => period.dateStatus === "past").length,
      historicalPeriodsRetained: dashaWindows.filter(window => window.dateStatus === "past").length,
      linkedActiveOrUpcomingDashaLordsFound: relevantDashaLords.length,
      yogaNamesFound: yogaNames.length,
      explicitStrengthSignalsFound: strengths.length
    },
    interpretationNote: "Chart scores are traditional-indication indices, not probabilities. Period scores combine the independently scored natal chart foundation with that exact Dasha chain's own and explicitly supplied parent-lord activations; each period is recomputed and no parent score is copied to a child. Formal planetary strength labels are shown only when AstroLogics explicitly returns them; placement-based strengths and cautions are separately identified as traditional interpretations."
  };
}

function buildChartData(index) {
  const birth = findCalculation(index, "chart");
  const divisional = findCalculation(index, "divisional");
  const data = {};

  for (const code of Object.keys(CHARTS)) {
    let found = null;
    if (code === "D1" && birth?.available) {
      found = { data: birth.data, path: birth.key, label: CHARTS.D1.label, code: "D1" };
    } else if (divisional?.available) {
      found = findNamedDivisionalChart(divisional.data, code);
    }
    const planets = found ? extractPlanetRecords(found.data, code, found.path) : [];
    const houseKnown = planets.filter(planet => Number.isInteger(planet.house)).length;
    data[code] = {
      available: Boolean(found),
      usable: Boolean(found && planets.length > 0),
      label: CHARTS[code].label,
      path: found?.path || null,
      planets,
      houseLords: found ? extractHouseLords(found.data, code) : [],
      planetPlacementsFound: planets.length,
      housePlacementsFound: houseKnown,
      houseCoverage: planets.length ? Math.round((houseKnown / planets.length) * 100) : 0,
      houseSources: [...new Set(planets.map(planet => planet.houseSource).filter(Boolean))]
    };
  }
  return data;
}

function buildEvidence(index, topicConfig, chartData, dashaPeriods) {
  const generalEvidence = [];
  const selectedSources = topicConfig.sources;

  for (const groupName of selectedSources) {
    const calculation = findCalculation(index, groupName);
    if (!calculation || !calculation.available) continue;

    // For career, do not flood the prompt with every nested divisional-chart
    // field. The compact D1/D10 records below are the authoritative evidence.
    if (topicConfig === TOPICS.career && groupName === "divisional") continue;

    const facts = [];
    flattenFacts(calculation.data, calculation.key, facts, { nodes: 0 });
    const conceptMatches = facts.filter(fact => {
      const text = `${fact.path} ${String(fact.value)}`.toLowerCase();
      return topicConfig.concepts.length === 0 ||
        topicConfig.concepts.some(term => text.includes(term.toLowerCase()));
    });

    // For a focused topic, a source with no matching facts contributes no
    // evidence. Never substitute arbitrary first records from that source.
    const chosen = (topicConfig.concepts.length ? conceptMatches : facts)
      .slice(0, topicConfig === TOPICS.career ? 8 : LIMITS.maxPerSource);

    for (const fact of chosen) {
      generalEvidence.push({
        source: calculation.key,
        path: fact.path,
        field: fact.key,
        value: fact.value
      });
    }
  }

  if (topicConfig === TOPICS.career) {
    const structuredChartEvidence = [];

    for (const code of ["D1", "D10"]) {
      if (!chartData[code].available) continue;
      chartData[code].planets.slice(0, 12).forEach(planet => {
        structuredChartEvidence.push({
          source: code,
          path: planet.path,
          field: `${planet.planetLabel} placement`,
          value: {
            sign: planet.sign,
            house: planet.house,
            houseSource: planet.houseSource || null,
            houseSystem: planet.houseSource === "derived_from_whole_sign_lagna" ? DIVISIONAL_HOUSE_SYSTEM : null,
            degree: planet.degree
          }
        });
      });
    }

    const structuredDashaEvidence = dashaPeriods.slice(0, 8).map(period => ({
      source: "Vimshottari Dasha",
      path: period.sourcePath,
      field: `${period.level} dates`,
      value: {
        planet: period.lordLabel,
        startDate: period.startDate,
        endDate: period.endDate
      }
    }));

    // Put the most relevant evidence first so later prompt compaction preserves
    // all D1/D10 planet records before secondary technical details.
    const sourcePriority = item => {
      const source = normalizeKey(item.source);
      if (source === "d1" || source === "d10") return 0;
      if (source.includes("vimshottari") || source.includes("currentdasha")) return 1;
      if (source.includes("yoga")) return 2;
      if (source.includes("planetarystrength") || source.includes("shadbala")) return 3;
      return 4;
    };

    const prioritizedGeneral = generalEvidence.sort((a, b) =>
      sourcePriority(a) - sourcePriority(b)
    );

    return [
      ...structuredChartEvidence,
      ...structuredDashaEvidence,
      ...prioritizedGeneral
    ].slice(0, LIMITS.maxEvidence);
  }

  const codeByTopic = topicConfig === TOPICS.education ? ["D1", "D24"]
    : topicConfig === TOPICS.marriage ? ["D1", "D9"]
    : topicConfig === TOPICS.finance ? ["D1", "D2"]
    : topicConfig === TOPICS.travel ? ["D1", "D4"]
    : topicConfig === TOPICS.overall ? ["D1", "D9"] : ["D1"];
  const structured = [];
  codeByTopic.forEach(code => {
    (chartData[code]?.planets || []).slice(0, 12).forEach(planet => structured.push({
      source: code, path: planet.path, field: `${planet.planetLabel} placement`,
      value: { sign: planet.sign, house: planet.house, houseSource: planet.houseSource || null,
        houseSystem: planet.houseSource === "derived_from_whole_sign_lagna" ? DIVISIONAL_HOUSE_SYSTEM : null, degree: planet.degree }
    }));
  });
  return [...structured, ...generalEvidence].slice(0, LIMITS.maxEvidence);
}


function assessDomainTopic(topic, index, chartData, dashaPeriods, referenceDate) {
  const profile = DOMAIN_PROFILES[topic];
  if (!profile) return null;
  const d1 = chartData.D1 || { planets: [], houseLords: [], usable: false };
  const special = chartData[profile.divisional] || { planets: [], houseLords: [], usable: false };
  const yogaCalc = findCalculation(index, "yogas");
  const strengthCalc = findCalculation(index, "strength");
  const wealthCalc = topic === "finance" ? findCalculation(index, "wealth") : null;
  const yogas = yogaCalc?.available ? extractYogaNames(yogaCalc.data) : [];
  const strengths = strengthCalc?.available ? extractStrengthSignals(strengthCalc.data) : [];
  const focus = new Set(profile.planets);
  const signals = [];
  const contributions = { D1: 0, divisional: 0, houseLords: 0, Yogas: 0, Strength: 0, Wealth: 0 };
  const sourceGroups = new Set();
  const supportedPlanets = new Set();
  const challengePlanets = new Set();

  const d1Relevant = (d1.planets || []).filter(p => p.house != null && profile.houses.includes(p.house));
  const specialRelevant = (special.planets || []).filter(p => p.house != null && profile.houses.includes(p.house));
  const d1RelevantLords = (d1.houseLords || []).filter(item => profile.houses.includes(item.house));

  if (d1Relevant.length) {
    contributions.D1 = Math.min(16, 7 + (d1Relevant.length - 1) * 3);
    sourceGroups.add("D1");
    d1Relevant.forEach(p => supportedPlanets.add(p.planet));
    signals.push(createSignal("D1", `D1 places ${d1Relevant.map(p => `${p.planetLabel} in house ${p.house}`).join(", ")} in houses traditionally associated with ${profile.label.toLowerCase()}.`, contributions.D1));
  }
  if (d1RelevantLords.length) {
    contributions.houseLords = Math.min(10, 5 + (new Set(d1RelevantLords.map(x => x.lord)).size - 1) * 2);
    // House-lord records are another field from the same D1 calculation, not
    // an independent source group. They may strengthen the D1 contribution
    // but cannot by themselves satisfy the two-source scoring threshold.
    sourceGroups.add("D1");
    d1RelevantLords.forEach(x => supportedPlanets.add(x.lord));
    signals.push(createSignal("D1 house-lord data", `AstroLogics explicitly identifies ${[...new Set(d1RelevantLords.map(x => x.lord))].join(", ")} as lords of relevant houses ${[...new Set(d1RelevantLords.map(x => x.house))].join(", ")}.`, contributions.houseLords));
  }
  if (specialRelevant.length) {
    contributions.divisional = Math.min(18, 10 + (specialRelevant.length - 1) * 3);
    sourceGroups.add(profile.divisional);
    specialRelevant.forEach(p => supportedPlanets.add(p.planet));
    signals.push(createSignal(profile.divisional, `${profile.divisional} (${CHARTS[profile.divisional].label}) places ${specialRelevant.map(p => `${p.planetLabel} in house ${p.house}`).join(", ")} in relevant houses.`, contributions.divisional));
  }
  const relatedYogas = yogas.filter(y => {
    const name = normalizeKey(y.name);
    return profile.yogaTerms.some(term => name.includes(normalizeKey(term)));
  });
  if (relatedYogas.length) {
    contributions.Yogas = Math.min(10, relatedYogas.length * 5);
    sourceGroups.add("Yogas");
    signals.push(createSignal("Yogas", `AstroLogics returned topic-relevant yoga names: ${relatedYogas.map(y => y.name).join(", ")}.`, contributions.Yogas));
  }
  const relevantStrengths = strengths.filter(item => focus.has(item.planet) || supportedPlanets.has(item.planet));
  const strong = relevantStrengths.filter(item => item.status === "strong");
  const weak = relevantStrengths.filter(item => item.status === "weak");
  const moderate = relevantStrengths.filter(item => item.status === "moderate");
  if (relevantStrengths.length) {
    contributions.Strength = Math.min(10, strong.length * 4 + moderate.length * 2);
    sourceGroups.add("Planetary strength");
    strong.forEach(x => supportedPlanets.add(x.planet));
    weak.forEach(x => challengePlanets.add(x.planet));
    signals.push(createSignal("Planetary strength", `${strong.length} relevant planet(s) are explicitly marked strong, ${weak.length} weak and ${moderate.length} moderate/neutral by AstroLogics.`, contributions.Strength, weak.length ? "mixed" : "support"));
  }
  if (wealthCalc?.available) {
    const facts=[];
    flattenFacts(wealthCalc.data, wealthCalc.key, facts, {nodes:0});
    const chosen=facts.slice(0,4);
    if (chosen.length) {
      contributions.Wealth = 8;
      sourceGroups.add("Wealth analysis");
      signals.push(createSignal("Wealth analysis", `AstroLogics supplied a separate wealth-analysis calculation with ${chosen.length} readable summary field(s).`, 8));
    }
  }

  const totalPoints = Object.values(contributions).reduce((sum, value) => sum + value, 0);
  const sourceCount = sourceGroups.size;
  const score = sourceCount >= 2 ? Math.max(30, Math.min(95, 42 + totalPoints)) : null;
  const strongNames = strong.map(x => ({ planet: x.planet, statusSource: x.statusSource, sourcePath: x.sourcePath }));
  const weakNames = weak.map(x => ({ planet: x.planet, statusSource: x.statusSource, sourcePath: x.sourcePath }));
  const moderateNames = moderate.map(x => ({ planet: x.planet, statusSource: x.statusSource, sourcePath: x.sourcePath }));

  const traditionalStrengths = [];
  const areasToManage = [];
  const chartRows = [
    ...d1Relevant.map(p => ({...p, chartLabel:"D1 · Rashi"})),
    ...specialRelevant.map(p => ({...p, chartLabel:`${profile.divisional} · ${CHARTS[profile.divisional].label}`}))
  ];
  const themeText = {
    education: "supports structured learning, concentration or the pursuit of knowledge",
    marriage: "brings attention to commitment, partnership expectations and relationship dynamics",
    finance: "connects with earnings, resource management or financial discipline",
    travel: "draws attention to travel, movement, relocation or wider horizons",
    overall: "contributes to the broader life themes represented by this house"
  }[topic];
  chartRows.forEach(p => {
    traditionalStrengths.push({ source: p.chartLabel, planet: p.planetLabel, text: `${p.planetLabel}${p.sign ? ` in ${p.sign}` : ""} in house ${p.house} ${themeText}. ${p.houseSource === "derived_from_whole_sign_lagna" ? "This house is derived using whole-sign houses from the divisional chart Lagna." : "The house is provider-supplied."}` });
    if (p.planet === "saturn" || p.planet === "rahu" || p.planet === "ketu" || p.planet === "mars") {
      areasToManage.push({ source: p.chartLabel, planet: p.planetLabel, text: `${p.planetLabel}${p.sign ? ` in ${p.sign}` : ""} in house ${p.house} may make this area require patience, balance or deliberate decisions in a traditional reading. It is a caution to manage thoughtfully, not a denial of the outcome.` });
    }
  });
  weak.forEach(p => areasToManage.push({ source:"Planetary strength", planet:p.planet, text:`AstroLogics explicitly marked ${p.planet} as weak in its returned strength status. Interpret this alongside the complete chart; it does not by itself decide the outcome.` }));
  strong.forEach(p => traditionalStrengths.push({ source:"Planetary strength", planet:p.planet, text:`AstroLogics explicitly marked ${p.planet} as strong in the returned strength status.` }));
  if (!areasToManage.length && moderate.length) areasToManage.push({ source:"Planetary strength", text:`The returned formal strength data marks ${moderate.map(x=>x.planet).join(", ")} as moderate/neutral. No adverse conclusion is inferred from that label alone.` });

  const formalStrengthNote = strengths.length
    ? "Formal strong/weak/moderate labels below are taken only from readable AstroLogics strength-status fields."
    : "AstroLogics did not return readable formal strong/weak/moderate statuses for the relevant planets. Placement-based observations are traditional interpretations, not measured Shadbala.";
  const baseAssessment = {
    score,
    label: score == null ? "Not enough independent evidence to score" : labelForScore(score),
    status: score == null ? "withheld" : weak.length ? "mixed_evidence" : "scored",
    signalCount: signals.length,
    sourceCount,
    contributions,
    signals,
    message: score == null
      ? `A ${profile.label.toLowerCase()} indication index is withheld because fewer than two independent structured evidence groups were found. Available factors can still be discussed qualitatively.`
      : `A traditional ${profile.label.toLowerCase()} indication index based on ${sourceCount} independent evidence groups. It is not a real-world probability or guarantee.`,
    sourceGroups: [...sourceGroups]
  };

  const validPeriods = dashaPeriods.filter(p => p.withinParentDates !== false && ["past","active","upcoming"].includes(p.dateStatus));
  const dashaWindows = validPeriods.map(period => {
    const hierarchy = [ ...(period.parentHierarchy || []).map(parent => ({level:parent.level, planet:parent.lordLabel, startDate:parent.startDate, endDate:parent.endDate})), {level:period.level, planet:period.lordLabel, startDate:period.startDate, endDate:period.endDate} ];
    const activeLords = [...new Set([...(period.parentHierarchy || []).map(x=>x.lord), period.lord].filter(Boolean))];
    const links = activeLords.filter(lord => supportedPlanets.has(lord));
    const isRecognized = ["Mahadasha","Antardasha","Pratyantardasha"].includes(period.level);
    const periodScore = baseAssessment.score != null && isRecognized && links.length
      ? Math.min(100, Math.max(25, baseAssessment.score + Math.min(12, links.length * 4) - weak.filter(x=>links.includes(x.planet)).length * 3))
      : null;
    return {
      planet: period.lordLabel, level: period.level, period: period.level,
      startDate: period.startDate, endDate: period.endDate, dateStatus: period.dateStatus,
      dateStatusLabel: period.dateStatus === "past" ? "Past period (historical context)" : period.dateStatus === "active" ? "Currently active" : "Upcoming",
      recognizedLevel: isRecognized, hierarchy, parentHierarchy: hierarchy.slice(0,-1), hierarchyLabel: period.hierarchyLabel,
      activeLords: activeLords.map(x=>x.charAt(0).toUpperCase()+x.slice(1)),
      indicationScore: periodScore, classification: periodScore == null ? "Not scored — insufficient topic-specific activation" : labelForScore(periodScore),
      evidenceSources: links.length ? ["Dasha activation", ...sourceGroups] : [],
      signals: links.map(lord=>createSignal("Dasha activation", `${lord} is active in this ${period.level} chain and is explicitly connected to the supplied ${profile.label.toLowerCase()} chart evidence.`, 4)),
      note: periodScore == null ? "This dated period is retained in the timeline, but it is not ranked as a favourable opportunity because no sufficient topic-specific link was found." : "Period-specific traditional indication index. The period is recomputed from its own explicit Dasha hierarchy; no parent score is copied to a child period."
    };
  }).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.hierarchy.length-b.hierarchy.length);
  const eligible = dashaWindows.filter(w=>w.recognizedLevel && w.indicationScore != null && w.indicationScore >= 60);
  const rank = rows => rows.slice().sort((a,b)=>(b.indicationScore??-1)-(a.indicationScore??-1)||b.hierarchy.length-a.hierarchy.length||a.startDate.localeCompare(b.startDate));
  const opportunitySummary = {
    referenceDate,
    currentWindows: rank(eligible.filter(w=>w.dateStatus === "active")).slice(0,5),
    upcomingWindows: rank(eligible.filter(w=>w.dateStatus === "upcoming")).slice(0,5),
    strongestHistoricalWindow: rank(eligible.filter(w=>w.dateStatus === "past"))[0] || null,
    note: "Only recognized dated periods with a topic-specific score of at least 60 are ranked. Historical periods are context only and are never promoted as future opportunities."
  };

  return {
    topic, topicLabel:profile.label, overall:baseAssessment,
    strengthWeakness: {
      calculationAvailable: Boolean(findCalculation(index,"strength")?.available),
      explicitStatusesFound: relevantStrengths.length,
      strongPlanets: strongNames, weakPlanets: weakNames, moderatePlanets: moderateNames,
      supportiveFactors: signals.filter(x=>x.kind !== "challenge").slice(0,8).map(x=>({source:x.source,text:x.description})),
      challengeFactors: signals.filter(x=>x.kind === "challenge").map(x=>({source:x.source,text:x.description})),
      traditionalStrengths, areasToManage,
      interpretiveSummary: `${profile.label}: ${score == null ? "the available structured evidence is not sufficient for a numeric traditional indication index" : `${score}/100 (${labelForScore(score)})`}. ${formalStrengthNote}`,
      strengthDataNote: formalStrengthNote
    },
    dashaWindows,
    opportunitySummary,
    sourceAvailability: { D1:!!d1.usable, divisionalChart:profile.divisional, divisionalAvailable:!!special.usable, yogas:!!yogaCalc?.available, strength:!!strengthCalc?.available, wealth:!!wealthCalc?.available, dashaPeriods:validPeriods.length },
    interpretationNote: "All scores are transparent traditional-indication indices, not probabilities, guarantees or predictions of real-world outcomes."
  };
}

function analyzeVedicReport(report, requestedTopic = "overall", question = "", options = {}) {
  if (!isObject(report) || !isObject(report.calculations)) {
    throw new TypeError("A valid AstroLogics report with calculations is required.");
  }
  const detection = question ? topicFromQuestion(question, requestedTopic) : { topic: TOPICS[requestedTopic] ? requestedTopic : "overall", intent: null };
  const topic = detection.topic;
  const config = TOPICS[topic];
  const index = getCalculationIndex(report.calculations);
  const chartData = buildChartData(index);
  const dashaCalculation = findCalculation(index, "dasha");
  const currentDashaCalculation = findCalculation(index, "currentDasha");
  const periods = [
    ...(dashaCalculation?.available ? extractDashaPeriods(dashaCalculation.data) : []),
    ...(currentDashaCalculation?.available ? extractDashaPeriods(currentDashaCalculation.data) : [])
  ];
  // Merge repeated intervals from the full timeline and current-Dasha summary.
  // The canonical interval identity avoids showing the same Saturn dates twice
  // when one payload branch calls it Antardasha and another calls it generic Dasha.
  const allPeriods = mergeDashaPeriods(periods);
  const { referenceDate, timeZone } = resolveReference(options);
  const uniquePeriods = allPeriods.map(period => ({
    ...period,
    dateStatus: classifyPeriodDate(period.startDate, period.endDate, referenceDate)
  }));
  const invalidHierarchyPeriods = uniquePeriods.filter(period => period.withinParentDates === false);
  const activeOrUpcomingPeriods = uniquePeriods.filter(period =>
    (period.dateStatus === "active" || period.dateStatus === "upcoming") &&
    period.withinParentDates !== false
  );
  const currentDashaChain = selectCurrentDashaChain(activeOrUpcomingPeriods, referenceDate);
  const evidence = buildEvidence(index, config, chartData, activeOrUpcomingPeriods);

  const availableSources = config.sources.filter(name => Boolean(findCalculation(index, name)?.available));
  const coverage = {
    available: availableSources.length,
    expected: config.sources.length,
    percentage: config.sources.length ? Math.round((availableSources.length / config.sources.length) * 100) : 0,
    availableSources: availableSources.map(name => SOURCE_GROUPS[name].label),
    missingSources: config.sources.filter(name => !availableSources.includes(name)).map(name => SOURCE_GROUPS[name].label),
    evidenceCount: evidence.length,
    meaning: "Calculation-data availability only; not probability, certainty or prediction strength."
  };

  const careerAssessment = topic === "career" ? assessCareer(report, index, chartData, uniquePeriods, referenceDate) : null;
  const topicAssessment = DOMAIN_PROFILES[topic] ? assessDomainTopic(topic, index, chartData, uniquePeriods, referenceDate) : null;
  const requiredChart = topic === "dasha" ? []
    : topic === "career" ? ["D1", "D10"]
    : topic === "education" ? ["D1", "D24"]
    : topic === "marriage" ? ["D1", "D9"]
    : topic === "finance" ? ["D1", "D2"]
    : topic === "travel" ? ["D1", "D4"] : ["D1"];

  return {
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    system: report.system || "vedic",
    reportType: report.reportType || "phaladesh",
    topic,
    topicLabel: config.label,
    intent: detection.intent,
    referenceDate,
    referenceTimeZone: timeZone,
    currentDashaChain,
    coverage,
    chartAvailability: Object.fromEntries(Object.entries(chartData).map(([code, chart]) => [code, {
      available: chart.available,
      usable: chart.usable,
      label: chart.label,
      planetPlacementsFound: chart.planets.length,
      housePlacementsFound: chart.housePlacementsFound,
      houseCoverage: chart.houseCoverage,
      houseSources: chart.houseSources,
      houseLordRecordsFound: chart.houseLords.length
    }])),
    missingChartComponents: requiredChart.filter(code => !chartData[code].usable),
    chartDiagnostics: Object.fromEntries(Object.entries(chartData).map(([code, chart]) => [code, {
      objectFound: chart.available,
      usable: chart.usable,
      planetPlacementsFound: chart.planetPlacementsFound,
      housePlacementsFound: chart.housePlacementsFound,
      houseCoverage: chart.houseCoverage,
      houseSources: chart.houseSources
    }])),
    invalidDashaPeriods: invalidHierarchyPeriods.map(period => ({
      lord: period.lordLabel,
      level: period.level,
      startDate: period.startDate,
      endDate: period.endDate,
      hierarchyLabel: period.hierarchyLabel,
      reason: "Child period dates fall outside the explicit parent period."
    })),
    evidence,
    careerAssessment,
    topicAssessment,
    dashaTimeline: topic === "dasha" ? uniquePeriods.filter(period => period.withinParentDates !== false).slice(0, LIMITS.maxDashaPeriods).map(period => {
      const hierarchy = [ ...(period.parentHierarchy || []).map(parent => ({ level: parent.level, planet: parent.lordLabel, startDate: parent.startDate, endDate: parent.endDate })), { level: period.level, planet: period.lordLabel, startDate: period.startDate, endDate: period.endDate } ];
      return {
        planet: period.lordLabel, level: period.level, period: period.level,
        startDate: period.startDate, endDate: period.endDate, dateStatus: period.dateStatus,
        dateStatusLabel: period.dateStatus === "past" ? "Past period (historical context)" : period.dateStatus === "active" ? "Currently active" : "Upcoming",
        recognizedLevel: ["Mahadasha", "Antardasha", "Pratyantardasha"].includes(period.level),
        hierarchy, parentHierarchy: hierarchy.slice(0, -1), hierarchyLabel: period.hierarchyLabel,
        hierarchyValid: period.withinParentDates !== false
      };
    }) : null,
    dashaTimelineSummary: careerAssessment?.timelineSummary || null,
    dashaPeriods: uniquePeriods.filter(period => period.withinParentDates !== false).slice(0, LIMITS.maxDashaPeriods),
    activeOrUpcomingDashaPeriods: activeOrUpcomingPeriods.slice(0, LIMITS.maxDashaPeriods),
    expiredDashaPeriodsExcluded: uniquePeriods.filter(period => period.dateStatus === "past").length,
    historicalDashaPeriodsIncluded: uniquePeriods.filter(period => period.dateStatus === "past" && period.withinParentDates !== false).length,
    limitations: [
      "The engine only organizes AstroLogics results; it does not calculate planetary positions, house lords, yogas or Dasha dates.",
      "A chart score is a traditional-indication index, not an empirically calibrated probability of a real-world event.",
      "No chart placement or date is inferred when the provider omits it.",
      "All valid Dasha windows returned by AstroLogics are retained as historical, active or upcoming periods. Past periods are historical context only and are excluded from future-opportunity ranking.",
      "Dasha windows are shown only when explicit period dates and planet lords are returned."
    ]
  };
}

function detectTopic(question, fallback = "overall") {
  return topicFromQuestion(question, fallback).topic;
}

function compactContextValue(value, depth = 0) {
  if (value == null) return null;
  if (typeof value === "string") return cleanText(value, 150);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 2) return Array.isArray(value) ? `[${value.length} items]` : "[details omitted]";
  if (Array.isArray(value)) {
    return value.slice(0, 4).map(item => compactContextValue(item, depth + 1));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).slice(0, 6)
        .map(([key, item]) => [key, compactContextValue(item, depth + 1)])
    );
  }
  return String(value).slice(0, 100);
}

function compactAssessmentPart(part) {
  if (!part) return null;
  return {
    score: part.score ?? null,
    label: cleanText(part.label, 90),
    signalCount: part.signalCount ?? 0,
    sourceCount: part.sourceCount ?? 0,
    status: part.status || "withheld",
    contributions: part.contributions || {},
    message: cleanText(part.message, 220),
    signals: (part.signals || []).slice(0, 7).map(signal => ({
      source: cleanText(signal.source, 50),
      description: cleanText(signal.description, 190),
      points: signal.points,
      kind: signal.kind
    }))
  };
}

function buildAIContext(report, requestedTopic = "overall", question = "", options = {}) {
  const analysis = analyzeVedicReport(report, requestedTopic, question, options);

  const evidence = [...analysis.evidence];
  if (analysis.topic === "career") {
    const priority = source => {
      const key = normalizeKey(source);
      if (key === "d1" || key === "d10") return 0;
      if (key.includes("vimshottari") || key.includes("currentdasha")) return 1;
      if (key.includes("yoga")) return 2;
      if (key.includes("planetarystrength") || key.includes("shadbala")) return 3;
      return 4;
    };
    evidence.sort((a, b) => priority(a.source) - priority(b.source));
  }

  const compactEvidence = evidence.slice(0, analysis.topic === "career" ? 32 : 24).map(item => ({
    source: cleanText(item.source, 45),
    field: cleanText(item.field, 70),
    path: cleanText(item.path, 90),
    value: compactContextValue(item.value)
  }));

  const assessment = analysis.careerAssessment;
  const compactCareerAssessment = assessment ? {
    career: compactAssessmentPart(assessment.career),
    governmentService: compactAssessmentPart(assessment.governmentService),
    strengthWeakness: assessment.strengthWeakness ? {
      calculationAvailable: assessment.strengthWeakness.calculationAvailable,
      explicitStatusesFound: assessment.strengthWeakness.explicitStatusesFound,
      strongPlanets: (assessment.strengthWeakness.strongPlanets || []).slice(0, 12).map(x => ({ planet: x.planet, statusSource: x.statusSource, sourcePath: x.sourcePath })),
      weakPlanets: (assessment.strengthWeakness.weakPlanets || []).slice(0, 12).map(x => ({ planet: x.planet, statusSource: x.statusSource, sourcePath: x.sourcePath })),
      moderatePlanets: (assessment.strengthWeakness.moderatePlanets || []).slice(0, 12).map(x => ({ planet: x.planet, statusSource: x.statusSource, sourcePath: x.sourcePath })),
      supportiveFactors: (assessment.strengthWeakness.supportiveFactors || []).slice(0, 6),
      challengeFactors: (assessment.strengthWeakness.challengeFactors || []).slice(0, 6),
      traditionalStrengths: (assessment.strengthWeakness.traditionalStrengths || []).slice(0, 10),
      areasToManage: (assessment.strengthWeakness.areasToManage || []).slice(0, 8),
      interpretiveSummary: cleanText(assessment.strengthWeakness.interpretiveSummary, 1100),
      strengthDataNote: cleanText(assessment.strengthWeakness.strengthDataNote, 300)
    } : null,
    opportunitySummary: assessment.opportunitySummary || null,
    dashaWindows: (assessment.dashaWindows || []).slice(0, LIMITS.maxDashaPeriods).map(window => ({
      period: cleanText(window.period, 45),
      level: cleanText(window.level || window.period, 45),
      windowType: cleanText(window.windowType || window.level || window.period, 55),
      scoreBasis: window.scoreBasis || null,
      careerPeriodBasis: window.careerPeriodBasis || null,
      governmentPeriodBasis: window.governmentPeriodBasis || null,
      planet: cleanText(window.planet, 30),
      startDate: window.startDate,
      endDate: window.endDate,
      dateStatus: window.dateStatus,
      dateStatusLabel: window.dateStatusLabel,
      referenceDate: window.referenceDate,
      recognizedLevel: window.recognizedLevel,
      parentHierarchy: (window.parentHierarchy || []).slice(0, 3).map(parent => ({
        level: cleanText(parent.level, 40),
        planet: cleanText(parent.planet, 25),
        startDate: parent.startDate,
        endDate: parent.endDate
      })),
      hierarchy: (window.hierarchy || []).slice(0, 4).map(parent => ({
        level: cleanText(parent.level, 40),
        planet: cleanText(parent.planet, 25),
        startDate: parent.startDate,
        endDate: parent.endDate
      })),
      hierarchyLabel: cleanText(window.hierarchyLabel, 150),
      hierarchyValid: window.hierarchyValid !== false,
      activeLords: (window.activeLords || []).slice(0, 4),
      careerIndicationScore: window.careerIndicationScore ?? null,
      careerClassification: cleanText(window.careerClassification, 90),
      governmentServiceIndicationScore: window.governmentServiceIndicationScore ?? null,
      governmentServiceClassification: cleanText(window.governmentServiceClassification, 90),
      careerEvidenceSources: (window.careerEvidenceSources || []).slice(0, 3),
      governmentEvidenceSources: (window.governmentEvidenceSources || []).slice(0, 3),
      careerEvidenceSourceCount: window.careerEvidenceSourceCount ?? 0,
      governmentEvidenceSourceCount: window.governmentEvidenceSourceCount ?? 0,
      careerPeriodSignals: (window.careerPeriodSignals || []).slice(0, 4).map(signal => ({
        source: cleanText(signal.source, 45), description: cleanText(signal.description, 150), points: signal.points, kind: signal.kind
      })),
      governmentPeriodSignals: (window.governmentPeriodSignals || []).slice(0, 4).map(signal => ({
        source: cleanText(signal.source, 45), description: cleanText(signal.description, 150), points: signal.points, kind: signal.kind
      })),
      careerNote: cleanText(window.careerNote, 190),
      governmentServiceNote: cleanText(window.governmentServiceNote, 190)
    })),
    timelineSummary: assessment.timelineSummary,
    sourceAvailability: assessment.sourceAvailability,
    interpretationNote: cleanText(assessment.interpretationNote, 230)
  } : null;

  return {
    engine: analysis.engine,
    engineVersion: analysis.version,
    system: analysis.system,
    reportType: analysis.reportType,
    topic: analysis.topic,
    topicLabel: analysis.topicLabel,
    intent: analysis.intent,
    referenceDate: analysis.referenceDate,
    referenceTimeZone: analysis.referenceTimeZone,
    currentDashaChain: analysis.currentDashaChain,
    dashaActivation: analysis.careerAssessment?.dashaActivation || null,
    expiredDashaPeriodsExcluded: analysis.expiredDashaPeriodsExcluded,
    historicalDashaPeriodsIncluded: analysis.historicalDashaPeriodsIncluded,
    invalidDashaPeriods: analysis.invalidDashaPeriods,
    chartDiagnostics: analysis.chartDiagnostics,
    question: cleanText(question, 500),
    dataCoverage: {
      available: analysis.coverage.available,
      expected: analysis.coverage.expected,
      percentage: analysis.coverage.percentage,
      availableSources: analysis.coverage.availableSources.slice(0, 8),
      missingSources: analysis.coverage.missingSources.slice(0, 8),
      meaning: analysis.coverage.meaning
    },
    chartAvailability: analysis.chartAvailability,
    chartPlacements: compactEvidence.filter(item => ["D1", "D2", "D4", "D9", "D10", "D24"].includes(item.source)),
    missingChartComponents: analysis.missingChartComponents,
    careerAssessment: compactCareerAssessment,
    dashaTimeline: analysis.dashaTimeline || null,
    topicAssessment: analysis.topicAssessment ? {
      topic: analysis.topicAssessment.topic,
      topicLabel: analysis.topicAssessment.topicLabel,
      overall: compactAssessmentPart(analysis.topicAssessment.overall),
      strengthWeakness: {
        calculationAvailable: analysis.topicAssessment.strengthWeakness.calculationAvailable,
        explicitStatusesFound: analysis.topicAssessment.strengthWeakness.explicitStatusesFound,
        strongPlanets: analysis.topicAssessment.strengthWeakness.strongPlanets.slice(0, 8),
        weakPlanets: analysis.topicAssessment.strengthWeakness.weakPlanets.slice(0, 8),
        moderatePlanets: analysis.topicAssessment.strengthWeakness.moderatePlanets.slice(0, 8),
        traditionalStrengths: analysis.topicAssessment.strengthWeakness.traditionalStrengths.slice(0, 8),
        areasToManage: analysis.topicAssessment.strengthWeakness.areasToManage.slice(0, 8),
        supportiveFactors: analysis.topicAssessment.strengthWeakness.supportiveFactors.slice(0, 6),
        challengeFactors: analysis.topicAssessment.strengthWeakness.challengeFactors.slice(0, 6),
        interpretiveSummary: cleanText(analysis.topicAssessment.strengthWeakness.interpretiveSummary, 700),
        strengthDataNote: cleanText(analysis.topicAssessment.strengthWeakness.strengthDataNote, 280)
      },
      opportunitySummary: {
        referenceDate: analysis.topicAssessment.opportunitySummary.referenceDate,
        currentWindows: analysis.topicAssessment.opportunitySummary.currentWindows.slice(0, 4),
        upcomingWindows: analysis.topicAssessment.opportunitySummary.upcomingWindows.slice(0, 4),
        strongestHistoricalWindow: analysis.topicAssessment.opportunitySummary.strongestHistoricalWindow
      },
      dashaWindows: analysis.topicAssessment.dashaWindows.slice(0, LIMITS.maxDashaPeriods),
      sourceAvailability: analysis.topicAssessment.sourceAvailability,
      interpretationNote: analysis.topicAssessment.interpretationNote
    } : null,
    dashaPeriods: (analysis.topic === "dasha"
      ? analysis.activeOrUpcomingDashaPeriods.slice(0, 12)
      : analysis.dashaPeriods.slice(0, 10)).map(period => ({
      lord: period.lord,
      lordLabel: period.lordLabel,
      level: period.level,
      startDate: period.startDate,
      endDate: period.endDate,
      dateStatus: period.dateStatus,
      parentHierarchy: (period.parentHierarchy || []).slice(0, 3),
      hierarchyLabel: period.hierarchyLabel,
      withinParentDates: period.withinParentDates
    })),
    evidence: compactEvidence,
    limitations: analysis.limitations.slice(0, 4),
    interpretationRules: [
      "Use only supplied evidence. Never invent placements, yogas, Dasha lords or dates.",
      "Keep D1, D2 (Hora), D4 (Chaturthamsha), D9 (Navamsa), D10 (Dashamsha) and D24 (Chaturvimshamsha) separate.",
      "Label derived whole-sign houses as derived, not provider-returned.",
      "Scores are traditional-indication indices, never real-world probabilities.",
      "Withheld scores must remain withheld; explain which evidence is missing.",
      "The reference date is supplied in referenceDate and must govern every present/future statement.",
      "The Dasha timeline includes every valid dated period returned by AstroLogics, including historical, active and upcoming periods. Label historical periods as past context only; never recommend them as future opportunities.",
      "Show the supplied Dasha timings in chronological order, grouped into past history, current/active periods, and upcoming periods. Then separately highlight the best-supported upcoming periods from referenceDate onward.",
      "A favourable period means its supplied career/government indication score is at least 60. A golden/particularly strong period requires a score of at least 80. Do not rank an unscored period as the strongest opportunity.",
      "Unclassified dated periods may be listed as unclassified provider timing records, but must not be relabelled as Mahadasha, Antardasha or Pratyantardasha and must not be scored.",
      "A child-period score is calculated separately from its explicit parent lords; never copy a parent Mahadasha score to an Antardasha or Pratyantardasha.",
      "Preserve Mahadasha → Antardasha → Pratyantardasha hierarchy and parent-child date checks exactly as extracted.",
      "Do not call a period golden or a breakthrough window unless its supplied indication score is at least 80/100."
    ]
  };
}

module.exports = {
  ENGINE_NAME,
  ENGINE_VERSION,
  TOPICS,
  detectTopic,
  analyzeVedicReport,
  buildAIContext,
  // Exported for automated tests and future provider-shape adapters.
  findNamedDivisionalChart,
  extractDashaPeriods,
  mergeDashaPeriods,
  extractStrengthSignals,
  assessDomainTopic,
  extractPlanetRecords,
  deriveWholeSignHouse,
  dateInTimeZone,
  classifyPeriodDate
};
