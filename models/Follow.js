const mongoose = require('mongoose')

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: ['active', 'removed'],
      default: 'active',
      index: true
    },

    removedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'follows'
  }
)

followSchema.index(
  {
    follower: 1,
    following: 1
  },
  {
    unique: true
  }
)

followSchema.index({
  follower: 1,
  status: 1,
  createdAt: -1
})

followSchema.index({
  following: 1,
  status: 1,
  createdAt: -1
})

followSchema.pre('validate', function(next) {
  if (
    this.follower &&
    this.following &&
    this.follower.toString() === this.following.toString()
  ) {
    return next(new Error('User tidak dapat mengikuti dirinya sendiri'))
  }

  next()
})

module.exports =
  mongoose.models.FollowFjb ||
  mongoose.model('FollowFjb', followSchema)