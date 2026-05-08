const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  personalInfo: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String }
  },
  
  templateType: { 
    type: String, 
    required: true,
    // 🚨 FIX: Added 'innovative' to the allowed list 🚨
    enum: ['academic', 'minimal', 'modern', 'attorney', 'timeline', 'creative', 'custom', 'innovative']
  },

  templateSpecificInputs: {
    type: mongoose.Schema.Types.Mixed, 
    default: {}
  }
}, { timestamps: true }); 

module.exports = mongoose.model('Resume', resumeSchema);