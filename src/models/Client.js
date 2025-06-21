import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  birthdate: {
    type: Date,
    required: true
  },
  token: {
    type: String
  }
}, {
  timestamps: true
});

const Client = mongoose.model('Client', clientSchema);

export default Client;