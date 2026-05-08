const express = require('express');
const router = express.Router();
const Resume = require('../models/Resume'); // Double check this path matches your folder structure

// --- SAVE RESUME ---
// --- SAVE OR CREATE RESUME ---
router.post('/resume', async (req, res) => {
    try {
        console.log("💾 Saving Resume for User:", req.body.userId);
        let savedResume;

        // 1. If the frontend sends a specific Resume ID, UPDATE that exact file
        if (req.body.resumeId) {
            savedResume = await Resume.findByIdAndUpdate(
                req.body.resumeId,
                req.body,
                { new: true } // Returns the newly updated document
            );
        } 
        // 2. If the frontend does NOT send an ID (brand new draft), CREATE a new file
        else {
            const newResume = new Resume(req.body);
            savedResume = await newResume.save();
        }

        res.status(201).json({ message: "✅ Resume saved successfully!", data: savedResume });
    } catch (err) {
        console.error("❌ Save Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- LOAD ALL RESUMES (For Dashboard) ---
router.get('/resume', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "User ID is required" });

        const resumes = await Resume.find({ userId: userId }).sort({ updatedAt: -1 });
        res.json(resumes);
    } catch (err) {
        console.error("❌ Load Error:", err.message);
        res.status(500).json({ error: "Failed to load resumes from database" });
    }
});

// --- GET SINGLE RESUME (For opening in Editor) ---
router.get('/resume/:id', async (req, res) => {
    try {
        const resume = await Resume.findById(req.params.id);
        
        if (!resume) {
            return res.status(404).json({ error: "Resume not found" });
        }
        
        res.json(resume);
    } catch (err) {
        console.error("❌ Load Single Error:", err.message);
        res.status(500).json({ error: "Failed to load the resume" });
    }
});

// --- DELETE RESUME (Added this so your delete button works too!) ---
router.delete('/resume/:id', async (req, res) => {
    try {
        await Resume.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete" });
    }
});




// --- PUBLIC STATS ---
router.get('/stats', async (req, res) => {
    try {
        const User = require('../models/User');
        const totalUsers = await User.countDocuments();
        res.json({ totalUsers });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;

