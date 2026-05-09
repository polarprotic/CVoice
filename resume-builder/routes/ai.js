const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🚨 Array of models to try in order of priority
const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite-preview-06-17",
    "gemini-1.5-flash",
    "gemini-3-flash-preview"
];

router.post('/analyze', async (req, res) => {
    // Note: We still extract 'jobTitle' from req.body to match the frontend payload, 
    // but we treat it as the 'jobDescription'.
    const { jobTitle: jobDescription, resumeData } = req.body;

    const prompt = `You are an elite Technical Recruiter and ATS Expert.
        
        TARGET JOB DESCRIPTION: 
        "${jobDescription}"
        
        USER'S RESUME: 
        ${resumeData}

        INSTRUCTIONS: Perform a deep audit of the resume against the provided job description. Return exactly 3 scores (0-100) and 1 feedback string.
        1. "atsScore": How machine-readable is the layout and text?
        2. "score": Job match percentage. How relevant is the resume to the pasted job description?
        3. "grammarScore": Spelling, punctuation, and tense consistency.
        4. "suggestions": First, provide a clear justification for the job match score based on what is missing or aligns well. Then, give actionable, highly critical advice using **bolding** and bullet points to fix the resume flaws to better match the job description.
        
        CRITICAL: You must return ONLY a valid JSON object in this EXACT format. Do not use markdown blocks around the JSON.
        {
          "atsScore": 85,
          "score": 75,
          "grammarScore": 95,
          "suggestions": "Detailed justification and advice string here..."
        }
    `;

    // Loop through the models until one succeeds
    for (const modelName of MODELS) {
        try {
            console.log(`\n⏳ Attempting analysis with model: [${modelName}]...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            
            console.log(`✅ Success using [${modelName}]!`);
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                // If successful, send the response and EXIT the loop/function immediately
                return res.json(JSON.parse(jsonMatch[0]));
            } else {
                throw new Error("AI Format Error: Could not extract JSON.");
            }

        } catch (error) {
            // Catch the error (like a 429 Quota limit) and log it, letting the loop continue to the next model
            console.error(`⚠️ Model [${modelName}] failed: ${error.message}`);
        }
    }

    // 🚨 If the code reaches this point, ALL models in the array failed
    console.error("❌ ALL FALLBACK MODELS FAILED.");
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