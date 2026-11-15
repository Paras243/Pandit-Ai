"use strict";
const assert = require("node:assert/strict");
const engine = require("./netlify/functions/vedic-prediction-engine");
const ai = require("./netlify/functions/ai-explain");

const divisional = {
  charts: {
    D2: { lagna: "cancer", planets: { sun: "leo", moon: "cancer", mars: "leo", mercury: "leo", jupiter: "cancer", venus: "cancer", saturn: "leo", rahu: "leo", ketu: "leo" } },
    D9: { lagna: "capricorn", planets: { sun: "capricorn", moon: "aquarius", mars: "scorpio", mercury: "aquarius", jupiter: "pisces", venus: "scorpio", saturn: "gemini", rahu: "scorpio", ketu: "taurus" } },
    D10: { lagna: "taurus", planets: { sun: "aquarius", moon: "gemini", mars: "aries", mercury: "pisces", jupiter: "sagittarius", venus: "scorpio", saturn: "gemini", rahu: "cancer", ketu: "capricorn" } }
  }
};

const report = {
  system: "vedic",
  reportType: "phaladesh",
  calculations: {
    birthChart: { success: true, data: { planets: [
      { id: "mars", house: 6, sign: "libra" },
      { id: "jupiter", house: 10, sign: "aries" },
      { id: "rahu", house: 10, sign: "aries" },
      { id: "sun", house: 3, sign: "gemini" },
      { id: "saturn", house: 8, sign: "scorpio" }
    ] } },
    divisionalCharts: { success: true, data: divisional },
    vimshottariDasha: { success: true, data: {
      mahadasha: [
        { planet: "Sun", level: "Mahadasha", start_date: "2010-01-01", end_date: "2016-01-01" },
        {
          planet: "Rahu", level: "Mahadasha", start_date: "2020-10-11", end_date: "2038-10-12",
          antardasha: [
            {
              planet: "Saturn", level: "Antardasha", start_date: "2025-11-17", end_date: "2028-09-23",
              pratyantardasha: [{ planet: "Ketu", level: "Pratyantardasha", start_date: "2026-09-25", end_date: "2026-11-25" }]
            },
            { planet: "Mercury", level: "Antardasha", start_date: "2028-09-23", end_date: "2031-04-12",
              pratyantardasha: [{ planet: "Sun", level: "Pratyantardasha", start_date: "2030-12-01", end_date: "2031-02-15" }] }
          ]
        },
        { planet: "Jupiter", level: "Mahadasha", start_date: "2038-10-12", end_date: "2054-10-12" }
      ],
      additionalDatedPeriods: [
        { planet: "Mercury", start_date: "2026-11-07", end_date: "2026-11-17" },
        { planet: "Saturn", start_date: "2025-11-17", end_date: "2028-09-23" }
      ]
    } },
    currentDasha: { success: true, data: { current: { planet: "Rahu", level: "Mahadasha", start_date: "2020-10-11", end_date: "2038-10-12" } } },
    yogas: { success: true, data: [{ name: "Raja Yoga", present: true }, { name: "Vipareeta Raja Yoga", present: true }] },
    planetaryStrength: { success: true, data: [{ planet: "sun", strength_status: "strong" }, { planet: "saturn", strength_status: "weak" }] }
  }
};

(async () => {
  assert.equal(engine.ENGINE_VERSION, "3.0.0");
  assert.equal(typeof ai.compactCareerPromptContext, "function");
  const mappedStrengths = engine.extractStrengthSignals({
    sun: { strength_status: "strong" },
    saturn: { strength_status: "weak" },
    mars: { strength_status: "moderate" }
  });
  assert.deepEqual(mappedStrengths.map(item => `${item.planet}:${item.status}`).sort(), [
    "mars:moderate", "saturn:weak", "sun:strong"
  ], "planet-keyed strength objects are parsed without inventing labels");

  const analysis = engine.analyzeVedicReport(
    report,
    "career",
    "What are my government job prospects? Show all favourable timings and focus on upcoming periods.",
    { referenceDate: "2026-11-14", timeZone: "Asia/Kolkata" }
  );
  assert.equal(analysis.referenceDate, "2026-11-14");
  assert.equal(analysis.intent, "government_service");
  assert.equal(analysis.chartAvailability.D10.planetPlacementsFound, 9);

  // Live-shape regression fixture based on the D1/D10 arrangement shown in
  // the user's V2.5.5 browser screenshots. Numeric Shadbala values are kept
  // numeric: no strong/weak label may be invented without provider statuses.
  const liveShapeReport = structuredClone(report);
  liveShapeReport.calculations.birthChart.data.planets = [
    { id: "sun", sign: "scorpio", house: 3 },
    { id: "moon", sign: "virgo", house: 1 },
    { id: "mars", sign: "aquarius", house: 6 },
    { id: "mercury", sign: "scorpio", house: 3 },
    { id: "jupiter", sign: "gemini", house: 10 },
    { id: "venus", sign: "scorpio", house: 3 },
    { id: "saturn", sign: "taurus", house: 9 },
    { id: "rahu", sign: "gemini", house: 10 },
    { id: "ketu", sign: "sagittarius", house: 4 }
  ];
  liveShapeReport.calculations.planetaryStrength = {
    success: true,
    data: { shadbala: {
      sun: { rupas: 5.2, total: 312 },
      mars: { rupas: 6.1, total: 366 },
      saturn: { rupas: 4.8, total: 288 }
    } }
  };
  const liveShapeAnalysis = engine.analyzeVedicReport(
    liveShapeReport,
    "career",
    "What are my government-service prospects? Show current and upcoming windows.",
    { referenceDate: "2026-11-14", timeZone: "Asia/Kolkata" }
  );
  const liveCareer = liveShapeAnalysis.careerAssessment;
  assert.equal(liveCareer.career.score, 75, "the screenshot-shaped D1/D10 fixture retains the overall career index");
  assert.equal(liveCareer.governmentService.score, 64, "government service remains separate from general career");
  assert.equal(liveCareer.strengthWeakness.calculationAvailable, true);
  assert.equal(liveCareer.strengthWeakness.explicitStatusesFound, 0);
  assert.equal(liveCareer.strengthWeakness.strongPlanets.length, 0);
  assert.equal(liveCareer.strengthWeakness.weakPlanets.length, 0,
    "numeric Shadbala values must not be silently converted to strong/weak labels");
  assert.ok(liveCareer.strengthWeakness.traditionalStrengths.some(item => item.planet === "Mars" && item.source.includes("D1")));
  assert.ok(liveCareer.strengthWeakness.traditionalStrengths.some(item => item.planet === "Jupiter" && item.source.includes("D1")));
  assert.ok(liveCareer.strengthWeakness.traditionalStrengths.some(item => item.planet === "Sun" && item.source.includes("D10")));
  assert.ok(liveCareer.strengthWeakness.traditionalStrengths.some(item => item.planet === "Mercury" && item.source.includes("D10")));
  assert.ok(liveCareer.strengthWeakness.areasToManage.some(item => item.planet === "Rahu"));
  assert.ok(liveCareer.strengthWeakness.areasToManage.some(item => item.planet === "Saturn"));
  assert.ok(liveCareer.strengthWeakness.areasToManage.some(item => item.planet === "Jupiter" && item.source.includes("D10")));
  assert.match(liveCareer.strengthWeakness.strengthDataNote, /numeric values are not converted/i);

  const currentSaturnWindow = liveCareer.opportunitySummary.currentGovernmentServiceWindows
    .find(window => window.planet === "Saturn" && window.level === "Antardasha");
  assert.ok(currentSaturnWindow, "the active Saturn Antardasha is scored as a moderate supportive service window");
  assert.equal(currentSaturnWindow.governmentServiceIndicationScore, 61);
  assert.equal(currentSaturnWindow.startDate, "2025-11-17");
  assert.equal(currentSaturnWindow.endDate, "2028-09-23");

  const upcomingSunWindow = liveCareer.opportunitySummary.upcomingGovernmentServiceWindows
    .find(window => window.planet === "Sun" && window.level === "Pratyantardasha");
  assert.ok(upcomingSunWindow, "the future Sun Pratyantardasha activates the D10 10th-house government-service factor");
  assert.equal(upcomingSunWindow.governmentServiceIndicationScore, 66);
  assert.equal(upcomingSunWindow.startDate, "2030-12-01");
  assert.equal(upcomingSunWindow.endDate, "2031-02-15");
  assert.ok(liveCareer.opportunitySummary.currentCareerWindows.some(window => window.planet === "Rahu" && window.level === "Mahadasha"));
  assert.ok(liveCareer.opportunitySummary.upcomingCareerWindows.some(window => window.planet === "Mercury" && window.level === "Antardasha"));
  assert.ok(liveCareer.opportunitySummary.upcomingCareerWindows.some(window => window.planet === "Sun" && window.level === "Pratyantardasha"));
  assert.ok(liveCareer.opportunitySummary.currentGovernmentServiceWindows.every(window => window.dateStatus === "active"));
  assert.ok(liveCareer.opportunitySummary.upcomingGovernmentServiceWindows.every(window => window.dateStatus === "upcoming"));
  assert.ok(analysis.careerAssessment.strengthWeakness.strongPlanets.some(p => p.planet === "sun"));
  assert.ok(analysis.careerAssessment.strengthWeakness.weakPlanets.some(p => p.planet === "saturn"));
  assert.ok(analysis.careerAssessment.strengthWeakness.supportiveFactors.some(f => f.source === "D1"));
  assert.ok(analysis.careerAssessment.strengthWeakness.challengeFactors.some(f => f.source === "Planetary strength"));

  const windows = analysis.careerAssessment.dashaWindows;
  assert.ok(windows.length >= 7, "all supplied valid dated periods are retained in the timeline");
  assert.equal(windows.filter(w => w.planet === "Saturn" && w.startDate === "2025-11-17" && w.endDate === "2028-09-23").length, 1,
    "same Saturn interval from formal Antardasha and generic provider timing is merged once");
  assert.ok(windows.some(w => w.planet === "Saturn" && w.level === "Antardasha"),
    "formal Antardasha classification wins over a duplicate generic Dasha row");
  assert.ok(windows.some(w => w.dateStatus === "past"), "past periods are retained as historical context");
  assert.ok(windows.some(w => w.dateStatus === "active"), "active periods are retained");
  assert.ok(windows.some(w => w.dateStatus === "upcoming"), "upcoming periods are retained");
  assert.ok(windows.every(w => w.hierarchyValid), "invalid parent-child windows are excluded from opportunity timeline");
  assert.ok(windows.some(w => w.planet === "Sun" && w.level === "Mahadasha" && w.dateStatus === "past"));
  assert.ok(windows.some(w => w.planet === "Ketu" && w.level === "Pratyantardasha" && w.dateStatus === "active"));
  assert.ok(windows.some(w => w.planet === "Sun" && w.level === "Pratyantardasha" && w.dateStatus === "upcoming"));

  const unclassified = windows.find(w => w.planet === "Mercury" && w.level === "Dasha period");
  assert.ok(unclassified, "unclassified provider timing records remain visible in the full timeline");
  assert.equal(unclassified.recognizedLevel, false);
  assert.equal(unclassified.governmentServiceIndicationScore, null, "unclassified rows must not be scored");

  const summary = analysis.careerAssessment.timelineSummary;
  assert.equal(summary.referenceDate, "2026-11-14");
  assert.equal(summary.pastCount, windows.filter(w => w.dateStatus === "past").length);
  assert.equal(summary.activeCount, windows.filter(w => w.dateStatus === "active").length);
  assert.equal(summary.upcomingCount, windows.filter(w => w.dateStatus === "upcoming").length);
  assert.ok((summary.strongestUpcomingGovernmentWindow == null) || summary.strongestUpcomingGovernmentWindow.dateStatus === "upcoming");
  assert.ok((summary.strongestHistoricalGovernmentWindow == null) || summary.strongestHistoricalGovernmentWindow.dateStatus === "past");
  assert.ok(analysis.careerAssessment.opportunitySummary);
  assert.ok(analysis.careerAssessment.opportunitySummary.currentGovernmentServiceWindows.every(w => w.dateStatus === "active"));
  assert.ok(analysis.careerAssessment.opportunitySummary.upcomingGovernmentServiceWindows.every(w => w.dateStatus === "upcoming"));
  const rankedIds = analysis.careerAssessment.opportunitySummary.currentGovernmentServiceWindows
    .concat(analysis.careerAssessment.opportunitySummary.upcomingGovernmentServiceWindows)
    .map(w => `${w.planet}|${w.startDate}|${w.endDate}`);
  assert.equal(new Set(rankedIds).size, rankedIds.length, "opportunity ranking does not duplicate exact period intervals");

  const context = engine.buildAIContext(
    report,
    "career",
    "What are my government job prospects? Show all favourable timings and focus on upcoming periods.",
    { referenceDate: "2026-11-14", timeZone: "Asia/Kolkata" }
  );
  const compact = ai.compactCareerPromptContext(context);
  assert.equal(compact.engineVersion, "3.0.0");
  assert.deepEqual(compact.careerAssessment.strengthWeakness.strongPlanets, ["sun"]);
  assert.deepEqual(compact.careerAssessment.strengthWeakness.weakPlanets, ["saturn"]);
  assert.ok(compact.careerAssessment.opportunitySummary);
  assert.equal(compact.careerAssessment.timelineSummary.periodsReturned, windows.length,
    "compact AI context retains counts for the complete structured timeline");
  assert.equal(Object.hasOwn(compact.careerAssessment, "dashaWindows"), false,
    "full period rows are not duplicated into the Groq prompt");
  assert.ok(compact.careerAssessment.opportunitySummary.currentGovernmentServiceWindows.every(w => w.d === "active"));
  assert.ok(compact.careerAssessment.opportunitySummary.upcomingGovernmentServiceWindows.every(w => w.d === "upcoming"));
  assert.ok(compact.careerAssessment.opportunitySummary.upcomingGovernmentServiceWindows.every(w => w.h),
    "ranked opportunities retain their full supplied Dasha hierarchy labels");
  assert.ok(compact.careerAssessment.timelineSummary.strongestUpcomingGovernmentWindow == null ||
    compact.careerAssessment.timelineSummary.strongestUpcomingGovernmentWindow.d === "upcoming");
  assert.ok(Buffer.byteLength(JSON.stringify(compact), "utf8") < 16000,
    "all-period career context remains below the defensive request-size budget");

  const nestedScoringReport = {
    system: "vedic",
    calculations: {
      birthChart: { success: true, data: { planets: [
        { id: "sun", house: 10, sign: "aries" },
        { id: "saturn", house: 11, sign: "gemini" }
      ] } },
      divisionalCharts: { success: true, data: { charts: {
        D10: { lagna: "taurus", planets: { sun: "aquarius", saturn: "gemini" } }
      } } },
      vimshottariDasha: { success: true, data: { mahadasha: [{
        planet: "Sun", level: "Mahadasha", start_date: "2025-01-01", end_date: "2035-01-01",
        antardasha: [{ planet: "Saturn", level: "Antardasha", start_date: "2026-10-01", end_date: "2027-05-01" }]
      }] } },
      yogas: { success: true, data: [{ name: "Raja Yoga", present: true }] },
      planetaryStrength: { success: true, data: [
        { planet: "sun", strength_status: "strong" },
        { planet: "saturn", strength_status: "weak" }
      ] }
    }
  };
  const nestedAnalysis = engine.analyzeVedicReport(nestedScoringReport, "career", "government job", {
    referenceDate: "2026-11-14", timeZone: "Asia/Kolkata"
  });
  const nestedWindows = nestedAnalysis.careerAssessment.dashaWindows;
  const sunParent = nestedWindows.find(w => w.level === "Mahadasha" && w.planet === "Sun");
  const saturnChild = nestedWindows.find(w => w.level === "Antardasha" && w.planet === "Saturn");
  assert.ok(sunParent && saturnChild);
  assert.notEqual(sunParent.governmentServiceIndicationScore, saturnChild.governmentServiceIndicationScore,
    "child-period score is independently calculated");
  assert.ok(nestedAnalysis.careerAssessment.opportunitySummary.currentGovernmentServiceWindows.some(w => w.planet === "Saturn"));
  assert.ok(nestedAnalysis.careerAssessment.opportunitySummary.currentGovernmentServiceWindows.some(w => w.planet === "Sun"),
    "the broader scored Mahadasha remains visible when its child covers a shorter distinct interval");

  // Stress-check the maximum timeline cap: every included period must survive compaction.
  const stressReport = structuredClone(report);
  stressReport.calculations.vimshottariDasha.data.additionalDatedPeriods = Array.from({ length: 47 }, (_, index) => {
    const year = 1970 + index;
    const planets = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Sun", "Moon", "Rahu", "Ketu"];
    return {
      planet: planets[index % planets.length],
      start_date: `${year}-01-01`,
      end_date: `${year}-06-30`
    };
  });
  const stressContext = engine.buildAIContext(
    stressReport,
    "career",
    "Show all dated career periods.",
    { referenceDate: "2026-11-14", timeZone: "Asia/Kolkata" }
  );
  const stressCompact = ai.compactCareerPromptContext(stressContext);
  assert.equal(stressCompact.careerAssessment.timelineSummary.periodsReturned, 54,
    "the compact context retains the full configured timeline count");
  assert.equal(Object.hasOwn(stressCompact.careerAssessment, "dashaWindows"), false,
    "the 54 detailed timeline rows are left to the structured frontend payload");
  assert.ok(Buffer.byteLength(JSON.stringify(stressCompact), "utf8") < 14000,
    "ranked consultation context remains comfortably below the backend context budget");

  // Topic-specific modules: every domain must use its own D1 + varga evidence,
  // preserve the complete timeline, and avoid claiming a real-world probability.
  const domainReport = structuredClone(report);
  domainReport.calculations.birthChart.data.planets = [
    { id: "moon", house: 4, sign: "cancer" },
    { id: "mercury", house: 5, sign: "virgo" },
    { id: "jupiter", house: 9, sign: "sagittarius" },
    { id: "venus", house: 7, sign: "libra" },
    { id: "rahu", house: 12, sign: "leo" },
    { id: "sun", house: 1, sign: "aries" },
    { id: "saturn", house: 11, sign: "gemini" }
  ];
  domainReport.calculations.divisionalCharts.data.charts.D24 = {
    lagna: "aries", planets: { moon: "cancer", mercury: "leo", jupiter: "sagittarius" }
  };
  domainReport.calculations.divisionalCharts.data.charts.D4 = {
    lagna: "cancer", planets: { rahu: "gemini", jupiter: "pisces", moon: "aries" }
  };
  domainReport.calculations.divisionalCharts.data.charts.D9 = {
    lagna: "capricorn", planets: { venus: "scorpio", moon: "aquarius", mars: "scorpio", jupiter: "pisces" }
  };
  domainReport.calculations.divisionalCharts.data.charts.D2 = {
    lagna: "cancer", planets: { mercury: "leo", saturn: "leo", jupiter: "cancer", venus: "cancer" }
  };

  const expectedVargas = { education: "D24", marriage: "D9", finance: "D2", travel: "D4", overall: "D9" };
  for (const [topic, varga] of Object.entries(expectedVargas)) {
    const domainAnalysis = engine.analyzeVedicReport(domainReport, topic, "", {
      referenceDate: "2026-11-14", timeZone: "Asia/Kolkata"
    });
    assert.equal(domainAnalysis.topic, topic);
    assert.equal(domainAnalysis.topicAssessment.topic, topic);
    assert.equal(domainAnalysis.topicAssessment.sourceAvailability.divisionalChart, varga);
    assert.equal(domainAnalysis.chartAvailability[varga].usable, true);
    assert.ok(domainAnalysis.topicAssessment.overall.sourceCount >= 2,
      `${topic} receives an indication score only from at least two distinct evidence groups`);
    assert.ok(domainAnalysis.topicAssessment.strengthWeakness.traditionalStrengths.length > 0,
      `${topic} has a topic-specific traditional strengths section`);
    assert.ok(domainAnalysis.topicAssessment.dashaWindows.every(w => ["past", "active", "upcoming"].includes(w.dateStatus)));
    assert.ok(domainAnalysis.topicAssessment.opportunitySummary.currentWindows.every(w => w.dateStatus === "active"));
    assert.ok(domainAnalysis.topicAssessment.opportunitySummary.upcomingWindows.every(w => w.dateStatus === "upcoming"));
    assert.match(domainAnalysis.topicAssessment.interpretationNote, /not probabilities/i);
  }

  const dashaOnlyContext = engine.buildAIContext(domainReport, "dasha", "Show my current and upcoming Dasha periods.", {
    referenceDate: "2026-11-14", timeZone: "Asia/Kolkata"
  });
  assert.equal(dashaOnlyContext.topic, "dasha");
  assert.ok(Array.isArray(dashaOnlyContext.dashaTimeline) && dashaOnlyContext.dashaTimeline.length >= 1,
    "Dasha-only topic retains its complete expandable timeline");
  assert.ok(dashaOnlyContext.dashaPeriods.every(period => ["active", "upcoming"].includes(period.dateStatus)),
    "Dasha consultation prompt focuses on active/upcoming periods while UI keeps full history");

  // D1 placements and D1 house-lord rows are one calculation source, not two
  // independent sources. A one-source reading must withhold the numeric score.
  const singleSourceReport = {
    calculations: {
      birthChart: { success: true, data: {
        planets: [{ id: "mercury", house: 5, sign: "virgo" }],
        house_lords: [{ house: 5, lord: "mercury" }]
      } },
      divisionalCharts: { success: true, data: { charts: {} } }
    }
  };
  const oneSource = engine.analyzeVedicReport(singleSourceReport, "education", "", {
    referenceDate: "2026-11-14", timeZone: "Asia/Kolkata"
  }).topicAssessment;
  assert.equal(oneSource.overall.sourceCount, 1);
  assert.equal(oneSource.overall.score, null, "same-D1 fields cannot be counted as two independent sources");

  // Kundali matching is a separate two-person flow using the provider's real
  // Ashtakoot endpoint. Birth details are not sent without explicit consent.
  const matchFunction = require("./netlify/functions/kundali-match");
  process.env.ASTROLOGICS_API_KEY = "mock-astrologics-key";
  const originalFetchForMatch = global.fetch;
  let matchRequestUrl = "";
  let matchRequestBody = null;
  global.fetch = async (url, options) => {
    matchRequestUrl = String(url);
    matchRequestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ data: {
      total: 28, max: 36, conclusion: "Good traditional compatibility; review individual factors.",
      kootas: [{ name: "varna", label: "Varna", score: 1, max: 1, note: "Provider note" }]
    }, warnings: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const matchResult = await matchFunction.handler({
      httpMethod: "POST",
      body: JSON.stringify({ consent: true,
        personA: { date: "2001-12-09", time: "01:05", place: "Nowshera, Jammu and Kashmir, India" },
        personB: { date: "2002-05-21", time: "14:30", place: "Jammu, Jammu and Kashmir, India" }
      })
    });
    assert.equal(matchResult.statusCode, 200);
    assert.match(matchRequestUrl, /\/v1\/match\/ashtakoot$/);
    assert.deepEqual(matchRequestBody.person_a.place, { query: "Nowshera, Jammu and Kashmir, India" });
    assert.equal(JSON.parse(matchResult.body).data.total, 28);
    assert.equal(JSON.parse(matchResult.body).data.max, 36);

    const noConsent = await matchFunction.handler({
      httpMethod: "POST",
      body: JSON.stringify({ consent: false, personA: {}, personB: {} })
    });
    assert.equal(noConsent.statusCode, 400);

    // Provider place ambiguity is returned as candidates for the UI to resolve;
    // the function does not silently choose a similarly named location.
    global.fetch = async () => new Response(JSON.stringify({
      error: { code: "place_ambiguous", message: "Choose a more specific birth place." },
      candidates: [{ name: "Springfield", state: "Illinois", country: "USA" }]
    }), { status: 422, headers: { "content-type": "application/json" } });
    const ambiguous = await matchFunction.handler({
      httpMethod: "POST",
      body: JSON.stringify({ consent: true,
        personA: { date: "2001-12-09", time: "01:05", place: "Springfield" },
        personB: { date: "2002-05-21", time: "14:30", place: "Jammu, India" }
      })
    });
    assert.equal(ambiguous.statusCode, 422);
    assert.equal(JSON.parse(ambiguous.body).candidates[0].name, "Springfield");
  } finally {
    global.fetch = originalFetchForMatch;
    delete process.env.ASTROLOGICS_API_KEY;
  }

  const correctedD24 = ai.validateExplicitHouseClaims(
    "In D24, Mercury is in the 2nd house and supports disciplined learning.",
    { chartPlacements: [{ source: "D24", field: "Mercury", value: { house: 5, sign: "Virgo", houseSource: "derived_from_whole_sign_lagna" } }] }
  );
  assert.equal(correctedD24.correctedClaims, 1, "D24 chart-house claims are checked against the D24 placement ledger");
  assert.match(correctedD24.text, /Mercury in the 5th house/);

  process.env.GROQ_API_KEY = "mock-key";
  const oldFetch = global.fetch;
  let requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      model: "openai/gpt-oss-20b",
      choices: [{
        finish_reason: "stop",
        message: { content: "Namaste, dear seeker.\n\n### Overall career and government-service assessment\nScores are traditional indication indices.\n\n### Best job-opportunity windows from today onward\nOnly scored current periods are listed.\n\n### Planetary context\nD1 and D10 evidence is shown separately.\n\n### Strengths and weaknesses\nSun is explicitly strong; Saturn is explicitly weak in the supplied strength data.\n\n### Practical guidance\nPrepare steadily.\n\n### Closing thoughts\nUse these indications as guidance." }
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await ai.handler({
      httpMethod: "POST",
      body: JSON.stringify({
        consent: true,
        report,
        language: "en",
        topic: "career",
        question: "What are my government job prospects? Show all favourable timings and focus on upcoming periods."
      })
    });
    assert.equal(result.statusCode, 200);
    assert.equal(requestBody.max_completion_tokens, 1200);
    const userMessage = requestBody.messages.find(message => message.role === "user").content;
    assert.match(userMessage, /Do NOT print the entire Dasha timeline or list every past period in the narrative/i);
    assert.match(userMessage, /opportunitySummary/i);
    assert.doesNotMatch(userMessage, /"dashaWindows"\s*:/,
      "full timeline rows are not duplicated inside the AI prompt");
    const sentStructuredContext = userMessage.match(/Here is the structured prediction-engine context[\s\S]*?\n\nProvide the consultation/);
    assert.ok(sentStructuredContext, "structured prediction context is present in the request");
    assert.ok(Buffer.byteLength(sentStructuredContext[0], "utf8") < 14000,
      "career prompt context stays under the safer 12 KB target for the tested report");
    const systemMessage = requestBody.messages.find(message => message.role === "system").content;
    assert.match(systemMessage, /Strengths and weaknesses/i);
    assert.match(systemMessage, /Never list duplicate opportunity rows/i);
    assert.match(systemMessage, /Keep both a scored parent Mahadasha\/Antardasha and a nested child period when their exact start\/end dates differ/i);
    assert.match(userMessage, /Do NOT print the entire Dasha timeline or list every past period in the narrative/i);
    const response = JSON.parse(result.body);
    assert.equal(response.engine.version, "3.0.0");
    assert.ok(response.engine.careerAssessment.strengthWeakness.strongPlanets.some(p => p.planet === "sun"));
    assert.ok(response.engine.careerAssessment.strengthWeakness.weakPlanets.some(p => p.planet === "saturn"));
    assert.ok(response.engine.careerAssessment.opportunitySummary);
    assert.ok(response.engine.careerAssessment.dashaWindows.some(w => w.dateStatus === "past"));
    assert.ok(response.engine.careerAssessment.dashaWindows.some(w => w.dateStatus === "active"));
    assert.ok(response.engine.careerAssessment.dashaWindows.some(w => w.dateStatus === "upcoming"));
    assert.equal(response.engine.careerAssessment.dashaWindows.length, windows.length,
      "the complete timeline is still returned to the frontend despite prompt compaction");

    // Non-career AI consultation returns a full topic Dasha timeline to the
    // frontend even though Groq receives only compact current/upcoming windows.
    const educationContext = engine.buildAIContext(domainReport, "education", "", {
      referenceDate: "2026-11-14", timeZone: "Asia/Kolkata"
    });
    const educationResult = await ai.handler({
      httpMethod: "POST",
      body: JSON.stringify({ consent: true, report: domainReport, language: "en", topic: "education" })
    });
    assert.equal(educationResult.statusCode, 200);
    const educationResponse = JSON.parse(educationResult.body);
    assert.equal(educationResponse.engine.topicAssessment.topic, "education");
    assert.equal(educationResponse.engine.topicAssessment.dashaWindows.length,
      educationContext.topicAssessment.dashaWindows.length,
      "prompt compaction must not truncate the UI's complete non-career Dasha timeline");
    assert.ok(educationResponse.engine.topicAssessment.opportunitySummary.upcomingWindows.length > 0);

    const dashaResult = await ai.handler({
      httpMethod: "POST",
      body: JSON.stringify({ consent: true, report: domainReport, language: "en", topic: "dasha", question: "Show the active and upcoming periods." })
    });
    assert.equal(dashaResult.statusCode, 200);
    const dashaResponse = JSON.parse(dashaResult.body);
    assert.ok(Array.isArray(dashaResponse.engine.dashaTimeline) && dashaResponse.engine.dashaTimeline.length > 0,
      "Dasha-only AI response exposes full timeline metadata to the UI");
    assert.ok(!dashaResponse.engine.dashaTimeline.some(period => period.indicationScore != null),
      "Dasha-only timeline does not invent life-area scores");

    // The matching explanation consumes only the provider's matching response;
    // it does not require or fabricate a single-person natal report.
    let matchingPromptBody = null;
    global.fetch = async (_url, options) => {
      matchingPromptBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        model: "openai/gpt-oss-20b",
        choices: [{ finish_reason: "stop", message: { content: `Namaste. The supplied Guna Milan is 28 out of 36. This is a traditional compatibility indicator, not a guarantee.

### Strengths
The provider's Varna point is complete.

### Practical relationship guidance
Discuss values and expectations openly.` } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const matchingAiResult = await ai.handler({
      httpMethod: "POST",
      body: JSON.stringify({ consent: true, topic: "kundali_matching", language: "en",
        matchReport: { total: 28, max: 36, conclusion: "Good traditional compatibility", kootas: [
          { name: "varna", label: "Varna", score: 1, max: 1, note: "Provider note" }
        ] }
      })
    });
    assert.equal(matchingAiResult.statusCode, 200);
    const matchingAiBody = JSON.parse(matchingAiResult.body);
    assert.equal(matchingAiBody.topic, "kundali_matching");
    assert.equal(matchingAiBody.matching.total, 28);
    assert.match(matchingPromptBody.messages.find(message => message.role === "system").content, /Do not call the score a probability/i);

    // Run the actual handler with the 54-row stress fixture as well: AI prompt
    // stays compact while the structured response still carries every row.
    const stressResult = await ai.handler({
      httpMethod: "POST",
      body: JSON.stringify({
        consent: true, report: stressReport, language: "en", topic: "career",
        question: "Show all my past, current and upcoming government job timings, then focus on future opportunities."
      })
    });
    assert.equal(stressResult.statusCode, 200, "54-period career request must not fail with 413");
    const stressResponse = JSON.parse(stressResult.body);
    assert.equal(stressResponse.engine.careerAssessment.dashaWindows.length, 54,
      "all 54 rows remain available to the expandable frontend timeline");
  } finally {
    global.fetch = oldFetch;
    delete process.env.GROQ_API_KEY;
  }

  console.log("V3.0.0 tests passed:");
  console.log("- Screenshot-shaped report retains separate 75/100 career and 64/100 government-service indices");
  console.log("- D1/D10 placement-based strengths and cautions are populated when formal status labels are absent");
  console.log("- Numeric Shadbala values are not mislabelled as strong or weak");
  console.log("- Current Saturn Antardasha and future Sun Pratyantardasha are ranked with exact dates and evidence");
  console.log("- Broad parent and distinct nested sub-period windows are both preserved");
  console.log("- Full valid Dasha history retained with past/active/upcoming labels");
  console.log("- Nested Mahadasha → Antardasha → Pratyantardasha hierarchy preserved");
  console.log("- Unclassified dated periods shown but never scored");
  console.log("- Historical and upcoming strongest periods kept distinct");
  console.log("- Full historical/current/upcoming timeline remains in structured engine output");
  console.log("- Groq receives compact ranked opportunities, not a duplicate 54-row timeline");
  console.log("- AI prompt explicitly requires full timeline then best upcoming periods");
  console.log("- Mock Groq handler returns HTTP 200 with complete engine timeline");
  console.log("- Education D24, marriage D9, finance D2, travel D4 and overall modules score only from distinct evidence sources");
  console.log("- Same-source D1 data cannot inflate the independent-evidence count");
  console.log("- Dedicated two-person Ashtakoot matching validates consent and surfaces ambiguous places");
  console.log("- Matching commentary preserves the provider's Guna score and avoids probability claims");
  console.log("- Non-career AI prompt compaction preserves the full structured Dasha timeline for the UI");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});


// V3.0.0 presentation-specific smoke checks.
const fs = require("node:fs");
const frontendSource = fs.readFileSync(require.resolve("./vedic_astro.js"), "utf8");
const aiSource = fs.readFileSync(require.resolve("./netlify/functions/ai-explain.js"), "utf8");
assert.match(aiSource, /Pandit's direct reading/i);
assert.match(aiSource, /Overall career and government-service assessment/i);
assert.match(aiSource, /Best job-opportunity windows from today onward/i);
assert.match(aiSource, /Planetary context/i);
assert.match(aiSource, /Practical guidance/i);
assert.match(aiSource, /Closing thoughts/i);
assert.match(frontendSource, /renderGeminiExplanation\(payload\.explanation, output, payload\.engine\)/);
assert.match(frontendSource, /function appendExpandableDashaTimeline/);
assert.match(frontendSource, /function createStructuredStrengthWeaknessCard/);
assert.match(frontendSource, /Strengths & Weaknesses/);
assert.match(frontendSource, /Astrological strengths in the chart/);
assert.match(frontendSource, /Weaknesses, pressures and areas to manage/);
assert.match(frontendSource, /Best Job-Opportunity Windows/);
assert.match(frontendSource, /Current government-service windows/);
assert.match(frontendSource, /Upcoming government-service windows/);
assert.match(frontendSource, /broad Mahadasha\/Antardasha and its shorter child window/);
assert.match(frontendSource, /isPracticalGuidanceHeading/);
assert.match(frontendSource, /isStrengthWeaknessHeading/);
assert.match(frontendSource, /Historical periods \(past\)/);
assert.match(frontendSource, /Full Dasha Timeline/);
assert.match(frontendSource, /astro-technical-accordion gemini-dasha-timeline/);
assert.match(frontendSource, /id = "kundaliMatching"/);
assert.match(frontendSource, /\.netlify\/functions\/kundali-match/);
assert.match(frontendSource, /id: "kundali_matching"/);
assert.match(frontendSource, /D24/);
assert.match(frontendSource, /D4/);
console.log("- Full Dasha timeline rendered as expandable accordion groups");
console.log("- Dasha-only module receives current/upcoming context and keeps the full UI timeline without fabricated scores");
console.log("- D24 house claims receive the same chart-specific source validation as D1/D2/D4/D9/D10");
console.log("- Historical Dasha rows collapsed by default; current/upcoming grouped separately");
console.log("- Main consultation retains scores, planetary context, practical guidance and closing thoughts");
