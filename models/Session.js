const mongoose = require('mongoose')

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    ip: {
      type: String,
      default: null
    },

    userAgent: {
      type: String,
      maxlength: 1000,
      default: null
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    lastUsedAt: {
      type: Date,
      default: Date.now
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true
    },

    revokedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    collection: 'sessions'
  }
)

sessionSchema.index({
  user: 1,
  createdAt: -1
})

sessionSchema.index({
  expiresAt: 1
})

sessionSchema.index({
  revokedAt: 1
})

sessionSchema.index({
  user: 1,
  revokedAt: 1,
  expiresAt: 1
})

sessionSchema.index(
  {
    expiresAt: 1
  },
  {
    expireAfterSeconds: 0
  }
)

module.exports =
  mongoose.models.SessionFjb ||
  mongoose.model('SessionFjb', sessionSchema)