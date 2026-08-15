const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;

    if (!uri && process.env.DB_USER && process.env.DB_PASSWORD) {
      const user = encodeURIComponent(process.env.DB_USER);
      const password = encodeURIComponent(process.env.DB_PASSWORD);
      uri = `mongodb+srv://${user}:${password}@cluster0.5gxxrru.mongodb.net/vaultguard?retryWrites=true&w=majority&appName=Cluster0`;
    }

    if (!uri) {
      throw new Error('Please define MONGODB_URI or DB_USER/DB_PASSWORD in your .env file');
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
