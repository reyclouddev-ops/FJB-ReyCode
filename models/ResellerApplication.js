const mongoose = require('mongoose')

const resellerApplicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    businessName: {
      type: String,
      trim: true,
      maxlength: 150,
      default: ''
    },

    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      required: true
    },

    contact: {
      type: String,
      trim: true,
      maxlength: 150,
      required: true
    },

    evidence: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 1000
        }
      ],
      default: []
    },

    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'rejected',
        'suspended'
      ],
      default: 'pending',
      index: true
    },

    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      default: null,
      index: true
    },

    adminNote: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: ''
    },

    reviewedAt: {
      type: Date,
      default: null
    },

    suspendedAt: {
      type: Date,
      default: null
    },

    suspensionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'resellerApplications'
  }
)

resellerApplicationSchema.index({
  user: 1,
  createdAt: -1
})

resellerApplicationSchema.index({
  status: 1,
  createdAt: -1
})

resellerApplicationSchema.index({
  admin: 1,
  reviewedAt: -1
})

module.exports =
  mongoose.models.ResellerApplicationFjb ||
  mongoose.model(
    'ResellerApplicationFjb',
    resellerApplicationSchema
  )