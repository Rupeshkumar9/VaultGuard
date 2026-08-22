const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    // OPAQUE registration record. The client derives this record from the
    // password; the server never receives or stores the password.
    opaqueRegistration: {
      type: String,
      select: false,
    },
    opaqueIdentifier: {
      type: String,
      select: false,
    },
    masterPasswordHint: {
      type: String,
      default: '',
      maxlength: [255, 'Hint cannot exceed 255 characters'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
