const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const User = require('../../models/User')
const Follow = require('../../models/Follow')

function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  return {}
}

function getUserId(req, body) {
  return String(
    body.userId ||
    body.targetUserId ||
    body.target ||
    req.query?.userId ||
    req.query?.targetUserId ||
    req.query?.target ||
    ''
  ).trim()
}

function getAction(req, body) {
  return String(
    body.action ||
    req.query?.action ||
    'toggle'
  ).trim().toLowerCase()
}

function runAuth(req, res) {
  return new Promise((resolve, reject) => {
    auth(req, res, error => {
      if (error) {
        return reject(error)
      }

      resolve()
    })
  })
}

module.exports = async function handler(req, res) {
  if (
    req.method !== 'POST' &&
    req.method !== 'PUT' &&
    req.method !== 'DELETE'
  ) {
    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan'
    })
  }

  try {
    await connectDB()

    await runAuth(req, res)

    if (res.headersSent) {
      return
    }

    const body = getBody(req)
    const targetUserId = getUserId(req, body)
    const action = getAction(req, body)

    if (!targetUserId) {
      return res.status(400).json({
        status: false,
        message: 'User ID wajib diisi'
      })
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        status: false,
        message: 'User ID tidak valid'
      })
    }

    if (
      ![
        'follow',
        'unfollow',
        'toggle'
      ].includes(action)
    ) {
      return res.status(400).json({
        status: false,
        message: 'Action harus follow, unfollow, atau toggle'
      })
    }

    if (
      String(req.user._id) ===
      String(targetUserId)
    ) {
      return res.status(400).json({
        status: false,
        message: 'Anda tidak dapat mengikuti diri sendiri'
      })
    }

    const targetUser = await User.findById(
      targetUserId
    ).select(
      '_id username accountStatus'
    )

    if (!targetUser) {
      return res.status(404).json({
        status: false,
        message: 'User tidak ditemukan'
      })
    }

    if (targetUser.accountStatus === 'suspended') {
      return res.status(400).json({
        status: false,
        message: 'User sedang ditangguhkan'
      })
    }

    const existingFollow =
      await Follow.findOne({
        follower: req.user._id,
        following: targetUser._id
      })

    const isActive =
      existingFollow &&
      existingFollow.status === 'active'

    if (action === 'follow') {
      if (isActive) {
        return res.status(200).json({
          status: true,
          message: 'Anda sudah mengikuti user ini',
          following: true,
          followersCount: targetUser.followersCount || 0,
          followingCount: req.user.followingCount || 0
        })
      }

      if (existingFollow) {
        existingFollow.status = 'active'
        existingFollow.removedAt = null
        await existingFollow.save()
      } else {
        try {
          await Follow.create({
            follower: req.user._id,
            following: targetUser._id,
            status: 'active',
            removedAt: null
          })
        } catch (error) {
          if (error && error.code === 11000) {
            const duplicateFollow =
              await Follow.findOne({
                follower: req.user._id,
                following: targetUser._id
              })

            if (
              duplicateFollow &&
              duplicateFollow.status !== 'active'
            ) {
              duplicateFollow.status = 'active'
              duplicateFollow.removedAt = null
              await duplicateFollow.save()
            } else {
              return res.status(200).json({
                status: true,
                message: 'Anda sudah mengikuti user ini',
                following: true,
                followersCount:
                  targetUser.followersCount || 0,
                followingCount:
                  req.user.followingCount || 0
              })
            }
          } else {
            throw error
          }
        }
      }

      await User.updateOne(
        {
          _id: targetUser._id
        },
        {
          $inc: {
            followersCount: 1
          }
        }
      )

      await User.updateOne(
        {
          _id: req.user._id
        },
        {
          $inc: {
            followingCount: 1
          }
        }
      )

      const updatedTarget =
        await User.findById(
          targetUser._id
        ).select(
          'followersCount'
        )

      const updatedFollower =
        await User.findById(
          req.user._id
        ).select(
          'followingCount'
        )

      return res.status(200).json({
        status: true,
        message: 'Berhasil mengikuti user',
        following: true,
        followersCount:
          updatedTarget?.followersCount || 0,
        followingCount:
          updatedFollower?.followingCount || 0
      })
    }

    if (action === 'unfollow') {
      if (!isActive) {
        return res.status(200).json({
          status: true,
          message: 'Anda belum mengikuti user ini',
          following: false,
          followersCount: targetUser.followersCount || 0,
          followingCount: req.user.followingCount || 0
        })
      }

      existingFollow.status = 'removed'
      existingFollow.removedAt = new Date()

      await existingFollow.save()

      await User.updateOne(
        {
          _id: targetUser._id,
          followersCount: {
            $gt: 0
          }
        },
        {
          $inc: {
            followersCount: -1
          }
        }
      )

      await User.updateOne(
        {
          _id: req.user._id,
          followingCount: {
            $gt: 0
          }
        },
        {
          $inc: {
            followingCount: -1
          }
        }
      )

      const updatedTarget =
        await User.findById(
          targetUser._id
        ).select(
          'followersCount'
        )

      const updatedFollower =
        await User.findById(
          req.user._id
        ).select(
          'followingCount'
        )

      return res.status(200).json({
        status: true,
        message: 'Berhasil berhenti mengikuti user',
        following: false,
        followersCount:
          updatedTarget?.followersCount || 0,
        followingCount:
          updatedFollower?.followingCount || 0
      })
    }

    if (isActive) {
      existingFollow.status = 'removed'
      existingFollow.removedAt = new Date()

      await existingFollow.save()

      await User.updateOne(
        {
          _id: targetUser._id,
          followersCount: {
            $gt: 0
          }
        },
        {
          $inc: {
            followersCount: -1
          }
        }
      )

      await User.updateOne(
        {
          _id: req.user._id,
          followingCount: {
            $gt: 0
          }
        },
        {
          $inc: {
            followingCount: -1
          }
        }
      )

      const updatedTarget =
        await User.findById(
          targetUser._id
        ).select(
          'followersCount'
        )

      const updatedFollower =
        await User.findById(
          req.user._id
        ).select(
          'followingCount'
        )

      return res.status(200).json({
        status: true,
        message: 'Berhasil berhenti mengikuti user',
        following: false,
        followersCount:
          updatedTarget?.followersCount || 0,
        followingCount:
          updatedFollower?.followingCount || 0
      })
    }

    if (existingFollow) {
      existingFollow.status = 'active'
      existingFollow.removedAt = null

      await existingFollow.save()
    } else {
      try {
        await Follow.create({
          follower: req.user._id,
          following: targetUser._id,
          status: 'active',
          removedAt: null
        })
      } catch (error) {
        if (error && error.code === 11000) {
          const duplicateFollow =
            await Follow.findOne({
              follower: req.user._id,
              following: targetUser._id
            })

          if (duplicateFollow) {
            duplicateFollow.status = 'active'
            duplicateFollow.removedAt = null
            await duplicateFollow.save()
          } else {
            throw error
          }
        } else {
          throw error
        }
      }
    }

    await User.updateOne(
      {
        _id: targetUser._id
      },
      {
        $inc: {
          followersCount: 1
        }
      }
    )

    await User.updateOne(
      {
        _id: req.user._id
      },
      {
        $inc: {
          followingCount: 1
        }
      }
    )

    const updatedTarget =
      await User.findById(
        targetUser._id
      ).select(
        'followersCount'
      )

    const updatedFollower =
      await User.findById(
        req.user._id
      ).select(
        'followingCount'
      )

    return res.status(200).json({
      status: true,
      message: 'Berhasil mengikuti user',
      following: true,
      followersCount:
        updatedTarget?.followersCount || 0,
      followingCount:
        updatedFollower?.followingCount || 0
    })
  } catch (error) {
    console.error('FOLLOW_TOGGLE_ERROR:', error)

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server'
      })
    }
  }
}