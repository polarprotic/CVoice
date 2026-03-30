const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  
  // password is no longer 'required: true' 
  // because social login users won't have one in our DB.
  password: { type: String, required: false },

  // To store the unique ID GitHub gives us
  githubId: { type: String, unique: true, sparse: true },

  // ADDED: To store the unique ID Google gives us
  googleId: { type: String, unique: true, sparse: true } 
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);