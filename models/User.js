const mongoose = require('mongoose')

const ipHistorySchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['register', 'login', 'logout'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
)

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      lowercase: true,
      match: /^[a-z0-9_]+$/
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 150
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    avatar: {
      type: String,
      default: null
    },

    bio: {
      type: String,
      default: '',
      maxlength: 500
    },

    role: {
      type: String,
      enum: ['user', 'admin', 'developer', 'system'],
      default: 'user'
    },

    verified: {
      type: Boolean,
      default: false
    },

    resellerStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected', 'suspended'],
      default: 'none'
    },

    accountStatus: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active'
    },

    suspensionType: {
      type: String,
      enum: ['temporary', 'permanent', null],
      default: null
    },

    suspendedUntil: {
      type: Date,
      default: null
    },

    suspensionReason: {
      type: String,
      default: null,
      maxlength: 500
    },

    followersCount: {
      type: Number,
      default: 0,
      min: 0
    },

    followingCount: {
      type: Number,
      default: 0,
      min: 0
    },

    postsCount: {
      type: Number,
      default: 0,
      min: 0
    },

    registrationIp: {
      type: String,
      default: null
    },

    lastLoginIp: {
      type: String,
      default: null
    },

    ipHistory: {
      type: [ipHistorySchema],
      default: []
    },

    systemAccount: {
      type: Boolean,
      default: false
    },

    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
)

userSchema.index(
  { username: 1 },
  { unique: true }
)

userSchema.index(
  { email: 1 },
  { unique: true }
)

userSchema.index({
  accountStatus: 1
})

userSchema.index({
  role: 1
})

userSchema.index({
  resellerStatus: 1
})

module.exports =
  mongoose.models.UserFjb ||
  mongoose.model('UserFjb', userSchema)