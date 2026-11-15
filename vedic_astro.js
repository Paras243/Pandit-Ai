
document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // HTML ELEMENTS
  // ==========================================

  const grid = document.getElementById("vedicRashiGrid");
  const result = document.getElementById("vedicRashiResult");
  const form = document.getElementById("vedicKundliForm");
  const kundliResult = document.getElementById("vedicKundliResult");

  const horoscopeLanguage =
    document.getElementById("vedicLanguage");

  const kundliLanguage =
    document.getElementById("vedicKundliLanguage");

  let selectedSign = "";
  let horoscopeRequestId = 0;
  let horoscopeAbortController = null;
  let phaladeshInFlight = false;
  let kundliInFlight = false;
  let lastPhaladeshRequestAt = 0;
  let pendingDashboardTopic = "";
  const PHALADESH_COOLDOWN_MS = 12000;

  const dashboardGrid = document.getElementById("astroDashboardGrid");
  const dashboardStatus = document.getElementById("astroDashboardStatus");

  dashboardGrid?.addEventListener("click", event => {
    const card = event.target.closest("[data-astro-topic]");
    if (!card) return;

    const topic = card.dataset.astroTopic;
    const topicButton = document.querySelector(
      `.gemini-topic-btn[data-topic="${topic}"]`
    );

    if (topicButton) {
      topicButton.click();
      document.querySelector(".gemini-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      return;
    }

    pendingDashboardTopic = topic;
    if (dashboardStatus) {
      dashboardStatus.textContent =
        "First enter your birth details, generate your Kundali, then select “Generate Full Phaladesh”. Your chosen topic will open automatically.";
    }
    document.getElementById("vedic-kundli")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    form?.querySelector('input[name="date"]')?.focus({ preventScroll: true });
  });

  // ==========================================
  // RASHI MAPPING
  // ==========================================

  const rashiMap = {
    mesha: "aries",
    vrishabha: "taurus",
    mithuna: "gemini",
    karka: "cancer",
    simha: "leo",
    kanya: "virgo",
    tula: "libra",
    vrishchika: "scorpio",
    dhanu: "sagittarius",
    makara: "capricorn",
    kumbha: "aquarius",
    meena: "pisces"
  };

  // ==========================================
  // RASHI SELECTION
  // ==========================================

  grid?.addEventListener("click", async event => {
    const button = event.target.closest("[data-sign]");

    if (!button) return;

    const sanskritSign = button.dataset.sign.toLowerCase();
    selectedSign = rashiMap[sanskritSign];

    if (!selectedSign) return;

    grid.querySelectorAll(".astro-sign").forEach(item => {
      item.classList.remove("is-selected");
    });

    button.classList.add("is-selected");

    await loadRashiHoroscope();
  });

  // ==========================================
  // DAILY RASHIFAL
  // ==========================================

  async function loadRashiHoroscope() {
    if (!selectedSign || !result) return;

    const requestId = ++horoscopeRequestId;
    const language = horoscopeLanguage?.value || "en";

    // Cancel the previous sign/language request so stale responses
    // cannot overwrite the user's latest selection.
    if (horoscopeAbortController) horoscopeAbortController.abort();
    horoscopeAbortController = new AbortController();

    showMessage(result, "Loading your daily Rashi reading...");

    try {
      const data = await getRashiHoroscope(
        selectedSign,
        language,
        horoscopeAbortController.signal
      );

      if (requestId !== horoscopeRequestId) return;
      displayRashiHoroscope(data, result);

    } catch (error) {
      if (error.name === "AbortError") return;
      if (requestId !== horoscopeRequestId) return;

      console.error("Rashifal error:", error);
      showMessage(result, friendlyApiMessage(error));
    }
  }

  horoscopeLanguage?.addEventListener("change", () => {
    if (selectedSign) loadRashiHoroscope();
  });

  // ==========================================
  // ADD PHALADESH BUTTON
  // ==========================================

  let phaladeshButton = null;

  if (form && kundliResult) {
    phaladeshButton = document.createElement("button");

    phaladeshButton.type = "button";
    phaladeshButton.className = "astro-btn astro-btn-outline";
    phaladeshButton.textContent = "Generate Full Phaladesh ✧";
    phaladeshButton.style.marginTop = "12px";

    form.appendChild(phaladeshButton);

    phaladeshButton.addEventListener(
      "click",
      generatePhaladesh
    );
  }

  // ==========================================
  // KUNDLI FORM
  // ==========================================

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    if (kundliInFlight) return;

    const birth = getBirthDetails();

    if (!birth) {
      showMessage(
        kundliResult,
        "Please enter your birth date, time and birthplace."
      );
      return;
    }

    kundliInFlight = true;

    const submitButton =
      form.querySelector('[type="submit"]');

    const originalText = submitButton?.textContent;

    setButtonState(
      submitButton,
      true,
      "Calculating your Kundli..."
    );

    showMessage(
      kundliResult,
      "Calculating your Vedic birth chart..."
    );

    try {
      const data = await getKundli(birth);

      displayKundli(data, kundliResult, birth.name);

    } catch (error) {
      console.error("Kundli error:", error);

      showMessage(
        kundliResult,
        error.message || "Unable to generate your Kundli."
      );

    } finally {
      kundliInFlight = false;
      setButtonState(submitButton, false, originalText);
    }
  });

  // ==========================================
  // GENERATE FULL PHALADESH
  // ==========================================

  async function generatePhaladesh() {
    if (phaladeshInFlight) return;

    const now = Date.now();
    const waitRemaining = PHALADESH_COOLDOWN_MS - (now - lastPhaladeshRequestAt);

    if (waitRemaining > 0) {
      showMessage(
        kundliResult,
        `Please wait ${Math.ceil(waitRemaining / 1000)} seconds before requesting another full report. This helps avoid the provider's rate limit.`
      );
      return;
    }

    const birth = getBirthDetails();

    if (!birth) {
      showMessage(
        kundliResult,
        "Please enter your birth date, time and birthplace first."
      );
      return;
    }

    phaladeshInFlight = true;
    lastPhaladeshRequestAt = Date.now();

    setButtonState(
      phaladeshButton,
      true,
      "Preparing your life analysis..."
    );

    showMessage(
      kundliResult,
      "Your detailed Phaladesh is being calculated. Please wait..."
    );

    try {
   const report = await getPhaladesh(birth);
   const reportDashboard = document.getElementById("vedicReportDashboard");
   const reportHost = reportDashboard?.querySelector(".astro-shell") || kundliResult;
   reportHost.replaceChildren();

   const technicalSection = document.createElement("section");
   technicalSection.className = "astro-report-section astro-technical-section";
   technicalSection.id = "technicalAnalysis";
   const technicalHeader = document.createElement("div");
   technicalHeader.className = "astro-report-heading";
   technicalHeader.innerHTML = '<span class="astro-section-number">SECTION 1</span><div><h2>Planetary Positions & Technical Analysis</h2><p>Detailed calculations from your Vedic birth chart.</p></div>';
   const technicalContent = document.createElement("div");
   technicalContent.className = "astro-technical-content";
   technicalSection.append(technicalHeader, technicalContent);

   const panditSection = document.createElement("section");
   panditSection.className = "astro-report-section astro-pandit-section";
   panditSection.id = "panditInterpretation";
   const panditHeader = document.createElement("div");
   panditHeader.className = "astro-report-heading";
   panditHeader.innerHTML = '<span class="astro-section-number">SECTION 2</span><div><h2>Pandit’s Kundali Interpretation</h2><p>Traditional meanings explained in clear, personal language.</p></div>';
   const panditContent = document.createElement("div");
   panditContent.className = "astro-pandit-content";
   panditSection.append(panditHeader, panditContent);

   reportHost.append(technicalSection, panditSection);
   displayPhaladesh(report, technicalContent, birth.name);
   addGeminiExplanation(report, panditContent, birth.language);
   reportDashboard?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error("Phaladesh error:", error);

      showMessage(
        kundliResult,
        friendlyApiMessage(error)
      );

    } finally {
      phaladeshInFlight = false;
      setButtonState(
        phaladeshButton,
        false,
        "Generate Full Phaladesh ✧"
      );
    }
  }

  // ==========================================
  // READ BIRTH FORM
  // ==========================================

  function getBirthDetails() {
    if (!form) return null;

    const formData = new FormData(form);

    const name = String(
      formData.get("name") || ""
    ).trim();

    const date = formData.get("date");
    const time = formData.get("time");

    const place = String(
      formData.get("place") || ""
    ).trim();

    if (!date || !time || !place) return null;

    return {
      name,
      date,
      time,
      place,
      language: kundliLanguage?.value || "en"
    };
  }

  // ==========================================
  // API: DAILY RASHIFAL
  // ==========================================

  async function getRashiHoroscope(sign, language = "en", signal) {
    const params = new URLSearchParams({
      action: "horoscope",
      sign,
      period: "daily",
      lang: language
    });

    const response = await fetch(
      `/.netlify/functions/astrology?${params}`,
      { signal, headers: { Accept: "application/json" } }
    );

    const payload = await readResponse(response);
    return payload.data ?? payload;
  }

  // ==========================================
  // API: BASIC KUNDLI
  // ==========================================

  async function getKundli(birth) {
    const payload = await postAstrology("kundli", {
      birth: {
  date: birth.date,
  time: birth.time,
  place: { query: birth.place },
  timezone: "auto"
},
      options: {
        lang: birth.language,
        ayanamsa: "lahiri",
        house_system: "whole_sign"
      }
    });

    return payload.data ?? payload;
  }

  // ==========================================
  // API: FULL VEDIC PHALADESH
  // ==========================================

  async function getPhaladesh(birth) {
    const payload = await postAstrology("phaladesh", {
     birth: {
  date: birth.date,
  time: birth.time,
  place: { query: birth.place },
  timezone: "auto"
},

      name: birth.name || undefined,

      include: [
        "kundli",
        "divisional:D2,D4,D9,D10,D24",
        "dasha:2",
        "current_dasha",
        "yogas",
        "wealth",
        "shadbala",
        "year_outlook"
      ],

      options: {
        lang: birth.language,
        ayanamsa: "lahiri",
        house_system: "whole_sign",
        tone: "descriptive"
      }
    });

    
const finalReport = payload.data ?? payload;

// Diagnostic 1: Check the top-level response structure.
console.log(
  "ASTROLOGICS REPORT KEYS:",
  Object.keys(finalReport || {})
);

// Diagnostic 2: Check which calculations succeeded.
console.log(
  "ASTROLOGICS CALCULATION STATUS:",
  Object.fromEntries(
    Object.entries(finalReport?.calculations || {}).map(
      ([key, value]) => [
        key,
        {
          success: value?.success,
          hasData: value?.data != null,
          dataType: Array.isArray(value?.data)
            ? "array"
            : typeof value?.data,
          error: value?.error || null
        }
      ]
    )
  )
);

// TEMPORARY: Inspect actual AstroLogics divisional chart data
const divisionalData =
  finalReport?.calculations?.divisionalCharts?.data;

console.log(
  "DIVISIONAL DATA KEYS:",
  Object.keys(divisionalData || {})
);

console.log(
  "DIVISIONAL DATA JSON:",
  JSON.stringify(divisionalData ?? null, null, 2)
);

return finalReport;

  }


  
// ==========================================
// GEMINI AI — EXPLAIN ASTROLOGICS REPORT
// ==========================================


// ==========================================
// GEMINI AI — PREMIUM STRUCTURED UI
// ==========================================

function addGeminiExplanation(report, container, language = "en") {
  const section = document.createElement("section");
  section.className = "gemini-panel";

  const header = document.createElement("div");
  header.className = "gemini-panel-header";

  const eyebrow = document.createElement("span");
  eyebrow.className = "gemini-eyebrow";
  eyebrow.textContent = "✦ PARAS BABA · AI INSIGHTS";

  const heading = document.createElement("h3");
  heading.textContent = language === "hi"
    ? "अपनी कुंडली को विस्तार से समझें"
    : "Explore Your Kundali";

  const description = document.createElement("p");
  description.textContent = language === "hi"
    ? "किसी विषय को चुनें और AstroLogics की गणनाओं पर आधारित उसका अलग-अलग विश्लेषण प्राप्त करें।"
    : "Choose a life area to receive a focused explanation based on your actual AstroLogics calculations.";

  header.append(eyebrow, heading, description);

  const consentBox = document.createElement("label");
  consentBox.className = "gemini-consent";

  const consent = document.createElement("input");
  consent.type = "checkbox";

  const consentText = document.createElement("span");
  consentText.textContent = language === "hi"
    ? "मैं चुने गए विषय की व्याख्या के लिए अपनी AstroLogics गणना का आवश्यक डेटा Groq AI को भेजने की सहमति देता/देती हूँ।"
    : "I agree to send the relevant AstroLogics calculation data to Groq AI for the selected explanation.";

  consentBox.append(consent, consentText);

  const topicGrid = document.createElement("div");
  topicGrid.className = "gemini-topic-grid";

  const topics = [
    { id: "career", icon: "💼", en: "Career & Profession", hi: "करियर और पेशा", descEn: "Career direction and work strengths", descHi: "करियर दिशा और कार्य क्षमता" },
    { id: "education", icon: "🎓", en: "Education", hi: "शिक्षा", descEn: "Studies and learning indicators", descHi: "पढ़ाई और शिक्षा के संकेत" },
    { id: "marriage", icon: "💍", en: "Marriage & Relationships", hi: "विवाह और रिश्ते", descEn: "Partnership and marriage indicators", descHi: "विवाह और संबंधों के संकेत" },
    { id: "finance", icon: "₹", en: "Finance & Wealth", hi: "धन और वित्त", descEn: "Income, savings and wealth", descHi: "आय, बचत और धन" },
    { id: "travel", icon: "✈️", en: "Foreign Travel", hi: "विदेश यात्रा", descEn: "Travel and relocation indicators", descHi: "यात्रा और स्थान परिवर्तन" },
    { id: "dasha", icon: "⏳", en: "Dasha & Timing", hi: "दशा और समय", descEn: "Actual planetary periods and dates", descHi: "वास्तविक ग्रह दशाएँ और तिथियाँ" },
    { id: "overall", icon: "✦", en: "Overall Overview", hi: "संपूर्ण कुंडली", descEn: "A concise chart overview", descHi: "कुंडली का संक्षिप्त विश्लेषण" },
    { id: "kundali_matching", icon: "💞", en: "Kundali Matching", hi: "कुंडली मिलान", descEn: "Compare two birth charts for traditional marriage compatibility", descHi: "विवाह के लिए दो जन्म कुंडलियों का पारंपरिक मिलान" }
  ];

  const askSection = document.createElement("section");
  askSection.className = "astro-ask-panel";
  askSection.id = "askYourAstrologer";

  const askTitle = document.createElement("h4");
  askTitle.textContent = language === "hi" ? "अपने ज्योतिषी से प्रश्न पूछें" : "Ask Your Astrologer";
  const askCopy = document.createElement("p");
  askCopy.textContent = language === "hi"
    ? "अपनी कुंडली से जुड़ा व्यक्तिगत प्रश्न लिखें। उत्तर उपलब्ध AstroLogics गणनाओं पर आधारित होगा।"
    : "Ask a personal question about your Kundali. The answer will be grounded in the available AstroLogics calculations.";

  const questionInput = document.createElement("textarea");
  questionInput.className = "astro-question-input";
  questionInput.rows = 3;
  questionInput.maxLength = 700;
  questionInput.placeholder = language === "hi"
    ? "उदाहरण: मेरी कुंडली में सरकारी नौकरी के क्या संकेत हैं?"
    : "e.g. What does my Kundali indicate about a government career?";

  const askButton = document.createElement("button");
  askButton.type = "button";
  askButton.className = "astro-ask-button";
  askButton.textContent = language === "hi" ? "प्रश्न भेजें" : "Ask Pandit";

  const suggestions = document.createElement("div");
  suggestions.className = "astro-question-suggestions";
  [
    "What does my chart indicate about my career?",
    "What should I understand about marriage in my chart?",
    "What does my current Dasha mean?"
  ].forEach(prompt => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = prompt;
    chip.addEventListener("click", () => { questionInput.value = prompt; });
    suggestions.appendChild(chip);
  });

  askSection.append(askTitle, askCopy, questionInput, askButton, suggestions);

  // Separate partner-to-partner Ashtakoot flow. Birth details go directly to
  // the server function only after this second consent checkbox is selected.
  const matchingSection = document.createElement("section");
  matchingSection.className = "astro-ask-panel astro-kundali-matching";
  matchingSection.id = "kundaliMatching";

  const matchingTitle = document.createElement("h4");
  matchingTitle.textContent = language === "hi" ? "विवाह के लिए कुंडली मिलान" : "Kundali Matching for Marriage";
  const matchingCopy = document.createElement("p");
  matchingCopy.textContent = language === "hi"
    ? "आपकी जन्म जानकारी पहले से भरी जाएगी। दूसरे व्यक्ति की सही जन्म तिथि, समय और स्थान दें। AstroLogics से अष्टकूट गुण मिलान की गणना होगी।"
    : "Enter both people's names, genders, traditional roles and birth details. The selected Groom/Bride roles determine the direction of South Indian Porutham and Papasamyam; either person can take either role.";

  const partnerFields = document.createElement("div");
  partnerFields.className = "astro-match-fields";
  const createMatchField = (labelText, type, placeholder = "", required = true) => {
    const label = document.createElement("label");
    label.className = "astro-match-field";
    const title = document.createElement("span");
    title.textContent = labelText;
    const control = document.createElement("input");
    control.type = type;
    control.required = required;
    control.maxLength = type === "text" ? 120 : undefined;
    control.placeholder = placeholder;
    label.append(title, control);
    partnerFields.appendChild(label);
    return control;
  };
  const createMatchSelect = (labelText, options) => {
    const label = document.createElement("label");
    label.className = "astro-match-field";
    const title = document.createElement("span");
    title.textContent = labelText;
    const control = document.createElement("select");
    control.required = true;
    options.forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      control.appendChild(option);
    });
    label.append(title, control);
    partnerFields.appendChild(label);
    return control;
  };

  const personAName = createMatchField(language === "hi" ? "व्यक्ति A का नाम (वैकल्पिक)" : "Person A name (optional)", "text", "", false);
  const personAGender = createMatchSelect(language === "hi" ? "व्यक्ति A का लिंग" : "Person A gender", [
    ["male", language === "hi" ? "पुरुष" : "Male"],
    ["female", language === "hi" ? "महिला" : "Female"],
    ["other", language === "hi" ? "अन्य" : "Other"],
    ["prefer_not_to_say", language === "hi" ? "बताना नहीं चाहते" : "Prefer not to say"]
  ]);
  const personARole = createMatchSelect(language === "hi" ? "व्यक्ति A की पारंपरिक भूमिका" : "Person A matching role", [
    ["groom", language === "hi" ? "वर (Groom)" : "Groom"],
    ["bride", language === "hi" ? "वधू (Bride)" : "Bride"]
  ]);
  const partnerName = createMatchField(language === "hi" ? "व्यक्ति B का नाम (वैकल्पिक)" : "Person B name (optional)", "text", "", false);
  const partnerGender = createMatchSelect(language === "hi" ? "व्यक्ति B का लिंग" : "Person B gender", [
    ["female", language === "hi" ? "महिला" : "Female"],
    ["male", language === "hi" ? "पुरुष" : "Male"],
    ["other", language === "hi" ? "अन्य" : "Other"],
    ["prefer_not_to_say", language === "hi" ? "बताना नहीं चाहते" : "Prefer not to say"]
  ]);
  const partnerRole = createMatchSelect(language === "hi" ? "व्यक्ति B की पारंपरिक भूमिका" : "Person B matching role", [
    ["bride", language === "hi" ? "वधू (Bride)" : "Bride"],
    ["groom", language === "hi" ? "वर (Groom)" : "Groom"]
  ]);
  const partnerDate = createMatchField(language === "hi" ? "व्यक्ति B की जन्म तिथि" : "Person B date of birth", "date");
  const partnerTime = createMatchField(language === "hi" ? "व्यक्ति B का जन्म समय" : "Person B birth time", "time");
  const partnerPlace = createMatchField(language === "hi" ? "व्यक्ति B का जन्म स्थान" : "Person B birth place", "text", language === "hi" ? "शहर, जिला, देश" : "City, district, country");
  const roleNote = document.createElement("p");
  roleNote.className = "astro-match-muted";
  roleNote.textContent = language === "hi"
    ? "लिंग और वर/वधू भूमिका अलग-अलग विवरण हैं। दक्षिण भारतीय पोरुथम और पापसम्यम के लिए एक व्यक्ति को वर और दूसरे को वधू चुनें; जरूरत पड़ने पर भूमिकाएँ बदल सकते हैं।"
    : "Gender and traditional matching role are separate details. Choose exactly one Groom and one Bride for directional South Indian Porutham and Papasamyam calculations; you can swap the roles.";
  partnerFields.appendChild(roleNote);

  const matchConsentLabel = document.createElement("label");
  matchConsentLabel.className = "gemini-consent astro-match-consent";
  const matchConsent = document.createElement("input");
  matchConsent.type = "checkbox";
  const matchConsentText = document.createElement("span");
  matchConsentText.textContent = language === "hi"
    ? "मैं दोनों व्यक्तियों की जन्म तिथि, समय और स्थान AstroLogics को अष्टकूट मिलान के लिए भेजने की सहमति देता/देती हूँ।"
    : "I consent to sending both people's names (if entered), gender, matching roles and birth details to AstroLogics for Ashtakoota, Dashakoot, Papasamyam and Manglik calculations.";
  matchConsentLabel.append(matchConsent, matchConsentText);

  const matchButton = document.createElement("button");
  matchButton.type = "button";
  matchButton.className = "astro-ask-button";
  matchButton.textContent = language === "hi" ? "कुंडली मिलान करें" : "Match Kundalis";
  const matchStatus = document.createElement("p");
  matchStatus.className = "gemini-status";
  matchStatus.setAttribute("role", "status");
  matchStatus.setAttribute("aria-live", "polite");
  const matchOutput = document.createElement("div");
  matchOutput.className = "gemini-results astro-match-results";

  function addMatchStyles() {
    if (document.getElementById("astroMatchAccordionStyles")) return;
    const style = document.createElement("style");
    style.id = "astroMatchAccordionStyles";
    style.textContent = `
      .astro-match-review-card{padding:16px;border:1px solid rgba(220,176,100,.48);border-radius:14px;margin:14px 0;background:rgba(180,150,110,.09)}
      .astro-match-review-card h3{margin:0 0 8px;color:#f3d18b}
      .astro-match-review-index{font-size:clamp(1.8rem,6vw,2.5rem);font-weight:800;margin:4px 0}
      .astro-match-review-card small{display:block;opacity:.75;margin-bottom:10px}
      .astro-match-summary{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:16px;border:1px solid rgba(180,150,110,.28);border-radius:14px;background:rgba(180,150,110,.07);margin-bottom:14px}
      .astro-match-summary strong{display:block;font-size:1rem}
      .astro-match-total{font-size:clamp(1.8rem,7vw,2.5rem);font-weight:700;line-height:1.1;margin:5px 0}
      .astro-match-conclusion{margin:4px 0 0;color:var(--text-muted,#777)}
      .astro-match-accordion{border:1px solid rgba(180,150,110,.25);border-radius:12px;margin:10px 0;overflow:hidden;background:rgba(255,255,255,.025)}
      .astro-match-accordion>summary{cursor:pointer;list-style:none;padding:14px 42px 14px 14px;font-weight:650;position:relative}
      .astro-match-accordion>summary::-webkit-details-marker{display:none}
      .astro-match-accordion>summary:after{content:"＋";position:absolute;right:15px;top:50%;transform:translateY(-50%);font-size:1.1rem;opacity:.75}
      .astro-match-accordion[open]>summary:after{content:"−"}
      .astro-match-accordion-body{padding:0 14px 14px;overflow-wrap:anywhere}
      .astro-match-kootas{display:grid;gap:8px}
      .astro-match-koota{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:10px 0;border-bottom:1px solid rgba(180,150,110,.16)}
      .astro-match-koota small{grid-column:1/-1;opacity:.78}
      .astro-match-data-row{display:grid;grid-template-columns:minmax(110px,.8fr) minmax(0,1.2fr);gap:10px;padding:8px 0;border-bottom:1px solid rgba(180,150,110,.13);font-size:.9rem}
      .astro-match-data-row span:first-child{opacity:.72}
      .astro-match-muted{font-size:.88rem;opacity:.75}
      .astro-match-warning{padding:10px 12px;border-left:3px solid #b78b54;background:rgba(183,139,84,.08);margin:8px 0;border-radius:4px}
      .astro-match-review-card{padding:11px;margin:10px 0}
      .astro-match-review-card h3{font-size:.92rem;letter-spacing:.01em;margin-bottom:5px}
      .astro-match-review-index{font-size:1.45rem;line-height:1.1;margin:2px 0 7px}
      .astro-match-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;align-items:stretch}
      .astro-match-review-grid>*{min-width:0;margin:0;padding:8px;border:1px solid rgba(220,176,100,.2);border-radius:9px;background:rgba(0,0,0,.10);font-size:.70rem;line-height:1.38;overflow-wrap:anywhere}
      .astro-match-review-grid>small{font-size:.66rem;opacity:.78}
      .astro-match-review-components{display:grid;grid-template-columns:1fr;gap:5px}
      .astro-match-review-components .astro-match-koota{padding:6px 7px;margin:0;border:1px solid rgba(220,176,100,.16);border-radius:7px;gap:3px 6px;font-size:.68rem;line-height:1.3}
      .astro-match-review-components .astro-match-koota small{font-size:.62rem;margin:0}
      .astro-match-review-grid>.astro-match-review-notes{display:grid;grid-template-columns:1fr;gap:5px}
      .astro-match-review-notes p{margin:0;font-size:.66rem;line-height:1.35}
      .astro-match-review-grid>.astro-match-review-meta{font-size:.65rem;opacity:.78}
      .astro-match-review-grid>p:nth-child(3),.astro-match-review-grid>.astro-match-review-notes{grid-column:1/-1}
      .astro-match-review-grid>p{margin:0}
      @media(max-width:520px){
        .astro-match-review-card{padding:9px}
        .astro-match-review-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
        .astro-match-review-grid>*{padding:7px;font-size:.66rem}
        .astro-match-review-grid>small{font-size:.62rem}
        .astro-match-review-index{font-size:1.3rem}
        .astro-match-review-components .astro-match-koota{font-size:.64rem}
        .astro-match-review-components .astro-match-koota small,.astro-match-review-notes p{font-size:.60rem}
        .astro-match-data-row{grid-template-columns:1fr;gap:3px}
        .astro-match-accordion>summary{padding:13px 38px 13px 12px}
      }
    
      .astro-match-professional-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0 16px}
      .astro-match-professional-item{min-width:0;padding:12px;border:1px solid rgba(220,176,100,.30);border-radius:12px;background:rgba(180,150,110,.07)}
      .astro-match-professional-item h4{font-size:.78rem;line-height:1.25;margin:0 0 7px;color:#e9c77e;font-weight:650}
      .astro-match-professional-item>strong{display:block;font-size:.92rem;line-height:1.3;overflow-wrap:anywhere}
      .astro-match-professional-item p{font-size:.72rem;line-height:1.4;margin:6px 0 0;opacity:.78;overflow-wrap:anywhere}
      .astro-match-professional-item.is-good{border-color:rgba(105,170,125,.35)}
      .astro-match-professional-item.is-caution{border-color:rgba(210,155,80,.42)}
      .astro-match-professional-item.is-muted{opacity:.82}
      @media(max-width:520px){.astro-match-professional-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.astro-match-professional-item{padding:9px}.astro-match-professional-item h4{font-size:.69rem}.astro-match-professional-item>strong{font-size:.78rem}.astro-match-professional-item p{font-size:.64rem;line-height:1.32}}
`;
    document.head.appendChild(style);
  }

  function humanizeMatchKey(key) {
    return String(key || "").replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function formatMatchValue(value) {
    if (value === null || value === undefined || value === "") return "Not available";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.length ? value.map(formatMatchValue).join(", ") : "None";
    if (typeof value === "object") return "";
    return String(value);
  }

  function appendMatchData(parent, data, depth = 0) {
    if (data === null || data === undefined) {
      const empty = document.createElement("p");
      empty.className = "astro-match-muted";
      empty.textContent = language === "hi" ? "यह जानकारी उपलब्ध नहीं है।" : "This information is not available.";
      parent.appendChild(empty);
      return;
    }
    if (typeof data !== "object") {
      const value = document.createElement("p");
      value.textContent = formatMatchValue(data);
      parent.appendChild(value);
      return;
    }

    const entries = Array.isArray(data)
      ? data.map((value, index) => [`Item ${index + 1}`, value])
      : Object.entries(data);

    entries.forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      if (typeof value === "object") {
        const group = document.createElement("div");
        group.className = "astro-match-data-group";
        if (depth < 1) {
          const heading = document.createElement("h5");
          heading.textContent = humanizeMatchKey(key);
          group.appendChild(heading);
        }
        appendMatchData(group, value, depth + 1);
        parent.appendChild(group);
      } else {
        const row = document.createElement("div");
        row.className = "astro-match-data-row";
        const label = document.createElement("span");
        label.textContent = humanizeMatchKey(key);
        const content = document.createElement("strong");
        content.textContent = formatMatchValue(value);
        row.append(label, content);
        parent.appendChild(row);
      }
    });
  }

  function createMatchAccordion(title, content, open = false) {
    const details = document.createElement("details");
    details.className = "astro-match-accordion";
    details.open = open;
    const summary = document.createElement("summary");
    summary.textContent = title;
    const body = document.createElement("div");
    body.className = "astro-match-accordion-body";
    if (typeof content === "function") content(body);
    else appendMatchData(body, content);
    details.append(summary, body);
    return details;
  }

  function appendMatchResult(payload) {
    addMatchStyles();
    const matchData = payload.data || {};
    const advanced = payload.advanced || {};
    const finalReview = advanced.finalReview || {};
    const card = document.createElement("article");
    card.className = "gemini-insight-card astro-match-score-card";

    const summary = document.createElement("section");
    summary.className = "astro-match-summary";
    const scoreCopy = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = language === "hi" ? "अष्टकूट गुण मिलान" : "Ashtakoota Guna Milan";
    const score = document.createElement("p");
    score.className = "astro-match-total";
    score.textContent = `${matchData.total ?? "—"} / ${matchData.max ?? 36}`;
    const conclusion = document.createElement("p");
    conclusion.className = "astro-match-conclusion";
    conclusion.textContent = matchData.conclusion || (language === "hi" ? "गुण मिलान पूरा नहीं हुआ।" : "Guna Milan result");
    scoreCopy.append(heading, score, conclusion);
    summary.appendChild(scoreCopy);
    card.appendChild(summary);

    const grid = document.createElement("div");
    grid.className = "astro-match-professional-grid";

    const addResultCard = (title, result, detail, state = "neutral") => {
      const item = document.createElement("section");
      item.className = `astro-match-professional-item is-${state}`;
      const h = document.createElement("h4");
      h.textContent = title;
      const r = document.createElement("strong");
      r.textContent = result;
      item.append(h, r);
      if (detail) {
        const p = document.createElement("p");
        p.textContent = detail;
        item.appendChild(p);
      }
      grid.appendChild(item);
      return item;
    };
    const availableText = language === "hi" ? "उपलब्ध नहीं" : "Not available";
    const reviewLater = language === "hi"
      ? "इस गणना का परिणाम अभी प्राप्त नहीं हुआ। कृपया बाद में पुनः प्रयास करें।"
      : "This calculation could not be retrieved right now. Please try again later.";

    // Overall compatibility score — always shown separately from Ashtakoota.
    // A provisional score is clearly labelled when some weighted measures are missing.
    const overallScore = Number(finalReview.score);
    const overallAvailable = Number.isFinite(overallScore) && finalReview.outOf === 100;
    const overallState = finalReview.complete ? "good" : (overallAvailable ? "caution" : "muted");
    const overallLabel = finalReview.complete
      ? (language === "hi" ? "समग्र अनुकूलता" : "Overall Compatibility")
      : (language === "hi" ? "समग्र अनुकूलता · अस्थायी" : "Overall Compatibility · Provisional");
    const overallValue = overallAvailable
      ? `${Math.round(overallScore)} / 100`
      : (language === "hi" ? "गणना उपलब्ध नहीं" : "Not available yet");
    const overallDetail = overallAvailable
      ? (finalReview.complete
          ? (language === "hi" ? "सभी प्रमुख मिलान गणनाएँ उपलब्ध हैं" : "All weighted matching measures are available")
          : (language === "hi" ? "उपलब्ध पारंपरिक गणनाओं के आधार पर; कुछ परिणाम शेष हैं" : "Based on available traditional measures; some results are still pending"))
      : (language === "hi" ? "परिणाम मिलने पर समग्र अंक दिखेंगे" : "The overall score will appear when matching results are available");
    addResultCard(overallLabel, overallValue, overallDetail, overallState);

    // Tamil 10-Porutham / Dashakoot
    const porutham = advanced.southIndianPorutham;
    if (porutham?.success) {
      const d = porutham.data || {};
      const scoreText = Number.isFinite(Number(d.score)) && Number.isFinite(Number(d.max))
        ? `${d.score} / ${d.max}`
        : (d.conclusion || d.result || (language === "hi" ? "गणना पूरी" : "Calculated"));
      const agrees = Array.isArray(d.poruthams) ? d.poruthams.filter(x => x.result === "agrees").length : null;
      const total = Array.isArray(d.poruthams) ? d.poruthams.length : null;
      addResultCard(language === "hi" ? "दक्षिण भारतीय पोरुथम" : "Tamil 10-Porutham",
        scoreText,
        agrees !== null ? `${agrees} / ${total} ${language === "hi" ? "अनुकूल" : "agree"}` : (d.conclusion || d.text || ""),
        "good");
    } else {
      addResultCard(language === "hi" ? "दक्षिण भारतीय पोरुथम" : "Tamil 10-Porutham", availableText, reviewLater, "muted");
    }

    // Papasamyam
    const papa = advanced.papasamyam;
    if (papa?.success && papa.data) {
      const p = papa.data;
      const result = p.result === "satisfactory"
        ? (language === "hi" ? "अनुकूल" : "Satisfactory")
        : p.result === "not_satisfactory"
          ? (language === "hi" ? "पुनर्विचार आवश्यक" : "Needs traditional review")
          : (p.text || (language === "hi" ? "गणना पूरी" : "Calculated"));
      const detail = `${language === "hi" ? "वर" : "Groom"}: ${p.groom?.total ?? "—"} · ${language === "hi" ? "वधू" : "Bride"}: ${p.bride?.total ?? "—"}`;
      addResultCard(language === "hi" ? "पापसम्यम" : "Papasamyam", result, detail, p.result === "satisfactory" ? "good" : "caution");
    } else {
      addResultCard(language === "hi" ? "पापसम्यम" : "Papasamyam", availableText, reviewLater, "muted");
    }

    // Provider couple-level Manglik verdict
    const manglikMatch = advanced.manglikCompatibility;
    if (manglikMatch?.success) {
      const d = manglikMatch.data || {};
      const a = d.person_a?.manglik;
      const b = d.person_b?.manglik;
      const result = typeof a === "boolean" && typeof b === "boolean"
        ? (a === b ? (language === "hi" ? "मांगलिक स्थिति समान" : "Compatible Manglik status") : (language === "hi" ? "स्थिति अलग — ज्योतिषीय समीक्षा आवश्यक" : "Different status — review needed"))
        : (d.conclusion || (language === "hi" ? "गणना पूरी" : "Calculated"));
      addResultCard(language === "hi" ? "मांगलिक मिलान" : "Manglik Matching", result,
        `${language === "hi" ? "वर" : "Groom"}: ${typeof a === "boolean" ? (a ? "Manglik" : "Non-Manglik") : "—"} · ${language === "hi" ? "वधू" : "Bride"}: ${typeof b === "boolean" ? (b ? "Manglik" : "Non-Manglik") : "—"}`,
        a === b ? "good" : "caution");
    } else {
      addResultCard(language === "hi" ? "मांगलिक मिलान" : "Manglik Matching", availableText, reviewLater, "muted");
    }

    // D1/D9 chart availability and marriage indicators
    [advanced.personA, advanced.personB].forEach((person, index) => {
      const name = person?.name || (index === 0 ? "Person A" : "Person B");
      const chart = person?.marriageChart || {};
      const d1 = chart.d1;
      const d9 = chart.d9;
      const manglik = person?.manglik;
      const d1Text = d1?.lagna
        ? `${language === "hi" ? "लग्न" : "Lagna"}: ${d1.lagna}`
        : availableText;
      const d9Text = d9?.planetaryPlacementsAvailable
        ? (language === "hi" ? "D9 ग्रह स्थितियाँ उपलब्ध" : "D9 placements available")
        : d9?.lagnaAvailable
          ? `${language === "hi" ? "D9 लग्न" : "D9 Lagna"}: ${d9.lagna} · ${language === "hi" ? "ग्रह स्थिति अधूरी" : "planetary placements incomplete"}`
          : availableText;
      const item = addResultCard(`${name} · D1 / D9`,
        d1Text,
        `${d9Text}${manglik?.available ? ` · ${manglik.isManglik ? "Manglik" : "Non-Manglik"} (${(manglik.flaggedReferences || []).join(", ") || "Lagna/Moon/Venus"})` : ""}`,
        d1 ? "good" : "muted");
      if (!d1) item.querySelector("p").textContent = reviewLater;
    });

    // Dasha comparison, shown only when both sides have usable data.
    const dasha = advanced.dashaComparison;
    if (dasha?.available && dasha.periods) {
      const periods = Object.entries(dasha.periods).map(([key, value]) =>
        `${formatLabel(key)}: ${value.personA || "—"} / ${value.personB || "—"}`
      ).join(" · ");
      addResultCard(language === "hi" ? "विंशोत्तरी दशा" : "Vimshottari Dasha", language === "hi" ? "तुलना उपलब्ध" : "Comparison available", periods, "good");
    } else {
      addResultCard(language === "hi" ? "विंशोत्तरी दशा" : "Vimshottari Dasha", availableText, reviewLater, "muted");
    }

    card.appendChild(grid);

    // Traditional eight-koota details are available on demand, not dumped into the page.
    card.appendChild(createMatchAccordion(
      language === "hi" ? "अष्टकूट के आठ गुण" : "Ashtakoota — 8 Gunas",
      body => {
        const table = document.createElement("div");
        table.className = "astro-match-kootas";
        (Array.isArray(matchData.kootas) ? matchData.kootas : []).forEach(koota => {
          const row = document.createElement("div");
          row.className = "astro-match-koota";
          const name = document.createElement("strong");
          name.textContent = koota.label || koota.name || "Koota";
          const points = document.createElement("span");
          points.textContent = `${koota.score ?? "—"} / ${koota.max ?? "—"}`;
          row.append(name, points);
          if (koota.note) {
            const note = document.createElement("small");
            note.textContent = koota.note;
            row.appendChild(note);
          }
          table.appendChild(row);
        });
        body.appendChild(table);
      }
    ));

    // Detailed traditional findings only; never expose HTTP status codes or provider payloads.
    card.appendChild(createMatchAccordion(
      language === "hi" ? "पापसम्यम विवरण" : "Papasamyam Details",
      body => {
        const p = advanced.papasamyam?.data;
        if (!p) {
          const note = document.createElement("p");
          note.className = "astro-match-muted";
          note.textContent = reviewLater;
          body.appendChild(note);
          return;
        }
        const detail = document.createElement("p");
        detail.textContent = `${language === "hi" ? "वर" : "Groom"}: ${p.groom?.total ?? "—"} · ${language === "hi" ? "वधू" : "Bride"}: ${p.bride?.total ?? "—"} · ${p.text || ""}`;
        body.appendChild(detail);
      }
    ));

    card.appendChild(createMatchAccordion(
      language === "hi" ? "मांगलिक और विवाह कुंडली" : "Manglik & Marriage Chart",
      body => {
        [advanced.personA, advanced.personB].forEach(person => {
          const h = document.createElement("h5");
          h.textContent = person?.name || (language === "hi" ? "व्यक्ति" : "Person");
          body.appendChild(h);
          const chart = person?.marriageChart || {};
          const d1 = chart.d1;
          const d9 = chart.d9;
          const p = document.createElement("p");
          p.textContent = d1?.seventhHouse
            ? `D1 · ${d1.lagna || "—"} Lagna · 7th house ${d1.seventhHouse.seventhHouseSign || "—"} · Lord ${d1.seventhHouse.seventhLord || "—"}`
            : reviewLater;
          body.appendChild(p);
          const p9 = document.createElement("p");
          p9.textContent = d9?.planetaryPlacementsAvailable
            ? `D9 · ${d9.lagna || d9.seventhHouseSign || "Chart available"}`
            : (d9?.lagnaAvailable ? `D9 Lagna: ${d9.lagna}. Planetary placements are incomplete.` : `D9: ${availableText}.`);
          body.appendChild(p9);
          const manglik = person?.manglik;
          const pm = document.createElement("p");
          pm.textContent = manglik?.available
            ? `${manglik.isManglik ? "Manglik" : "Non-Manglik"} by D1 screening · ${manglik.flaggedReferences?.join(", ") || "No flagged reference"}`
            : `Manglik: ${availableText}.`;
          body.appendChild(pm);
        });
      }
    ));

    const disclaimer = document.createElement("small");
    disclaimer.className = "gemini-dasha-disclaimer";
    disclaimer.textContent = language === "hi"
      ? "यह पारंपरिक ज्योतिषीय मिलान है; विवाह का अंतिम निर्णय आपसी सहमति, संवाद और समझ से लें।"
      : "Traditional Jyotish matching is one perspective; marriage decisions should also consider mutual consent, communication and understanding.";
    card.appendChild(disclaimer);
    matchOutput.appendChild(card);
  }

  matchButton.addEventListener("click", async () => {
    const primary = getBirthDetails();
    if (!primary) {
      matchStatus.textContent = language === "hi"
        ? "पहले ऊपर अपनी जन्म तिथि, समय और स्थान भरकर कुंडली तैयार करें।"
        : "First enter your own date, time and place above and generate your Kundali.";
      document.getElementById("vedicKundliForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!partnerDate.value || !partnerTime.value || !partnerPlace.value.trim()) {
      matchStatus.textContent = language === "hi" ? "साथी की सभी जन्म जानकारी भरें।" : "Please complete all three partner birth fields.";
      return;
    }
    if (personARole.value === partnerRole.value) {
      matchStatus.textContent = language === "hi"
        ? "एक व्यक्ति को वर और दूसरे को वधू चुनें।"
        : "Choose one Groom and one Bride. You can switch the assignments.";
      return;
    }
    if (!matchConsent.checked) {
      matchStatus.textContent = language === "hi"
        ? "पहले जन्म जानकारी साझा करने की सहमति दें।"
        : "Please consent before sending both birth profiles to AstroLogics.";
      matchConsent.focus();
      return;
    }

    matchButton.disabled = true;
    matchButton.textContent = language === "hi" ? "मिलान हो रहा है..." : "Matching...";
    matchStatus.textContent = language === "hi" ? "अष्टकूट गणना की जा रही है..." : "Calculating the compatibility measures and chart checks in parallel. Some advanced details may be marked unavailable if the provider is slow...";
    matchOutput.replaceChildren();
    try {
      const response = await fetch("/.netlify/functions/kundali-matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true,
          personA: { name: personAName.value.trim(), gender: personAGender.value, role: personARole.value, date: primary.date, time: primary.time, place: primary.place },
          personB: { name: partnerName.value.trim(), gender: partnerGender.value, role: partnerRole.value, date: partnerDate.value, time: partnerTime.value, place: partnerPlace.value.trim() },
          language: language || "en"
        })
      });
      const payload = await readResponse(response);
      const matchData = payload.data;
      if (!payload.success || !matchData) throw new Error(payload.error || "AstroLogics returned no matching result.");
      appendMatchResult(payload);
      matchStatus.textContent = language === "hi" ? "गुण मिलान तैयार है।" : "Ashtakoot matching is ready.";

      if (consent.checked) {
        try {
          const aiResponse = await fetch("/.netlify/functions/ai-explain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              consent: true,
              topic: "kundali_matching",
              matchReport: { data: matchData, advanced: payload.advanced || null, warnings: payload.warnings || [], providerErrors: payload.providerErrors || [] },
              language: language || "en",
              question: "Write a concise, warm, professional Pandit-style marriage compatibility reading in 6 short sections: overall compatibility score out of 100 (clearly label provisional or complete); Ashtakoota score and key gunas; Tamil 10-Porutham; Papasamyam; Manglik for both people; D1/D9 and Dasha only when actual chart data exists. For each available measure say whether it agrees, is mixed, or needs traditional review. Never show API errors, HTTP codes, internal field names, raw JSON, or technical diagnostics. If a calculation is missing, say briefly that this particular reading is not available yet; do not invent it. Keep the entire answer under 190 words."
            })
          });
          const aiPayload = await readResponse(aiResponse);
          if (aiPayload.explanation) {
            const reading = document.createElement("div");
            reading.className = "astro-match-ai-reading";
            renderGeminiExplanation(aiPayload.explanation, reading, aiPayload.engine);
            matchOutput.appendChild(reading);
            if (aiPayload.finishReason === "length") {
              const truncated = document.createElement("p");
              truncated.className = "astro-match-warning";
              truncated.textContent = language === "hi"
                ? "AI व्याख्या की सीमा पूरी हुई; ऊपर दिए गए तकनीकी परिणाम फिर भी पूरे उपलब्ध हैं।"
                : "The AI explanation reached its output limit; the structured matching results above remain available.";
              matchOutput.appendChild(truncated);
            }
          } else {
            throw new Error(aiPayload.error || "AI explanation was not returned.");
          }
        } catch (aiError) {
          const note = document.createElement("p");
          note.className = "astro-match-warning";
          note.textContent = (language === "hi" ? "कुंडली मिलान तैयार है, लेकिन AI व्याख्या उपलब्ध नहीं हुई: " : "The matching calculations are ready, but the optional AI explanation failed: ") + (aiError.message || "Please retry the explanation.");
          matchOutput.appendChild(note);
        }
      } else {
        const note = document.createElement("p");
        note.textContent = language === "hi"
          ? "AI पंडित की विस्तृत व्याख्या के लिए ऊपर AI व्याख्या की सहमति भी चुनें और फिर मिलान दोबारा करें।"
          : "For a warm AI Pandit explanation of the result, also select the AI explanation consent above and run the match again.";
        matchOutput.appendChild(note);
      }
    } catch (error) {
      const message = String(error?.message || "");
      if (/daily.{0,30}(test|call).{0,20}cap|test.{0,20}cap.{0,30}(reached|reset)|daily.{0,20}limit.{0,20}reached/i.test(message)) {
        matchStatus.textContent = language === "hi"
          ? "AstroLogics की दैनिक टेस्ट API सीमा पूरी हो गई है। यह वेबसाइट की त्रुटि नहीं है। API सीमा रीसेट होने तक प्रतीक्षा करें या सक्रिय Live API key का उपयोग करें। बार-बार Match न दबाएँ।"
          : "AstroLogics' daily test-call quota has been reached. This is an API-account limit, not a website error. Wait for the quota reset or switch to an active Live API key. Please do not keep retrying.";
      } else if (/quota|credits exhausted|insufficient credits/i.test(message)) {
        matchStatus.textContent = language === "hi"
          ? "AstroLogics API credits समाप्त हो गए हैं। Dashboard में credits जाँचें या quota reset होने पर पुनः प्रयास करें।"
          : "AstroLogics API credits are exhausted. Check your provider dashboard or retry after the quota resets.";
      } else if (/429|too many requests|rate.?limit/i.test(message)) {
        matchStatus.textContent = language === "hi"
          ? "AstroLogics ने बहुत अधिक अनुरोधों के कारण अनुरोध रोक दिया है। थोड़ी देर बाद केवल एक बार पुनः प्रयास करें।"
          : "AstroLogics temporarily rate-limited this request. Wait briefly, then retry once.";
      } else if (/timed out|timeout|abort/i.test(message)) {
        matchStatus.textContent = language === "hi"
          ? "गणना में समय अधिक लग रहा है। इंटरनेट और Netlify terminal जाँचें, फिर एक बार पुनः प्रयास करें।"
          : "The matching calculation timed out. Check your connection and Netlify terminal, then retry once.";
      } else {
        matchStatus.textContent = message || "Unable to complete Kundali matching.";
      }
    } finally {
      matchButton.disabled = false;
      matchButton.textContent = language === "hi" ? "कुंडली मिलान करें" : "Match Kundalis";
    }
  });

  matchingSection.append(matchingTitle, matchingCopy, partnerFields, matchConsentLabel, matchButton, matchStatus, matchOutput);

  const status = document.createElement("p");
  status.className = "gemini-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const output = document.createElement("div");
  output.className = "gemini-results";

  askButton.addEventListener("click", async () => {
    const question = questionInput.value.trim();
    if (!question) {
      status.textContent = language === "hi" ? "कृपया अपना प्रश्न लिखें।" : "Please type your question first.";
      questionInput.focus();
      return;
    }
    if (!consent.checked) {
      status.textContent = language === "hi"
        ? "AI उत्तर के लिए पहले सहमति दें।"
        : "Please provide consent before sending your question and relevant chart data to Groq AI.";
      consent.focus();
      return;
    }

    askButton.disabled = true;
    askButton.textContent = language === "hi" ? "उत्तर तैयार हो रहा है..." : "Preparing your answer...";
    status.textContent = language === "hi"
      ? "आपकी कुंडली के उपलब्ध गणना डेटा का अध्ययन किया जा रहा है..."
      : "Your astrologer is reviewing the available chart calculations...";
    output.replaceChildren();

    try {
      const response = await fetch("/.netlify/functions/ai-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true,
          report,
          language: language || "en",
          topic: "overall",
          question
        })
      });
      const payload = await readResponse(response);
      if (!payload.explanation) throw new Error(payload.error || "AI returned no answer.");
      renderGeminiExplanation(payload.explanation, output, payload.engine);
      status.textContent = language === "hi" ? "आपका उत्तर तैयार है।" : "Your answer is ready.";
      output.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      status.textContent = error.message || "Unable to answer your question right now.";
    } finally {
      askButton.disabled = false;
      askButton.textContent = language === "hi" ? "प्रश्न भेजें" : "Ask Pandit";
    }
  });

  let activeRequest = 0;

  topics.forEach(topic => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gemini-topic-btn";
    button.dataset.topic = topic.id;

    const title = language === "hi" ? topic.hi : topic.en;
    const desc = language === "hi" ? topic.descHi : topic.descEn;

    const icon = document.createElement("span");
    icon.className = "gemini-topic-icon";
    icon.textContent = topic.icon;

    const copy = document.createElement("span");
    copy.className = "gemini-topic-copy";

    const strong = document.createElement("strong");
    strong.textContent = title;

    const small = document.createElement("small");
    small.textContent = desc;

    copy.append(strong, small);
    button.append(icon, copy);

    button.addEventListener("click", async () => {
      if (topic.id === "kundali_matching") {
        matchingSection.scrollIntoView({ behavior: "smooth", block: "start" });
        matchStatus.textContent = language === "hi"
          ? "दोनों व्यक्तियों की जन्म जानकारी भरकर कुंडली मिलान करें।"
          : "Enter both people's birth details below to start Kundali matching.";
        return;
      }
      if (!consent.checked) {
        status.textContent = language === "hi"
          ? "कृपया पहले AI व्याख्या के लिए सहमति दें।"
          : "Please provide consent before requesting an AI explanation.";
        consent.focus();
        return;
      }

      const requestId = ++activeRequest;

      topicGrid.querySelectorAll("button").forEach(item => {
        item.disabled = true;
        item.classList.toggle("is-active", item === button);
      });

      status.textContent = language === "hi"
        ? `${title} का विश्लेषण तैयार किया जा रहा है...`
        : `Preparing your ${title} explanation...`;

      output.replaceChildren();

      const loading = document.createElement("p");
      loading.className = "gemini-loading";
      loading.textContent = language === "hi"
        ? "AstroLogics के संबंधित डेटा का विश्लेषण हो रहा है। कृपया प्रतीक्षा करें..."
        : "Analysing the relevant AstroLogics data. Please wait...";
      output.appendChild(loading);

      try {
        const response = await fetch("/.netlify/functions/ai-explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent: true,
            report,
            language: language || "en",
            topic: topic.id
          })
        });

        const payload = await readResponse(response);

        if (requestId !== activeRequest) return;
        if (!payload.explanation) {
          throw new Error(payload.error || "AI returned no explanation.");
        }

        renderGeminiExplanation(payload.explanation, output, payload.engine);
        status.textContent = language === "hi"
          ? `${title} की व्याख्या तैयार है।`
          : `${title} explanation is ready.`;

      } catch (error) {
        if (requestId !== activeRequest) return;

        console.error("Topic AI explanation error:", error);
        output.replaceChildren();

        const errorText = document.createElement("p");
        errorText.textContent = error.message || "Unable to generate this explanation.";
        output.appendChild(errorText);

        status.textContent = language === "hi"
          ? "व्याख्या तैयार नहीं हो सकी। कृपया बाद में प्रयास करें।"
          : "The explanation could not be generated. Please try again.";

      } finally {
        if (requestId === activeRequest) {
          topicGrid.querySelectorAll("button").forEach(item => {
            item.disabled = false;
          });
        }
      }
    });

    topicGrid.appendChild(button);
  });

  section.append(header, consentBox, topicGrid, askSection, matchingSection, status, output);
  container.appendChild(section);

  if (pendingDashboardTopic) {
    const requestedTopic = pendingDashboardTopic;
    pendingDashboardTopic = "";
    const requestedButton = section.querySelector(
      `.gemini-topic-btn[data-topic="${requestedTopic}"]`
    );
    if (requestedButton) {
      window.setTimeout(() => requestedButton.click(), 150);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (dashboardStatus) {
      dashboardStatus.textContent =
        "That topic is not available in the current report. Please choose another available life area.";
    }
  }
}

// ==========================================
// RENDER AI RESPONSE AS STRUCTURED CARDS
// ==========================================


function renderGeminiExplanation(text, container, engineData = null) {
  container.replaceChildren();

  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n");

  const cardGrid = document.createElement("div");
  cardGrid.className = "gemini-card-grid";

  let currentCardBody = null;
  let currentCard = null;
  let currentList = null;
  let currentListType = "";
  let suppressLegacyTimeline = false;
  let suppressStrengthSection = false;
  let suppressOpportunitySection = false;
  let strengthWeaknessCardInserted = false;
  let opportunityCardInserted = false;

  function appendInlineMarkdown(parent, value) {
    const pattern = /(\*\*[^*]+\*\*|(?<!\*)\*[^*]+\*(?!\*)|`[^`]+`)/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parent.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
      }

      const token = match[0];
      if (token.startsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = token.slice(2, -2);
        parent.appendChild(strong);
      } else if (token.startsWith("`")) {
        const code = document.createElement("code");
        code.textContent = token.slice(1, -1);
        parent.appendChild(code);
      } else {
        const italic = document.createElement("em");
        italic.textContent = token.slice(1, -1);
        parent.appendChild(italic);
      }
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < value.length) {
      parent.appendChild(document.createTextNode(value.slice(lastIndex)));
    }
  }

  function createCard(title) {
    const card = document.createElement("article");
    card.className = "gemini-insight-card";

    const heading = document.createElement("h4");
    heading.textContent = title;

    const body = document.createElement("div");
    body.className = "gemini-card-content";

    card.append(heading, body);
    cardGrid.appendChild(card);
    currentCard = card;
    currentCardBody = body;
    return body;
  }

  function ensureCard() {
    if (!currentCardBody) createCard("AI Interpretation");
    return currentCardBody;
  }

  function resetList() {
    currentList = null;
    currentListType = "";
  }

  function isDashaTimelineHeading(title) {
    const normalized = String(title || "").replace(/^\s*\d+[.)]\s*/, "");
    return /(?:full|complete|detailed)?\s*dasha\s*(?:and\s*)?(?:period\s*)?timeline|historical.*periods|past.*dasha|past periods|active.*periods|current.*dasha.*periods|upcoming.*periods|all.*dasha.*periods/i.test(normalized);
  }

  function isStrengthWeaknessHeading(title) {
    const normalized = String(title || "").replace(/^\s*\d+[.)]\s*/, "");
    return /strengths?\s*(?:&|and|\/)\s*(?:weaknesses|challenges)|strengths\s+and\s+weaknesses|weaknesses\s*(?:&|and)\s*strengths/i.test(normalized);
  }

  function isOpportunityHeading(title) {
    const normalized = String(title || "").replace(/^\s*\d+[.)]\s*/, "");
    return /best.*(?:job|career|study|education|marriage|finance|travel).*(?:opportunit|window|period)|(?:job|career|study|education|marriage|finance|travel).*opportunit.*window|opportunity windows from today|favourable .*periods/i.test(normalized);
  }

  function isPracticalGuidanceHeading(title) {
    const normalized = String(title || "").replace(/^\s*\d+[.)]\s*/, "");
    return /practical guidance|practical advice|guidance for|व्यावहारिक मार्गदर्शन/i.test(normalized);
  }

  function insertStrengthWeaknessCard() {
    if (strengthWeaknessCardInserted) return;
    const card = createStructuredStrengthWeaknessCard(engineData);
    if (card) {
      cardGrid.appendChild(card);
      strengthWeaknessCardInserted = true;
    }
  }

  function insertOpportunityCard() {
    if (opportunityCardInserted) return;
    const card = createStructuredOpportunityCard(engineData);
    if (card) {
      cardGrid.appendChild(card);
      opportunityCardInserted = true;
    }
  }

  lines.forEach(rawLine => {
    const line = rawLine.trim();

    if (!line) {
      resetList();
      return;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    const boldHeading = line.match(/^\*\*(.+)\*\*:?$/);
    const headingTitle = headingMatch
      ? headingMatch[1].replace(/\*\*/g, "").trim()
      : boldHeading ? boldHeading[1].trim() : null;

    if (headingTitle) {
      if (suppressStrengthSection) suppressStrengthSection = false;
      if (suppressOpportunitySection) suppressOpportunitySection = false;
      if (isOpportunityHeading(headingTitle)) {
        suppressOpportunitySection = true;
        currentCard = null;
        currentCardBody = null;
        resetList();
        insertOpportunityCard();
        return;
      }
      if (isStrengthWeaknessHeading(headingTitle)) {
        // Render this panel from the deterministic engine metadata below, not
        // from free-form prose, so explicit strong/weak labels cannot be lost.
        suppressStrengthSection = true;
        currentCard = null;
        currentCardBody = null;
        resetList();
        return;
      }

      if (isPracticalGuidanceHeading(headingTitle)) {
        insertStrengthWeaknessCard();
      }

      if (isDashaTimelineHeading(headingTitle)) {
        // Older V2.5.3 answers printed every Dasha period as large visible cards.
        // Suppress those legacy text blocks; the complete structured timeline is
        // added below as an expandable, grouped accordion using engineData.
        suppressLegacyTimeline = true;
        currentCard = null;
        currentCardBody = null;
        resetList();
        return;
      }

      if (suppressLegacyTimeline) suppressLegacyTimeline = false;
      createCard(headingTitle);
      resetList();
      return;
    }

    if (suppressLegacyTimeline || suppressStrengthSection || suppressOpportunitySection) return;

    const body = ensureCard();
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    const numberMatch = line.match(/^\d+[.)]\s+(.+)$/);

    if (bulletMatch || numberMatch) {
      const listType = numberMatch ? "ol" : "ul";
      if (!currentList || currentListType !== listType) {
        currentList = document.createElement(listType);
        body.appendChild(currentList);
        currentListType = listType;
      }
      const item = document.createElement("li");
      appendInlineMarkdown(item, bulletMatch ? bulletMatch[1] : numberMatch[1]);
      currentList.appendChild(item);
      return;
    }

    resetList();
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, line);
    body.appendChild(paragraph);
  });

  // Structured opportunity and strengths panels are guaranteed when the
  // engine supplies career-assessment metadata, even if prose omits headings.
  insertOpportunityCard();
  insertStrengthWeaknessCard();

  // Remove empty headings/cards so the consultation never shows blank panels.
  Array.from(cardGrid.querySelectorAll(".gemini-insight-card")).forEach(card => {
    const body = card.querySelector(".gemini-card-content");
    if (!body || !body.textContent.trim()) card.remove();
  });

  if (cardGrid.children.length) container.appendChild(cardGrid);

  appendExpandableDashaTimeline(container, engineData);

  if (!container.children.length) {
    const fallback = document.createElement("article");
    fallback.className = "gemini-insight-card";
    const title = document.createElement("h4");
    title.textContent = "AI Interpretation";
    const body = document.createElement("div");
    body.className = "gemini-card-content";
    const paragraph = document.createElement("p");
    paragraph.textContent = String(text || "No explanation was returned.");
    body.appendChild(paragraph);
    fallback.append(title, body);
    container.appendChild(fallback);
  }
}

function createStructuredStrengthWeaknessCard(engineData) {
  const careerAssessment = engineData?.careerAssessment;
  const topicAssessment = engineData?.topicAssessment;
  const assessment = careerAssessment || topicAssessment;
  const data = careerAssessment?.strengthWeakness || topicAssessment?.strengthWeakness;
  if (!assessment || !data) return null;

  const card = document.createElement("article");
  card.className = "gemini-insight-card gemini-strength-weakness-card";
  const heading = document.createElement("h4");
  heading.textContent = topicAssessment && !careerAssessment
    ? `Strengths & Weaknesses — ${topicAssessment.topicLabel || "Selected topic"}`
    : "Strengths & Weaknesses";
  const body = document.createElement("div");
  body.className = "gemini-card-content";

  function addGroup(titleText, values, emptyText) {
    const section = document.createElement("section");
    section.className = "gemini-strength-group";
    const title = document.createElement("h5");
    title.textContent = titleText;
    section.appendChild(title);
    if (Array.isArray(values) && values.length) {
      const list = document.createElement("ul");
      values.forEach(value => {
        const item = document.createElement("li");
        if (typeof value === "string") item.textContent = value;
        else if (value && typeof value === "object") {
          const label = value.planet
            ? `${String(value.planet).charAt(0).toUpperCase()}${String(value.planet).slice(1)}`
            : (value.source || "Chart factor");
          const source = value.source && value.planet ? ` (${value.source})` : "";
          const text = value.text || value.statusSource || value.status || "Explicit provider status";
          item.textContent = `${label}${source}: ${text}`;
        } else item.textContent = String(value);
        list.appendChild(item);
      });
      section.appendChild(list);
    } else {
      const paragraph = document.createElement("p");
      paragraph.textContent = emptyText;
      section.appendChild(paragraph);
    }
    body.appendChild(section);
  }

  const strong = (data.strongPlanets || []).map(item => ({
    planet: item.planet,
    statusSource: item.statusSource || "Explicitly marked strong by AstroLogics"
  }));
  const weak = (data.weakPlanets || []).map(item => ({
    planet: item.planet,
    statusSource: item.statusSource || "Explicitly marked weak by AstroLogics"
  }));
  const moderate = (data.moderatePlanets || []).map(item => ({
    planet: item.planet,
    statusSource: item.statusSource || "Explicitly marked moderate by AstroLogics"
  }));

  addGroup("Formal planetary strength — explicitly strong", strong,
    "AstroLogics did not return a readable formal 'strong' status for any planet.");
  addGroup("Formal planetary strength — explicitly weak", weak,
    "AstroLogics did not return a readable formal 'weak' status for any planet. This does not mean the chart has no challenges.");
  if (moderate.length) addGroup("Formal planetary strength — moderate or neutral", moderate,
    "No moderate or neutral status was supplied.");

  const traditionalStrengths = data.traditionalStrengths?.length
    ? data.traditionalStrengths
    : (data.supportiveFactors || []).map(item => ({ source: item.source, text: item.text }));
  const areasToManage = data.areasToManage?.length
    ? data.areasToManage
    : (data.challengeFactors || []).map(item => ({ source: item.source, text: item.text }));

  addGroup("Astrological strengths in the chart", traditionalStrengths,
    "The returned D1/D10 placements do not provide enough detail for a specific placement-based strength reading.");
  addGroup("Weaknesses, pressures and areas to manage", areasToManage,
    "No specific placement-based caution could be extracted from the readable D1/D10 placements. This is not a declaration that no challenges exist.");

  const interpretationKey = document.createElement("p");
  interpretationKey.className = "gemini-strength-data-note";
  interpretationKey.textContent = topicAssessment && !careerAssessment
    ? "How to read this: formal strong/weak labels come only from AstroLogics status fields. Placement-based themes are traditional interpretations of the supplied D1 and topic-specific divisional chart; they are not measured Shadbala."
    : "How to read this: formal strong/weak labels come only from AstroLogics status fields. The chart strengths and cautions below are traditional interpretations of the supplied D1/D10 placements; they are not a substitute for measured Shadbala.";
  body.insertBefore(interpretationKey, body.firstChild);

  if (data.interpretiveSummary) {
    const summary = document.createElement("p");
    summary.className = "gemini-strength-data-note";
    summary.textContent = data.interpretiveSummary;
    body.appendChild(summary);
  }

  const note = document.createElement("p");
  note.className = "gemini-strength-data-note";
  note.textContent = data.strengthDataNote || topicAssessment?.strengthWeakness?.strengthDataNote || "Formal planetary strength labels are shown only when AstroLogics explicitly supplies a readable status. Placement interpretations are shown separately.";
  body.appendChild(note);
  card.append(heading, body);
  return card;
}

function createStructuredOpportunityCard(engineData) {
  const assessment = engineData?.careerAssessment;
  const topicAssessment = engineData?.topicAssessment;
  const summary = assessment?.opportunitySummary || topicAssessment?.opportunitySummary;
  if (!summary) return null;

  const card = document.createElement("article");
  card.className = "gemini-insight-card gemini-opportunity-card";
  const heading = document.createElement("h4");
  heading.textContent = assessment ? "Best Job-Opportunity Windows" : `Favourable ${topicAssessment?.topicLabel || "Topic"} Periods`;
  const body = document.createElement("div");
  body.className = "gemini-card-content";

  const referenceDate = summary.referenceDate || engineData.referenceDate || "";
  const intro = document.createElement("p");
  intro.textContent = `These windows are ranked from the available chart assessment and the Dasha lords active in each dated period. Reference date: ${referenceDate || "not supplied"}. A broad Mahadasha/Antardasha and its shorter child window may both appear when their dates differ. Scores are traditional-indication indices, not a percentage chance of selection.`;
  body.appendChild(intro);

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return String(value || "Not supplied");
    const date = new Date(`${value}T00:00:00Z`);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit", month: "short", year: "numeric", timeZone: "UTC"
    }).format(date);
  }

  function addWindows(titleText, windows, kind, emptyText) {
    const section = document.createElement("section");
    section.className = "gemini-opportunity-group";
    const title = document.createElement("h5");
    title.textContent = titleText;
    section.appendChild(title);

    if (!Array.isArray(windows) || !windows.length) {
      const empty = document.createElement("p");
      empty.textContent = emptyText;
      section.appendChild(empty);
      body.appendChild(section);
      return;
    }

    const list = document.createElement("ol");
    windows.slice(0, 3).forEach(window => {
      const item = document.createElement("li");
      const score = kind === "government" ? window.governmentServiceIndicationScore : window.careerIndicationScore;
      const label = kind === "government" ? window.governmentServiceClassification : window.careerClassification;
      const hierarchy = window.hierarchyLabel || [
        ...(window.parentHierarchy || []).map(parent => `${parent.planet} ${parent.level}`),
        `${window.planet} ${window.level}`
      ].join(" → ");
      const scoreText = score == null ? "Not scored" : `${score}/100 — ${label || "traditional indications"}`;
      const strong = document.createElement("strong");
      strong.textContent = `${hierarchy} · ${scoreText}`;
      item.appendChild(strong);

      const dates = document.createElement("p");
      dates.textContent = `${formatDate(window.startDate)} – ${formatDate(window.endDate)} · ${window.dateStatus === "active" ? "Active now" : window.dateStatus === "upcoming" ? "Upcoming" : "Historical"}`;
      item.appendChild(dates);

      const signals = kind === "government" ? window.governmentPeriodSignals : window.careerPeriodSignals;
      if (Array.isArray(signals) && signals.length) {
        const detail = document.createElement("ul");
        signals.slice(0, 3).forEach(signal => {
          const evidence = document.createElement("li");
          evidence.textContent = signal.description || signal.source || "Dasha activation factor";
          detail.appendChild(evidence);
        });
        item.appendChild(detail);
      }
      list.appendChild(item);
    });
    section.appendChild(list);
    body.appendChild(section);
  }

  if (!assessment && topicAssessment) {
    function addTopicWindows(titleText, windows, emptyText) {
      const group = document.createElement("section");
      group.className = "gemini-opportunity-group";
      const title = document.createElement("h5");
      title.textContent = titleText;
      group.appendChild(title);
      if (!Array.isArray(windows) || !windows.length) {
        const empty = document.createElement("p"); empty.textContent = emptyText; group.appendChild(empty);
      } else {
        const list = document.createElement("ol");
        windows.slice(0, 5).forEach(window => {
          const item = document.createElement("li");
          const hierarchy = window.hierarchyLabel || `${window.planet} ${window.level}`;
          const score = window.indicationScore == null ? "Not scored" : `${window.indicationScore}/100 — ${window.classification || "traditional indications"}`;
          const titleLine = document.createElement("strong");
          titleLine.textContent = `${hierarchy} · ${score}`;
          const dates = document.createElement("p");
          dates.textContent = `${formatDate(window.startDate)} – ${formatDate(window.endDate)} · ${window.dateStatus === "active" ? "Active now" : "Upcoming"}`;
          item.append(titleLine, dates);
          (window.signals || []).slice(0, 2).forEach(signal => {
            const detail = document.createElement("small"); detail.textContent = signal.description || signal.source || "Dasha activation"; item.appendChild(detail);
          });
          list.appendChild(item);
        });
        group.appendChild(list);
      }
      body.appendChild(group);
    }
    addTopicWindows("Current favourable periods", summary.currentWindows, "No current topic-specific period reached the supportive scoring threshold.");
    addTopicWindows("Upcoming favourable periods", summary.upcomingWindows, "No upcoming topic-specific period reached the supportive scoring threshold in the returned Dasha data.");
    if (summary.strongestHistoricalWindow) {
      const past = document.createElement("p");
      past.textContent = `Strongest historical period (past context only): ${summary.strongestHistoricalWindow.hierarchyLabel} · ${summary.strongestHistoricalWindow.indicationScore}/100. It is not a future opportunity.`;
      body.appendChild(past);
    }
    const disclaimer = document.createElement("small");
    disclaimer.className = "gemini-dasha-disclaimer";
    disclaimer.textContent = "These are traditional Jyotish indication indices, not probabilities or guarantees. Only periods with a topic-specific score are ranked.";
    body.appendChild(disclaimer);
    card.append(heading, body);
    return card;
  }

  addWindows("Current career windows", summary.currentCareerWindows, "career",
    "No current career window reached the engine's supportive scoring threshold. The active Dasha periods remain visible in the expandable timeline below.");
  addWindows("Upcoming career windows", summary.upcomingCareerWindows, "career",
    "No upcoming career window reached the supportive scoring threshold in the returned Dasha data.");
  addWindows("Current government-service windows", summary.currentGovernmentServiceWindows, "government",
    "No current period has enough government/service-specific activation to be ranked as a favourable government-job window. This does not cancel the broader career assessment.");
  addWindows("Upcoming government-service windows", summary.upcomingGovernmentServiceWindows, "government",
    "No upcoming government-service window reached the supportive scoring threshold in the returned Dasha data. Do not treat a general career window as a confirmed government-job period.");

  const disclaimer = document.createElement("small");
  disclaimer.className = "gemini-dasha-disclaimer";
  disclaimer.textContent = "These are traditional Jyotish indications for planning and reflection, not scientifically calibrated probabilities or guarantees of employment. A period score is not a job-selection percentage.";
  body.appendChild(disclaimer);
  card.append(heading, body);
  return card;
}

function appendExpandableDashaTimeline(container, engineData) {
  const careerAssessment = engineData?.careerAssessment;
  const topicAssessment = engineData?.topicAssessment;
  const genericDashaTimeline = engineData?.dashaTimeline;
  const windows = careerAssessment?.dashaWindows || topicAssessment?.dashaWindows || genericDashaTimeline;
  if (!Array.isArray(windows) || !windows.length) return;

  const validLevels = new Set(["Mahadasha", "Antardasha", "Pratyantardasha"]);
  const unique = new Map();

  windows.forEach(window => {
    if (!window || !window.startDate || !window.endDate || !window.planet) return;
    const key = `${String(window.planet).toLowerCase()}|${window.startDate}|${window.endDate}`;
    const existing = unique.get(key);
    const isRecognized = validLevels.has(window.level || window.period);
    const existingRecognized = existing && validLevels.has(existing.level || existing.period);
    const hierarchyDepth = Array.isArray(window.hierarchy) ? window.hierarchy.length : 0;
    const existingDepth = Array.isArray(existing?.hierarchy) ? existing.hierarchy.length : 0;
    const isBetter = !existing ||
      (isRecognized && !existingRecognized) ||
      (isRecognized === existingRecognized && hierarchyDepth > existingDepth) ||
      (isRecognized === existingRecognized && hierarchyDepth === existingDepth && existing.hierarchyValid === false && window.hierarchyValid !== false);
    if (isBetter) unique.set(key, window);
  });

  const periods = Array.from(unique.values()).filter(window =>
    ["past", "active", "upcoming"].includes(window.dateStatus)
  ).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)) ||
    (Array.isArray(a.hierarchy) ? a.hierarchy.length : 0) - (Array.isArray(b.hierarchy) ? b.hierarchy.length : 0));
  if (!periods.length) return;

  const groups = [
    { key: "past", title: "Historical periods (past)", status: "past", open: false },
    { key: "active", title: "Current and active periods", status: "active", open: true },
    { key: "upcoming", title: "Upcoming periods", status: "upcoming", open: true }
  ].map(group => ({
    ...group,
    items: periods.filter(period => period.dateStatus === group.status)
  })).filter(group => group.items.length);

  const timelineCard = document.createElement("section");
  timelineCard.className = "gemini-insight-card gemini-dasha-timeline-card";

  const details = document.createElement("details");
  details.className = "astro-technical-accordion gemini-dasha-timeline";

  const summary = document.createElement("summary");
  summary.textContent = `${topicAssessment && !careerAssessment ? `${topicAssessment.topicLabel} Dasha Timeline` : genericDashaTimeline && !careerAssessment ? "Vimshottari Dasha Timeline" : "Full Dasha Timeline"} · ${periods.length} periods · ${groups.find(g => g.key === "past")?.items.length || 0} past · ${groups.find(g => g.key === "active")?.items.length || 0} active · ${groups.find(g => g.key === "upcoming")?.items.length || 0} upcoming`;

  const content = document.createElement("div");
  content.className = "astro-technical-card-content gemini-dasha-timeline-content";

  const intro = document.createElement("p");
  intro.className = "gemini-dasha-intro";
  intro.textContent = "The complete dated timeline returned by AstroLogics is grouped below. Past periods are historical context; only active and upcoming periods are considered for opportunities from the reference date onward.";
  content.appendChild(intro);

  const governmentIntent = engineData.intent === "government_service";
  const genericTopicTimeline = Boolean((topicAssessment && !careerAssessment) || (genericDashaTimeline && !careerAssessment));
  const dateOnlyDashaTimeline = Boolean(genericDashaTimeline && !careerAssessment && !topicAssessment);
  const referenceDate = engineData.referenceDate || "";

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return String(value || "Not supplied");
    const date = new Date(`${value}T00:00:00Z`);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit", month: "short", year: "numeric", timeZone: "UTC"
    }).format(date);
  }

  function addLabelValue(parent, label, value) {
    const paragraph = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    paragraph.appendChild(strong);
    paragraph.appendChild(document.createTextNode(String(value)));
    parent.appendChild(paragraph);
  }

  groups.forEach(group => {
    const groupDetails = document.createElement("details");
    groupDetails.className = "astro-technical-accordion gemini-dasha-group";
    groupDetails.open = group.open;

    const groupSummary = document.createElement("summary");
    groupSummary.textContent = `${group.title} (${group.items.length})`;

    const groupContent = document.createElement("div");
    groupContent.className = "astro-technical-card-content gemini-dasha-group-content";

    group.items.forEach(period => {
      const item = document.createElement("article");
      item.className = "astro-data-card gemini-dasha-period";

      const recognized = validLevels.has(period.level || period.period);
      const level = recognized ? (period.level || period.period) : "Unclassified provider period";
      const title = document.createElement("h6");
      title.textContent = `${period.planet} ${level}`;
      item.appendChild(title);

      addLabelValue(item, "Dates", `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`);
      addLabelValue(item, "Status", period.dateStatus === "past" ? "Historical" : period.dateStatus === "active" ? "Currently active" : "Upcoming");

      const hierarchyText = period.hierarchyLabel || (Array.isArray(period.hierarchy)
        ? period.hierarchy.map(part => `${part.planet || "Unknown"} ${part.level || "period"}`).join(" → ")
        : "Hierarchy not supplied");
      if (hierarchyText) addLabelValue(item, "Dasha chain", hierarchyText);

      const score = dateOnlyDashaTimeline ? null : genericTopicTimeline ? period.indicationScore : governmentIntent
        ? period.governmentServiceIndicationScore
        : period.careerIndicationScore;
      const classification = dateOnlyDashaTimeline ? null : genericTopicTimeline ? period.classification : governmentIntent
        ? period.governmentServiceClassification
        : period.careerClassification;
      const scoreLabel = dateOnlyDashaTimeline ? "Indication" : genericTopicTimeline ? `${topicAssessment?.topicLabel || "Topic"} indication` : governmentIntent ? "Government-service indication" : "Career indication";
      if (score == null || !recognized) {
        addLabelValue(item, scoreLabel, "Not scored — insufficient or unclassified evidence");
      } else {
        addLabelValue(item, scoreLabel, `${score}/100 — ${classification || "Traditional indication index"}`);
      }

      const note = dateOnlyDashaTimeline ? "This period is shown as provider-supplied timing only. It has not been scored for an individual life-area outcome." : genericTopicTimeline ? period.note : governmentIntent ? period.governmentServiceNote : period.careerNote;
      if (note && score == null) {
        const noteEl = document.createElement("p");
        noteEl.textContent = note;
        item.appendChild(noteEl);
      }
      groupContent.appendChild(item);
    });

    groupDetails.append(groupSummary, groupContent);
    content.appendChild(groupDetails);
  });

  const note = document.createElement("small");
  note.className = "gemini-dasha-disclaimer";
  note.textContent = `Reference date: ${referenceDate || "not supplied"}. Scores are traditional-indication indices, not statistical probabilities or guarantees.`;
  content.appendChild(note);

  details.append(summary, content);
  timelineCard.appendChild(details);
  container.appendChild(timelineCard);
}





  // ==========================================
  // COMMON POST REQUEST
  // ==========================================

  async function postAstrology(action, body) {
    const response = await fetch(
      `/.netlify/functions/astrology?action=${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    return await readResponse(response);
  }

  // ==========================================
  // SAFE API RESPONSE HANDLING
  // ==========================================

  async function readResponse(response) {
    const text = await response.text();

    let payload;

    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        "The server returned an invalid response. Check Netlify Dev and the function logs."
      );
    }

    if (!response.ok) {
      const message =
        payload.error?.message ||
        payload.error ||
        payload.message ||
        "Astrology request failed.";

      throw new Error(
        typeof message === "string"
          ? message
          : JSON.stringify(message)
      );
    }

    return payload;
  }

  // ==========================================
  // DISPLAY DAILY RASHIFAL
  // ==========================================

  function displayRashiHoroscope(data, container) {
    container.replaceChildren();

    if (!data) {
      showMessage(container, "No horoscope data received.");
      return;
    }

    const heading = document.createElement("h3");

    heading.textContent =
      `${data.sign_label || data.sign || "Vedic Rashi"} · Daily Reading`;

    const reading = document.createElement("p");

    reading.textContent =
      data.reading || "No reading is available.";

    container.append(heading, reading);

    if (data.scores && typeof data.scores === "object") {
      const scoreContainer = document.createElement("div");

      scoreContainer.className = "vedic-score-grid";

      Object.entries(data.scores).forEach(([category, score]) => {
        const item = document.createElement("div");
        item.className = "vedic-score-item";

        const label = document.createElement("strong");
        label.textContent =
          category.charAt(0).toUpperCase() + category.slice(1);

        const value = document.createElement("span");
        value.textContent = `${score}/100`;

        item.append(label, value);
        scoreContainer.appendChild(item);
      });

      container.appendChild(scoreContainer);
    }

    if (data.date) {
      const dateText = document.createElement("small");
      dateText.textContent = `Reading date: ${data.date}`;
      container.appendChild(dateText);
    }
  }

  // ==========================================
  // DISPLAY BASIC KUNDLI
  // ==========================================

  function displayKundli(data, container, name = "") {
    container.replaceChildren();

    if (!data) {
      showMessage(container, "No Kundli data received.");
      return;
    }

    const heading = document.createElement("h3");

    heading.textContent = name
      ? `${name}'s Vedic Birth Chart`
      : "Your Vedic Birth Chart";

    container.appendChild(heading);

    if (data.lagna) {
      const lagna = data.lagna;

      const section = document.createElement("section");
      section.className = "vedic-lagna-section";

      const title = document.createElement("h4");
      title.textContent = "Lagna Details";

      const details = document.createElement("p");

      details.textContent =
        `Rashi: ${lagna.sign_label || lagna.sign || "N/A"} | ` +
        `Degree: ${lagna.degree ?? "N/A"}° | ` +
        `Nakshatra: ${lagna.nakshatra_label || lagna.nakshatra || "N/A"} | ` +
        `Pada: ${lagna.pada ?? "N/A"}`;

      section.append(title, details);
      container.appendChild(section);
    }

    const planets = Array.isArray(data.planets)
      ? data.planets
      : [];

    if (planets.length) {
      const title = document.createElement("h4");
      title.textContent = "Planetary Positions";

      const table = document.createElement("table");
      table.className = "vedic-planet-table";

      const headers = [
        "Planet",
        "Rashi",
        "Degree",
        "House",
        "Nakshatra"
      ];

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      headers.forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      planets.forEach(planet => {
        const row = document.createElement("tr");

        const values = [
          planet.label || planet.id || "N/A",
          planet.sign_label || planet.sign || "N/A",
          planet.degree_in_sign != null
            ? `${Number(planet.degree_in_sign).toFixed(2)}°`
            : "N/A",
          planet.house ?? "N/A",
          planet.nakshatra_label || planet.nakshatra || "N/A"
        ];

        values.forEach(value => {
          const td = document.createElement("td");
          td.textContent = String(value);
          row.appendChild(td);
        });

        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      container.append(title, table);
    }

    if (data.divisional_lagnas) {
      const title = document.createElement("h4");
      title.textContent = "Divisional Charts";

      const list = document.createElement("ul");

      Object.entries(data.divisional_lagnas).forEach(([chart, sign]) => {
        const item = document.createElement("li");
        item.textContent = `${chart}: ${sign}`;
        list.appendChild(item);
      });

      container.append(title, list);
    }

    if (!data.lagna && !planets.length) {
      renderObject(data, container);
    }
  }

  // ==========================================
  // DISPLAY FULL PHALADESH
  // ==========================================

  function displayPhaladesh(report, container, name = "") {
    container.replaceChildren();

    const calculations = report?.calculations || {};
    const calc = key => calculations[key]?.success ? calculations[key].data : null;
    const kundli = calc("birthChart") || report?.kundli || {};
    const divisional = calc("divisionalCharts") || report?.divisional || {};
    const dasha = calc("vimshottariDasha") || report?.dasha || {};
    const currentDasha = calc("currentDasha") || report?.current_dasha || {};
    const yogas = calc("yogas") || report?.yogas || {};
    const wealth = calc("wealthAnalysis") || report?.wealth || {};
    const shadbala = calc("planetaryStrength") || report?.shadbala || {};

    const intro = document.createElement("p");
    intro.className = "vedic-report-intro";
    intro.textContent = name
      ? `Technical birth-chart results prepared for ${name}. The values below are displayed from the AstroLogics response.`
      : "The values below are displayed from the AstroLogics response. Missing calculations are not filled in or estimated.";
    container.appendChild(intro);

    const profile = extractChartProfile(kundli);
    const summary = document.createElement("div");
    summary.className = "vedic-technical-summary";

    [
      ["Lagna (Ascendant)", profile.lagna || "Not returned"],
      ["Moon sign", profile.moon?.sign_label || profile.moon?.sign || "Not returned"],
      ["Lagna Nakshatra", profile.lagnaNakshatra || "Not returned"],
      ["Planets returned", String(Array.isArray(kundli?.planets) ? kundli.planets.length : 0)]
    ].forEach(([label, value]) => {
      const card = document.createElement("article");
      card.className = "vedic-technical-stat";
      const small = document.createElement("small");
      small.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      card.append(small, strong);
      summary.appendChild(card);
    });
    container.appendChild(summary);

    if (Object.keys(kundli).length) {
      const planetSection = createReportSection("Planetary Positions & Birth Chart");
      displayKundli(kundli, planetSection, name);
      container.appendChild(planetSection);
    }

    const detailGrid = document.createElement("div");
    detailGrid.className = "vedic-technical-grid";
    [
      ["Divisional Charts — D2, D9 & D10", divisional],
      ["Vimshottari Dasha Timeline", dasha],
      ["Current Mahadasha & Antardasha", currentDasha],
      ["Yogas & Doshas", yogas],
      ["Wealth Indicators", wealth],
      ["Planetary Strength — Shadbala", shadbala]
    ].forEach(([title, data]) => {
      if (data && typeof data === "object" && Object.keys(data).length) {
        const section = createReportSection(title);
        renderObject(data, section);
        detailGrid.appendChild(section);
      }
    });
    if (detailGrid.children.length) container.appendChild(detailGrid);

    const failed = Object.entries(calculations)
      .filter(([, item]) => item && !item.success)
      .map(([key]) => formatLabel(key));
    if (failed.length) {
      const note = document.createElement("p");
      note.className = "vedic-calculation-note";
      note.textContent = `Unavailable calculations: ${failed.join(", ")}. The interpretation will be limited to successfully returned data.`;
      container.appendChild(note);
    }

    if (report?.meta) {
      const meta = document.createElement("small");
      meta.className = "vedic-report-meta";
      meta.textContent = `Calculation engine: ${report.meta.engine_version || "Provider"} · Credits used: ${report.meta.credits_charged ?? "Not supplied"}`;
      container.appendChild(meta);
    }
  }

  function extractChartProfile(kundli) {
    const planets = Array.isArray(kundli?.planets) ? kundli.planets : [];
    const getPlanet = name => planets.find(p =>
      String(p.id || p.name || p.label || "").toLowerCase() === name.toLowerCase()
    ) || null;
    const lagna = kundli?.lagna || kundli?.ascendant || {};
    return {
      lagna: lagna.sign_label || lagna.sign || lagna.rashi_label || "",
      lagnaNakshatra: lagna.nakshatra_label || lagna.nakshatra || "",
      moon: getPlanet("moon"),
      sun: getPlanet("sun"),
      mars: getPlanet("mars"),
      mercury: getPlanet("mercury"),
      jupiter: getPlanet("jupiter"),
      venus: getPlanet("venus"),
      saturn: getPlanet("saturn"),
      rahu: getPlanet("rahu"),
      ketu: getPlanet("ketu"),
      planets
    };
  }

  function planetDescription(planet, label) {
    if (!planet) return `${label}'s placement was not available in the returned chart data`;
    const sign = planet.sign_label || planet.sign || planet.rashi_label;
    const house = planet.house ?? planet.house_number;
    const nakshatra = planet.nakshatra_label || planet.nakshatra;
    const parts = [];
    if (sign) parts.push(`${label} in ${sign}`);
    if (house != null) parts.push(`${label} in house ${house}`);
    if (nakshatra) parts.push(`${label} in ${nakshatra} Nakshatra`);
    return parts.join(" · ") || `${label} placement returned`;
  }

  function renderVedicSummary(profile, container) {
    const summary = document.createElement("div");
    summary.className = "vedic-chart-summary";
    const items = [
      ["Lagna", profile.lagna || "Not returned"],
      ["Moon", profile.moon ? (profile.moon.sign_label || profile.moon.sign || "Placement available") : "Not returned"],
      ["Janma Nakshatra", profile.moon?.nakshatra_label || profile.moon?.nakshatra || profile.lagnaNakshatra || "Not returned"]
    ];
    items.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "vedic-summary-item";
      const small = document.createElement("small");
      small.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      card.append(small, strong);
      summary.appendChild(card);
    });
    container.appendChild(summary);
  }

  function buildVedicChapters(data) {
    const { profile: p, divisional, dasha, currentDasha, yogas, wealth, shadbala } = data;
    const factor = (planet, label) => planetDescription(p[planet], label);
    const houseFactor = (house, label) => `House ${house}: ${label}`;
    const has = value => value && Object.keys(value).length > 0;
    const d9 = has(divisional) ? findChartValue(divisional, ["d9", "navamsa", "navamsha"]) : "";
    const d10 = has(divisional) ? findChartValue(divisional, ["d10", "dashamsha", "dasamsa"]) : "";
    const d2 = has(divisional) ? findChartValue(divisional, ["d2", "hora"]) : "";
    const dashaText = has(currentDasha) ? summarizeObject(currentDasha) : (has(dasha) ? summarizeObject(dasha) : "");

    const make = (title, copy, factors) => ({ title, copy, factors: factors.filter(Boolean) });

    return [
      make("01 · Overall life direction",
        `In Jyotish, the Lagna is used as the starting point for understanding temperament, life approach and the structure of the houses. ${p.lagna ? `Your recorded Lagna is ${p.lagna}.` : "The returned data does not identify a Lagna, so an ascendant-based overview cannot be stated here."} The Moon adds the traditional perspective on emotional responses and everyday experience${p.moon ? `; the Moon is recorded in ${p.moon.sign_label || p.moon.sign || "a sign not labelled in the response"}.` : ", but its placement was not available in the response."} Read these factors together rather than treating one placement as a complete description of a person.`,
        [p.lagna ? `Lagna: ${p.lagna}` : "", factor("moon", "Moon"), p.lagnaNakshatra ? `Lagna Nakshatra: ${p.lagnaNakshatra}` : ""]
      ),
      make("02 · Career & profession",
        `Career is traditionally assessed through the 10th house, its lord, the Sun, Saturn and the D10 (Dashamsha) chart. ${p.planets.length ? `The available chart includes ${p.planets.length} planetary entries, which provide the base for a fuller professional assessment.` : "Planetary details were not returned, so a specific career tendency cannot responsibly be inferred."} ${d10 ? `A D10-related result was returned: ${d10}.` : "A readable D10 placement was not identifiable in the returned divisional-chart data."} This section should be interpreted as vocational themes and work-style reflection, not a guarantee of a particular job, promotion or government appointment.`,
        [houseFactor(10, "profession, responsibility and public contribution"), factor("sun", "Sun"), factor("saturn", "Saturn"), d10 ? `D10: ${d10}` : ""]
      ),
      make("03 · Love & relationships",
        `Traditional relationship interpretation considers the 5th house, Venus, Mars and the condition of relevant house lords. Venus is often used to discuss affection, harmony and relationship values, while the 5th house is associated with romance and emotional expression. ${p.venus ? `Your chart records ${p.venus.sign_label || p.venus.sign || "a Venus placement"}.` : "The Venus placement was not returned, so a sign-specific relationship reading is unavailable."} These symbols can prompt reflection on communication, expectations and compatibility; they do not establish whether or when a relationship will occur.`,
        [houseFactor(5, "romance and emotional expression"), factor("venus", "Venus"), factor("mars", "Mars")]
      ),
      make("04 · Marriage & long-term partnership",
        `Marriage is traditionally examined through the 7th house, its lord, Venus, Jupiter and the Navamsa (D9) chart. ${d9 ? `The returned divisional data includes a D9-related result: ${d9}.` : "A clearly labelled D9/Navamsa result was not identifiable in the response, so this report will not invent one."} A complete assessment would compare the 7th-house condition with the D9 and relevant dasha periods. The available information is best used to reflect on partnership values and readiness, not to promise a marriage date, spouse description or outcome.`,
        [houseFactor(7, "marriage and committed partnership"), factor("venus", "Venus"), factor("jupiter", "Jupiter"), d9 ? `D9: ${d9}` : ""]
      ),
      make("05 · Education & learning",
        `Education is commonly explored through the 4th and 5th houses, Mercury and Jupiter, with the 9th house also considered for higher learning, teachers and philosophical study. ${p.mercury ? `Mercury is recorded as ${p.mercury.sign_label || p.mercury.sign || "placed in the chart"}.` : "Mercury's placement was not supplied, so a specific learning-style interpretation cannot be made."} In a fuller reading, house lords and their strengths would be considered together before drawing conclusions about academic direction or learning opportunities.`,
        [houseFactor(4, "foundational education"), houseFactor(5, "intellect and study"), houseFactor(9, "higher learning"), factor("mercury", "Mercury"), factor("jupiter", "Jupiter")]
      ),
      make("06 · Money, savings & wealth",
        `The 2nd house is traditionally associated with savings and accumulated resources, the 11th with gains, and the 5th and 9th may be considered in broader prosperity combinations. ${d2 ? `The divisional response includes a D2/Hora-related result: ${d2}.` : "A clearly labelled D2/Hora result was not identifiable in the returned data."} ${has(wealth) ? `A wealth calculation was returned and is available in the technical section for review.` : "No separate wealth-analysis result was returned."} Astrology cannot replace budgeting, financial planning or professional investment advice.`,
        [houseFactor(2, "savings and accumulated resources"), houseFactor(11, "income and gains"), factor("jupiter", "Jupiter"), factor("venus", "Venus"), d2 ? `D2: ${d2}` : ""]
      ),
      make("07 · Family & home life",
        `The 4th house and Moon are traditionally used when reflecting on home, emotional security, roots and the relationship with one's domestic environment. The 2nd house is also considered for family background and speech. ${p.moon ? `The Moon's recorded placement is ${p.moon.sign_label || p.moon.sign || "available in the chart"}.` : "The Moon's placement was not returned, so this part remains a general explanation of the Jyotish framework."} The full interpretation depends on house lords and aspects, not on one planet alone.`,
        [houseFactor(4, "home, comfort and roots"), houseFactor(2, "family and speech"), factor("moon", "Moon")]
      ),
      make("08 · Current life period & timing",
        `${dashaText ? `The dasha calculation returned the following summary: ${dashaText}.` : "A current Mahadasha/Antardasha summary was not available in a readable form in the returned response."} In Jyotish, Vimshottari Dasha is traditionally used to organise planetary periods; the meaning of a period depends on the planet's natal role, house ownership, placement and supporting factors. Timing should therefore be interpreted in context rather than as a fixed prediction.`,
        [has(currentDasha) ? "Current Dasha calculation returned" : "", has(dasha) ? "Vimshottari Dasha calculation returned" : ""]
      ),
      make("09 · Strengths, challenges & personal growth",
        `Shadbala is a traditional framework for assessing planetary strength, but strength alone does not mean that every result is automatically favourable. The house ruled by a planet, its placement, dignity, associations and dasha context all matter. ${has(shadbala) ? "A Shadbala result was returned; review the technical details to see which planetary strength values the provider supplied." : "A Shadbala result was not returned, so this report avoids ranking planets as strong or weak."} Use the reading as a prompt for thoughtful self-development and practical decision-making.`,
        [has(shadbala) ? "Shadbala calculation returned" : "", has(yogas) ? "Yoga calculation returned" : "", factor("saturn", "Saturn"), factor("jupiter", "Jupiter")]
      )
    ];
  }

  function findChartValue(value, terms, depth = 0) {
    if (!value || depth > 5) return "";
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findChartValue(item, terms, depth + 1);
        if (found) return found;
      }
      return "";
    }
    if (typeof value !== "object") return "";
    for (const [key, item] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (terms.some(term => normalized === term.replace(/[^a-z0-9]/g, ""))) {
        if (typeof item === "string" || typeof item === "number") return `${key}: ${item}`;
        if (item && typeof item === "object") return summarizeObject(item);
      }
    }
    for (const item of Object.values(value)) {
      const found = findChartValue(item, terms, depth + 1);
      if (found) return found;
    }
    return "";
  }

  function summarizeObject(value, depth = 0) {
    if (depth > 2 || value == null) return "";
    if (typeof value !== "object") return String(value);
    if (Array.isArray(value)) return value.slice(0, 4).map(item => summarizeObject(item, depth + 1)).filter(Boolean).join("; ");
    return Object.entries(value).slice(0, 5)
      .map(([key, item]) => `${formatLabel(key)}: ${typeof item === "object" ? summarizeObject(item, depth + 1) : String(item)}`)
      .filter(Boolean).join("; ");
  }

  // ==========================================
  // REPORT SECTION HELPERS
  // ==========================================

  function createReportSection(title) {
    const section = document.createElement("section");
    section.className = "vedic-report-section";

    const heading = document.createElement("h4");
    heading.textContent = title;

    section.appendChild(heading);
    return section;
  }

 
function appendReportSection(container, title, data) {
  if (data === undefined || data === null) return;

  const section = createReportSection(title);
  section.classList.add("astro-technical-card");

  const details = document.createElement("details");
  details.className = "astro-technical-accordion";

  const summary = document.createElement("summary");
  summary.textContent = title;

  const content = document.createElement("div");
  content.className = "astro-technical-card-content";

  renderObject(data, content);

  details.append(summary, content);
  section.appendChild(details);

  container.appendChild(section);
}


  // ==========================================
  // SAFE RECURSIVE DATA RENDERER
  // ==========================================

  
function renderObject(value, container, depth = 0) {
  if (value === undefined || value === null) return;

  // Primitive values
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const valueEl = document.createElement("span");
    valueEl.className = "astro-data-value";
    valueEl.textContent = String(value);
    container.appendChild(valueEl);
    return;
  }

  // Arrays
  if (Array.isArray(value)) {
    if (!value.length) return;

    const list = document.createElement("div");
    list.className = "astro-data-list";

    value.forEach((item, index) => {
      const itemCard = document.createElement("div");
      itemCard.className = "astro-data-card";

      if (item && typeof item === "object") {
        const itemTitle = document.createElement("h6");
        itemTitle.textContent =
          item.name || item.label || item.planet ||
          `Entry ${index + 1}`;

        itemCard.appendChild(itemTitle);
        renderObject(item, itemCard, depth + 1);
      } else {
        itemCard.textContent = String(item);
      }

      list.appendChild(itemCard);
    });

    container.appendChild(list);
    return;
  }

  // Nested objects
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([, item]) => item !== undefined && item !== null
    );

    if (!entries.length) return;

    const group = document.createElement("div");
    group.className = "astro-data-group";

    entries.forEach(([key, item]) => {
      const row = document.createElement("div");
      row.className = "astro-data-row";

      const label = document.createElement("strong");
      label.textContent = formatLabel(key);

      row.appendChild(label);

      if (typeof item === "object") {
        const nested = document.createElement("details");
        nested.className = "astro-data-nested";

        const summary = document.createElement("summary");
        summary.textContent = Array.isArray(item)
          ? `${formatLabel(key)} (${item.length})`
          : `View ${formatLabel(key)}`;

        const content = document.createElement("div");
        content.className = "astro-data-nested-content";

        renderObject(item, content, depth + 1);

        nested.append(summary, content);
        row.appendChild(nested);
      } else {
        const output = document.createElement("span");
        output.className = "astro-data-value";
        output.textContent = String(item);
        row.appendChild(output);
      }

      group.appendChild(row);
    });

    container.appendChild(group);
  }
}


  // ==========================================
  // UTILITIES
  // ==========================================

  function formatLabel(value) {
    return String(value)
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function showMessage(container, message) {
    if (!container) return;

    container.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    paragraph.setAttribute("role", "status");
    paragraph.setAttribute("aria-live", "polite");

    container.appendChild(paragraph);
  }

  function friendlyApiMessage(error) {
    const message = String(error?.message || "");

    if (/rate.limit|rate_limited|too many requests|429/i.test(message)) {
      return "The astrology service is receiving too many requests right now. Please wait about 30–60 seconds, then try once. Avoid repeatedly clicking Generate.";
    }

    if (/quota.exhausted|quota_exhausted/i.test(message)) {
      return "The API monthly credit quota has been reached. Please check your AstroLogics dashboard or try again when the quota resets.";
    }

    if (/place_ambiguous|ambiguous/i.test(message)) {
      return "The birthplace is ambiguous. Please enter a more specific city, district or state.";
    }

    return message || "Unable to complete this astrology request. Please try again later.";
  }

  function setButtonState(button, disabled, text) {
    if (!button) return;

    button.disabled = disabled;
    button.textContent = text;
  }
});
