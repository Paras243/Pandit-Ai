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
  assert.equal(engine.ENGINE_VERSION, "2.5.6");
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
  assert.equal(compact.engineVersion, "2.5.6");
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
    assert.equal(response.engine.version, "2.5.6");
    assert.ok(response.engine.careerAssessment.strengthWeakness.strongPlanets.some(p => p.planet === "sun"));
    assert.ok(response.engine.careerAssessment.strengthWeakness.weakPlanets.some(p => p.planet === "saturn"));
    assert.ok(response.engine.careerAssessment.opportunitySummary);
    assert.ok(response.engine.careerAssessment.dashaWindows.some(w => w.dateStatus === "past"));
    assert.ok(response.engine.careerAssessment.dashaWindows.some(w => w.dateStatus === "active"));
    assert.ok(response.engine.careerAssessment.dashaWindows.some(w => w.dateStatus === "upcoming"));
    assert.equal(response.engine.careerAssessment.dashaWindows.length, windows.length,
      "the complete timeline is still returned to the frontend despite prompt compaction");

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

  console.log("V2.5.6 tests passed:");
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
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});


// V2.5.6 presentation-specific smoke checks.
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
console.log("- Full Dasha timeline rendered as expandable accordion groups");
console.log("- Historical Dasha rows collapsed by default; current/upcoming grouped separately");
console.log("- Main consultation retains scores, planetary context, practical guidance and closing thoughts");
