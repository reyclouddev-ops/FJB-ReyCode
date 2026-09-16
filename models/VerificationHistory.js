const mongoose = require('mongoose')

const verificationHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ResellerApplicationFjb',
      default: null,
      index: true
    },

    action: {
      type: String,
      enum: [
        'submitted',
        'approved',
        'rejected',
        'suspended',
        'reinstated',
        'revoked'
      ],
      required: true,
      index: true
    },

    previousStatus: {
      type: String,
      enum: [
        'none',
        'pending',
        'approved',
        'rejected',
        'suspended'
      ],
      default: 'none'
    },

    newStatus: {
      type: String,
      enum: [
        'none',
        'pending',
        'approved',
        'rejected',
        'suspended'
      ],
      required: true
    },

    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      default: null,
      index: true
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: ''
    },

    note: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: ''
    }
  },
  {
    timestamps: true,
    collection: 'verificationHistory'
  }
)

verificationHistorySchema.index({
  user: 1,
  createdAt: -1
})

verificationHistorySchema.index({
  application: 1,
  createdAt: -1
})

verificationHistorySchema.index({
  admin: 1,
  createdAt: -1
})

verificationHistorySchema.index({
  action: 1,
  createdAt: -1
})

module.exports =
  mongoose.models.VerificationHistoryFjb ||
  mongoose.model(
    'VerificationHistoryFjb',
    verificationHistorySchema
  )