const mongoose = require('mongoose')

const MONGO_URI = process.env.MONGO_URI

if (!MONGO_URI) {
  throw new Error('MONGO_URI belum diset')
}

let cached = global.userFjbMongo

if (!cached) {
  cached = global.userFjbMongo = {
    conn: null,
    promise: null
  }
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO_URI, {
      dbName: 'userfjb',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (error) {
    cached.promise = null
    throw error
  }

  return cached.conn
}

module.exports = connectDB