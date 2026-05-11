const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🚨 Array of models to try in order of priority
const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite-preview-06-17",
    "gemini-1.5-flash",
    "gemini-3-flash-preview",
     "gemini-2.5-Pro",
];

router.post('/analyze', async (req, res) => {
    // Note: We still extract 'jobTitle' from req.body to match the frontend payload, 
    // but we treat it as the 'jobDescription'.
    const { jobTitle: jobDescription, resumeData } = req.body;

   const prompt = `You are a strict ATS (Applicant Tracking System) engine and senior technical recruiter. You are brutally accurate. You do not inflate scores. The average resume scores 45–65 on ATS. Only a near-perfect resume scores above 80.

TARGET JOB DESCRIPTION:
"${jobDescription}"

USER'S RESUME:
${resumeData}

---

TASK 1 — ATS SCORE (0–100)
Score the resume on ONLY the following 40 official ATS criteria. Each criterion is worth 2.5 points. Award full points only if the criterion is clearly and completely satisfied. Award 0 if it is missing or violated. Award 1.25 for partial compliance.

LAYOUT & FORMAT (max 25 pts):
[1] Uses a clean single-column layout with no tables, text boxes, or columns
[2] No images, photos, logos, icons, or decorative graphics present
[3] No headers or footers containing contact info or section titles
[4] Standard fonts only (Arial, Calibri, Times New Roman, Helvetica, or similar)
[5] Font size 10–12pt for body text, 14–18pt for headings
[6] All text is selectable plain text (not embedded as image)
[7] Consistent date format used throughout (e.g. Jan 2025 – Mar 2026)
[8] Consistent formatting for headings, bullet styles, and spacing
[9] Adequate white space — not cluttered or overly sparse
[10] Standard bullet symbols only (• or -), no emojis or special characters

CONTENT STRUCTURE (max 25 pts):
[11] Full name present in the main body (not only in header/footer)
[12] Phone number present
[13] Professional email address present
[14] LinkedIn profile link present
[15] Location (city/state) present if relevant
[16] Standard section headings used: Summary, Education, Experience, Projects, Skills, Certifications
[17] Reverse chronological order used for Education and Experience
[18] Professional Summary present with role-specific keywords
[19] Dedicated Skills section with categorised technologies
[20] Contact details are in the main body, not in a header or footer

KEYWORD & CONTENT QUALITY (max 50 pts):
[21] Resume is tailored — keywords from the job description appear naturally in the resume
[22] Exact technical skills from the job posting are explicitly named
[23] Tools and technologies from the JD are explicitly mentioned
[24] Certifications or qualifications required by the JD are present
[25] Industry-specific terminology from the JD is used
[26] Job title on resume aligns with or closely matches the target role
[27] Each bullet point starts with a strong action verb
[28] Achievements are quantified with numbers, percentages, revenue, or time saved
[29] Focus is on impact and accomplishments, not just responsibilities
[30] Consistent verb tense: present for current roles, past for completed
[31] No keyword stuffing — keywords are integrated naturally
[32] Both full terms and acronyms used for key technologies (e.g. Artificial Intelligence (AI))
[33] Programming languages explicitly listed
[34] Frameworks and libraries explicitly listed
[35] Databases and tools explicitly listed
[36] GPA or academic performance included only if strong and relevant
[37] GitHub, portfolio, or live project links included when relevant
[38] No unnecessary personal info (age, gender, marital status, photo)
[39] Abbreviations spelled out at least once if uncommon
[40] Resume length appropriate: 1 page for students/early career, 2 pages max for experienced

Sum the points for all 40 criteria. That total IS the atsScore. Do not round up. Do not add bonus points. Be strict.

---

TASK 2 — JOB MATCH SCORE (0–100)
This score is already working well. Keep your existing logic: compare resume skills, experience, and responsibilities against the JD. Penalise missing required skills (-10 each), missing required experience, and misaligned seniority level. Be realistic.

---

TASK 3 — GRAMMAR SCORE (0–100)
Check spelling, punctuation, and tense consistency. This can range 65–95.

---

TASK 4 — SUGGESTIONS
Write a short honest paragraph explaining the ATS score — list which specific criteria from the 40 above were failed or only partially met. Then give bullet-pointed, actionable fixes using **bolding** for emphasis.

---

CRITICAL: Return ONLY a valid JSON object. No markdown, no backticks, nothing else.
{
  "atsScore": 58,
  "score": 62,
  "grammarScore": 88,
  "suggestions": "Honest verdict and specific fixes here..."
}
    `;

    // Loop through the models until one succeeds
    for (const modelName of MODELS) {
        try {
            console.log(`\n⏳ Attempting analysis with model: [${modelName}]...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            
            // console.log(`✅ Success using [${modelName}]!`);
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                // If successful, send the response and EXIT the loop/function immediately
                return res.json(JSON.parse(jsonMatch[0]));
            } else {
                throw new Error("AI Format Error: Could not extract JSON.");
            }

        } catch (error) {
            // Catch the error (like a 429 Quota limit) and log it, letting the loop continue to the next model
            // console.error(`⚠️ Model [${modelName}] failed: ${error.message}`);
        }
    }

    // 🚨 If the code reaches this point, ALL models in the array failed
    // console.error("❌ ALL FALLBACK MODELS FAILED.");
    res.status(500).json({ 
        score: 0, 
        atsScore: 0, 
        grammarScore: 0, 
        suggestions: "AI Connection Failed: We are experiencing high traffic. Please try again in 60 seconds." 
    });
});

// --- NEW REWRITE ENDPOINT ---
router.post('/rewrite', async (req, res) => {
    const { text, context } = req.body;

    if (!text) {
        return res.status(400).json({ error: "No text provided to enhance." });
    }

    const prompt = `You are an expert resume writer and career coach. Improve the following text for a resume's "${context}" section. 
    Make it professional, action-oriented, concise, and impactful. 
    
    Rules:
    - Return ONLY the improved text.
    - Do not include conversational filler (e.g., "Here is the improved text:").
    - If the original text uses bullet points, format your response using bullet points with no bullet or numbers symbol.
    - For the important keywords in the text, use **bolding** to make them stand out.
    - Do not make the bold thing in the summary section but do for the rest.
    
    
    Original Text:
    ${text}`;

    // Loop through the models using the exact same fallback system as /analyze
    for (const modelName of MODELS) {
        try {
            console.log(`\n⏳ Attempting rewrite with model: [${modelName}]...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const result = await model.generateContent(prompt);
            const enhancedText = result.response.text();
            
            console.log(`✅ Rewrite success using [${modelName}]!`);
            
            // Send the enhanced text back to the frontend and exit the loop
            return res.json({ enhancedText: enhancedText.trim() });

        } catch (error) {
            console.error(`⚠️ Rewrite Model [${modelName}] failed: ${error.message}`);
        }
    }

    // If all models fail
    console.error("❌ ALL REWRITE FALLBACK MODELS FAILED.");
    res.status(500).json({ error: "AI Connection Failed: Please try again in 60 seconds." });
});

// --- PDF RESUME PARSER ENDPOINT ---
router.post('/parse-resume', async (req, res) => {
    const { pdfBase64 } = req.body;

    if (!pdfBase64) {
        return res.status(400).json({ error: 'No PDF data provided.' });
    }

    const prompt = `Extract every piece of information from this resume PDF and return ONLY a single valid JSON object. No markdown, no backticks, no explanation — just raw JSON.

Use this exact schema:
{
  "name": "",
  "role": "",
  "phone": "",
  "email": "",
  "linkedin": "",
  "github": "",
  "address": "",
  "summary": "",
  "gender": "",
  "age": "",
  "education": [{"school":"","degree":"","date":"","location":"","performance":"","rank":""}],
  "experience": [{"title":"","company":"","date":"","desc":"","note":"","link":"","linkText":"","linkType":"separate"}],
  "projects": [{"title":"","tech":"","date":"","desc":"","link":"","liveLink":""}],
  "techSkills": [{"cat":"","items":""}],
  "achievements": [{"text":"","date":"","desc":"","link":"","linkText":"","linkType":"separate"}],
  "certifications": [{"name":"","date":"","link":"","linkText":"","linkType":"separate"}],
  "extracurricular": [{"org":"","role":"","date":"","desc":"","link":"","linkText":"","linkType":"separate"}],
  "leadership": [{"title":"","subtitle":"","date":"","desc":""}],
  "initiatives": [{"title":"","subtitle":"","desc":""}],
  "ecCategories": [{"cat":"","items":""}],
  "skills": "",
  "languages": "",
  "hobbies": "",
  "coursework": ""
}

Rules:
- Preserve ALL original wording — do not summarise or paraphrase.
- Simple/plain resumes with no bullet points are valid — extract all text into the appropriate fields even if it is written as flowing sentences or paragraphs.
- experience[].desc and projects[].desc: format each bullet as a new line starting with "– " (en-dash + space). If the original has no bullets, convert each sentence into a bullet line.
- experience[].note: fill only if the resume has an italic note or LOR mention below the bullets for that role, otherwise "".
- education[].performance: fill with CGPA, percentage, or score if present, otherwise "".
- education[].rank: fill with rank or position if present, otherwise "".

FIELD ROUTING — follow these rules strictly, do NOT put everything in extracurricular:
- leadership[]: MUST be filled for any named formal position held (Secretary, President, Vice-Captain, Event Head, Coordinator, Core Member with authority, Club Head, etc.). Each entry gets title, subtitle (brief descriptor in parentheses if present), date, and desc formatted as bullet lines starting with "– ".
- initiatives[]: MUST be filled for student-led projects, social activities, campaigns, olympiads, or initiatives presented to external bodies (government, NGOs, universities). Each entry gets title, subtitle, and desc formatted as bullet lines starting with "– ".
- ecCategories[]: MUST be filled when the resume has a grouped extracurricular section with category labels (Sports, Public Speaking, Research & Editorial, Business Competitions, etc.). Each category becomes one entry: cat = category name, items = all bullet lines under it joined with newlines starting with "– ". Do NOT flatten these into extracurricular[].
- extracurricular[]: ONLY use for simple club memberships or activities that are NOT a leadership position, NOT an initiative, and NOT part of a categorised EC section. If leadership/initiatives/ecCategories already cover the content, leave extracurricular as [].

- techSkills: if the resume groups skills by category (Languages, Frameworks, Tools, etc.) extract each group as a separate entry with cat = group name and items = comma-separated skills. Otherwise one entry with cat="" and all skills comma-separated in items.
- achievements[]: fill with standalone awards, ranks, competitive exam results, scholarships, and certifications listed as achievements. Use text for the achievement name and date for the year.
- certifications[]: fill only for formal certification programs with an issuing body (Oracle, Coursera, NPTEL, etc.).
- skills: only fill if the resume has a completely flat ungrouped skills list with no category labels; otherwise leave "".
- linkedin/github: include the full URL exactly as written. If only a username is given, prefix with the correct base URL.
- coursework: comma-separated course names if a relevant coursework section exists, otherwise "".
- gender/age: fill only if explicitly stated in the resume header or personal info section, otherwise "".
- Personal detail sections (Date of Birth, Nationality, Marital Status, Husband's/Father's Name, Declaration) should be ignored — do not map these to any field.
- Career objective sections map to summary.
- Professional qualifications (B.Ed, CTET, UPTET, Diplomas, M.Ed, M.A.) that are not a formal degree from a university go into certifications[] with name = qualification name and date = year if mentioned.
- Responsibilities or personal traits sections (Enthusiastic, Positive attitude, etc.) should be ignored entirely — do not add them to any field.
- If the resume lists languages known in personal details, extract them into the languages field.
- summary: extract the objective or profile summary verbatim if present, otherwise "".
- hobbies/languages: fill from interests or languages section if present, otherwise "".
- Return ONLY the JSON object — nothing before or after it.`;

    for (const modelName of MODELS) {
        try {
            console.log(`\n⏳ Attempting PDF parse with model: [${modelName}]...`);

            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'application/pdf',
                                data: pdfBase64
                            }
                        },
                        { text: prompt }
                    ]
                }]
            });

            const text = result.response.text().trim();
            console.log(`✅ PDF parse success using [${modelName}]!`);

            // Strip accidental markdown fences
            const clean = text
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```\s*$/i, '')
                .trim();

            const jsonMatch = clean.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('AI Format Error: Could not extract JSON from response.');

            const parsed = JSON.parse(jsonMatch[0]);
            return res.json(parsed);

        } catch (error) {
            console.error(`⚠️ PDF Parse Model [${modelName}] failed: ${error.message}`);
        }
    }

    console.error('❌ ALL PDF PARSE FALLBACK MODELS FAILED.');
    res.status(500).json({ error: 'AI Connection Failed: Could not parse the PDF. Please try again in 60 seconds.' });
});

module.exports = router;