const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    targetType: {
      type: String,
      enum: ['user', 'post', 'comment'],
      required: true,
      index: true
    },

    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      default: null,
      index: true
    },

    targetPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PostFjb',
      default: null,
      index: true
    },

    targetComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommentFjb',
      default: null,
      index: true
    },

    reason: {
      type: String,
      enum: [
        'scam',
        'spam',
        'product_mismatch',
        'rule_violation',
        'suspicious',
        'other'
      ],
      required: true,
      index: true
    },

    details: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: ''
    },

    status: {
      type: String,
      enum: [
        'pending',
        'rejected',
        'resolved'
      ],
      default: 'pending',
      index: true
    },

    action: {
      type: String,
      enum: [
        'none',
        'warning',
        'hide_content',
        'suspend_30d',
        'suspend_permanent'
      ],
      default: 'none'
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

    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'reports'
  }
)

reportSchema.index({
  reporter: 1,
  createdAt: -1
})

reportSchema.index({
  targetType: 1,
  status: 1,
  createdAt: -1
})

reportSchema.index({
  targetUser: 1,
  status: 1,
  createdAt: -1
})

reportSchema.index({
  targetPost: 1,
  status: 1,
  createdAt: -1
})

reportSchema.index({
  targetComment: 1,
  status: 1,
  createdAt: -1
})

module.exports =
  mongoose.models.ReportFjb ||
  mongoose.model('ReportFjb', reportSchema)