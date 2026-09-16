const mongoose = require('mongoose')
const connectDB = require('../db')
const User = require('../../models/User')
const Follow = require('../../models/Follow')
const Session = require('../../models/Session')
const crypto = require('crypto')

function getUserId(req) {
  return String(
    req.query?.userId ||
    req.query?.targetUserId ||
    ''
  ).trim()
}

function getUsername(req) {
  return String(
    req.query?.username ||
    ''
  ).trim().toLowerCase()
}

function getType(req) {
  return String(
    req.query?.type ||
    'followers'
  ).trim().toLowerCase()
}

function getPage(req) {
  const page = Number(req.query?.page || 1)

  if (!Number.isInteger(page) || page < 1) {
    return 1
  }

  return page
}

function getLimit(req) {
  const limit = Number(req.query?.limit || 20)

  if (!Number.isInteger(limit) || limit < 1) {
    return 20
  }

  return Math.min(limit, 20)
}

function getSessionToken(req) {
  const cookie = String(
    req.headers?.cookie || ''
  )

  const parts = cookie
    .split(';')
    .map(item => item.trim())

  const sessionCookie = parts.find(
    item => item.startsWith('fjb_session=')
  )

  if (!sessionCookie) {
    return null
  }

  return sessionCookie
    .slice('fjb_session='.length)
    .trim()
}

async function getViewer(req) {
  const token = getSessionToken(req)

  if (!token) {
    return null
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')

  const session = await Session.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: {
      $gt: new Date()
    }
  }).select('user')

  if (!session) {
    return null
  }

  return User.findOne({
    _id: session.user,
    accountStatus: 'active'
  }).select('_id username role')
}

function formatUser(user, following) {
  return {
    id: user._id,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    verified: user.verified,
    resellerStatus: user.resellerStatus,
    followersCount: user.followersCount || 0,
    followingCount: user.followingCount || 0,
    postsCount: user.postsCount || 0,
    following
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan'
    })
  }

  try {
    await connectDB()

    const userId = getUserId(req)
    const username = getUsername(req)
    const type = getType(req)
    const page = getPage(req)
    const limit = getLimit(req)

    if (
      type !== 'followers' &&
      type !== 'following'
    ) {
      return res.status(400).json({
        status: false,
        message: 'Type harus followers atau following'
      })
    }

    if (!userId && !username) {
      return res.status(400).json({
        status: false,
        message: 'User ID atau username wajib diisi'
      })
    }

    let targetUser

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          status: false,
          message: 'User ID tidak valid'
        })
      }

      targetUser = await User.findById(userId)
        .select(
          '_id username accountStatus'
        )
        .lean()
    } else {
      targetUser = await User.findOne({
        username,
        accountStatus: 'active'
      })
        .select(
          '_id username accountStatus'
        )
        .lean()
    }

    if (!targetUser) {
      return res.status(404).json({
        status: false,
        message: 'User tidak ditemukan'
      })
    }

    if (
      targetUser.accountStatus !== 'active'
    ) {
      return res.status(404).json({
        status: false,
        message: 'User tidak ditemukan'
      })
    }

    const filter =
      type === 'followers'
        ? {
            following: targetUser._id,
            status: 'active'
          }
        : {
            follower: targetUser._id,
            status: 'active'
          }

    const total = await Follow.countDocuments(
      filter
    )

    const totalPages =
      total > 0
        ? Math.ceil(total / limit)
        : 0

    const skip = (page - 1) * limit

    const follows = await Follow.find(filter)
      .sort({
        createdAt: -1
      })
      .skip(skip)
      .limit(limit)
      .select(
        'follower following createdAt'
      )
      .lean()

    const relatedUserIds = follows.map(
      follow =>
        type === 'followers'
          ? follow.follower
          : follow.following
    )

    const users =
      relatedUserIds.length > 0
        ? await User.find({
            _id: {
              $in: relatedUserIds
            },
            accountStatus: 'active'
          })
            .select(
              '_id username avatar bio role verified resellerStatus followersCount followingCount postsCount'
            )
            .lean()
        : []

    const userMap = new Map(
      users.map(user => [
        String(user._id),
        user
      ])
    )

    const viewer = await getViewer(req)

    let viewerFollowingIds = []

    if (
      viewer &&
      users.length > 0
    ) {
      viewerFollowingIds =
        await Follow.find({
          follower: viewer._id,
          following: {
            $in: users.map(
              user => user._id
            )
          },
          status: 'active'
        })
          .select('following')
          .lean()
    }

    const viewerFollowingSet =
      new Set(
        viewerFollowingIds.map(
          item =>
            String(item.following)
        )
      )

    const result = []

    for (const follow of follows) {
      const relatedUserId =
        type === 'followers'
          ? follow.follower
          : follow.following

      const user = userMap.get(
        String(relatedUserId)
      )

      if (!user) {
        continue
      }

      result.push(
        formatUser(
          user,
          viewer
            ? viewerFollowingSet.has(
                String(user._id)
              )
            : false
        )
      )
    }

    return res.status(200).json({
      status: true,
      type,
      target: {
        id: targetUser._id,
        username: targetUser.username
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPrevPage:
          page > 1
      },
      viewer: {
        loggedIn: Boolean(viewer),
        id: viewer
          ? viewer._id
          : null
      },
      users: result
    })
  } catch (error) {
    console.error(
      'FOLLOW_LIST_ERROR:',
      error
    )

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server'
      })
    }
  }
}