"use strict";
const assert = require("node:assert/strict");
process.env.GROQ_API_KEY = "test-key";
let sent = null;
global.fetch = async (_url, options) => {
  sent = JSON.parse(options.body);
  return { ok: true, status: 200, text: async () => JSON.stringify({
    model: "openai/gpt-oss-20b",
    choices: [{ finish_reason: "stop", message: { content: "### Final combined review and score\nThe traditional index is 45/100, not a probability.\n\n### Manglik and Papasamyam\nThe provider verdict and local D1 checks are separate methods." } }]
  }) };
};
const handler = require("./netlify/functions/ai-explain").handler;
(async () => {
  const result = await handler({ httpMethod: "POST", body: JSON.stringify({
    consent: true, topic: "kundali_matching", language: "en",
    question: "Explain this matching report",
    matchReport: { data: { total: 22.5, max: 36, kootas: [] }, advanced: {
      finalReview: { score: 45, complete: true, availableWeight: 100 },
      personA: { name: "A", gender: "male", role: "groom", manglik: { d1: [] } },
      personB: { name: "B", gender: "female", role: "bride", manglik: { d1: [] } },
      manglikCompatibility: { success: true, data: { both_manglik: false } },
      southIndianPorutham: { success: true, data: { score: 6, max: 10 } },
      papasamyam: { success: true, data: { result: "not_satisfactory" } }
    }, warnings: [], providerErrors: [] }
  }) });
  assert.equal(result.statusCode, 200, "kundali_matching must bypass generic topic registry validation");
  const payload = JSON.parse(result.body);
  assert.equal(payload.success, true);
  assert.equal(payload.finishReason, "stop");
  assert.match(sent.messages[0].content, /local D1 screening/);
  assert.match(sent.messages[0].content, /Ashtakoota Yoni/);
  assert.match(sent.messages[0].content, /weighted-score completeness/);
  console.log("PASS: dedicated Kundali AI route, source-specific Manglik/Yoni guidance, and complete AI response path.");
})().catch(error => { console.error(error); process.exitCode = 1; });
