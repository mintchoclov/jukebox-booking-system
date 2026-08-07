const multer = require('multer')
const path = require('path')
const fs = require('fs')

const uploadDir = path.join(__dirname, 'uploads', 'humidifier')

fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safeExt = ext || '.jpg'
    const filename = `humidifier-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`

    cb(null, filename)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'))
    }

    cb(null, true)
  }
})

function uploadHumidifierPhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err.message || 'Failed to upload photo.'
      })
    }

    next()
  })
}

function buildHumidifierPhotoUrl(file) {
  return `/uploads/humidifier/${file.filename}`
}

function deleteUploadedFile(file) {
  if (file && file.path) {
    fs.unlink(file.path, () => {})
  }
}

module.exports = {
  uploadHumidifierPhoto,
  buildHumidifierPhotoUrl,
  deleteUploadedFile
}