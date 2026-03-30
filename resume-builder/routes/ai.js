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

    const prompt = `You are an elite Technical Recruiter and ATS Expert.
        
        USER'S GOAL / TARGET ROLE: "${jobTitle}"
        USER'S RESUME: 
        ${resumeData}

        INSTRUCTIONS: Perform a deep audit of the resume and return exactly 3 scores (0-100) and 1 feedback string.
        1. "atsScore": How machine-readable is the layout and text?
        2. "score": Job match percentage. How well do the skills fit the target role?
        3. "grammarScore": Spelling, punctuation, and tense consistency.
        4. "suggestions": Actionable, highly critical advice using **bolding** and bullet points to fix the resume flaws.
        
        CRITICAL: You must return ONLY a valid JSON object in this EXACT format. Do not use markdown blocks around the JSON.
        {
          "atsScore": 85,
          "score": 75,
          "grammarScore": 95,
          "suggestions": "Detailed string here..."
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

module.exports = router;