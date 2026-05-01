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
    const { jobTitle, resumeData } = req.body;

   const prompt = `You are a ruthless, highly critical Technical Recruiter and strict ATS Expert. Your job is to provide a realistic, hard-hitting evaluation of the provided resume against real-world hiring standards.
        
        USER'S GOAL / TARGET ROLE: "${jobTitle}"
        USER'S RESUME: 
        ${resumeData}

        INSTRUCTIONS: Perform a deep, critical audit of the resume and return exactly 3 scores (0-100) and 1 feedback string.
        BE HIGHLY REALISTIC AND STRICT. An average resume should score between 40-65. Only exceptional, perfectly tailored resumes with quantifiable metrics should score 80+. Penalize heavily for missing keywords, generic phrasing, and weak impact.

        1. "atsScore": Evaluate how machine-readable the layout and text are. Be strict: penalize complex formatting, missing standard sections (like Education or Experience), or lack of clear hierarchy.
        2. "score": Evaluate the Job Match percentage. Be ruthless: if they lack the exact core skills required for "${jobTitle}", score them below 50. Do not give them the benefit of the doubt.
        3. "grammarScore": Evaluate spelling, punctuation, and tense consistency.
        4. "suggestions": Provide actionable, highly critical advice to fix the resume's flaws. Tell them exactly what keywords or metrics they are missing to improve their chances for the "${jobTitle}" role. Justify your critiques based on standard industry practices. Structure your response with clear section headers followed by bullet points. Use this exact format: each section starts with a header line in ALL CAPS followed by a colon, then bullet points below it starting with a dash (-). Do not use asterisks or markdown symbols anywhere.
        
        CRITICAL: You must return ONLY a valid JSON object in this EXACT format. Do not use markdown blocks around the JSON.
        {
          "atsScore": 62,
          "score": 45,
          "grammarScore": 88,
          "suggestions": "STRENGTHS:\\n- Point one...\\nWEAKNESSES:\\n- Point two...\\nACTIONABLE FIXES:\\n- Point three..."
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

module.exports = router;