const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🚨 Array of models to try in order of priority
const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview" // Note: preview models can sometimes have different strictness!
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
  "education": [{"school":"","degree":"","date":"","location":""}],
  "experience": [{"title":"","company":"","date":"","desc":"","link":"","linkText":"","linkType":"separate"}],
  "projects": [{"title":"","tech":"","date":"","desc":"","link":"","liveLink":""}],
  "techSkills": [{"cat":"","items":""}],
  "achievements": [{"text":"","date":"","desc":"","link":"","linkText":"","linkType":"separate"}],
  "certifications": [{"name":"","date":"","link":"","linkText":"","linkType":"separate"}],
  "extracurricular": [{"org":"","role":"","date":"","desc":"","link":"","linkText":"","linkType":"separate"}],
  "skills": "",
  "languages": "",
  "hobbies": "",
  "coursework": ""
}

Rules:
- Preserve ALL original wording — do not summarise or paraphrase.
- experience[].desc and projects[].desc: format each bullet as a new line starting with "– " (en-dash + space).
- techSkills: if the resume groups skills by category (Languages, Frameworks, etc.) use those as cat values. Otherwise one entry with cat="" and all skills comma-separated in items.
- skills: only fill if the resume has a flat ungrouped skills list; otherwise leave "".
- linkedin/github: include the full URL exactly as written.
- coursework: comma-separated course names if a coursework section exists, otherwise "".
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