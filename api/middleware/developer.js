const auth = require('./auth')

async function developer(req, res, next) {
  return auth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        status: false,
        message: 'Belum login'
      })
    }

    if (req.user.role !== 'developer') {
      return res.status(403).json({
        status: false,
        message: 'Akses hanya untuk Developer'
      })
    }

    req.isDeveloper = true

    return next()
  })
}

module.exports = developer