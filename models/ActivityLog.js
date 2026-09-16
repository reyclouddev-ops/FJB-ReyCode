const mongoose = require('mongoose')

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      default: null,
      index: true
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      default: null,
      index: true
    },

    action: {
      type: String,
      enum: [
        'register',
        'login',
        'logout',
        'profile_update',
        'password_change',
        'post_create',
        'post_update',
        'post_delete',
        'post_like',
        'post_unlike',
        'comment_create',
        'comment_delete',
        'comment_like',
        'comment_unlike',
        'follow',
        'unfollow',
        'rating_create',
        'rating_update',
        'rating_delete',
        'report_create',
        'report_review',
        'reseller_apply',
        'reseller_approve',
        'reseller_reject',
        'reseller_suspend',
        'reseller_revoke',
        'account_suspend',
        'account_unsuspend',
        'account_warning',
        'content_hide',
        'content_restore',
        'admin_action',
        'security_event'
      ],
      required: true,
      index: true
    },

    targetType: {
      type: String,
      enum: [
        'user',
        'post',
        'comment',
        'report',
        'reseller',
        'system',
        null
      ],
      default: null,
      index: true
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    success: {
      type: Boolean,
      default: true,
      index: true
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    }
  },
  {
    timestamps: true,
    collection: 'activityLogs'
  }
)

activityLogSchema.index({
  user: 1,
  createdAt: -1
})

activityLogSchema.index({
  actor: 1,
  createdAt: -1
})

activityLogSchema.index({
  action: 1,
  createdAt: -1
})

activityLogSchema.index({
  targetType: 1,
  targetId: 1,
  createdAt: -1
})

activityLogSchema.index({
  ip: 1,
  createdAt: -1
})

module.exports =
  mongoose.models.ActivityLogFjb ||
  mongoose.model('ActivityLogFjb', activityLogSchema)