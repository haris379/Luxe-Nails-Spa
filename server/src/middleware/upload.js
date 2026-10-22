import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { MAX_IMAGE_BYTES } from '../utils/uploads.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;

// The file is held in memory (5 MB max), checked by its real content, and only then written to disk
// under a generated name, so a rejected upload never leaves a file behind. Multer ignores
// non-multipart requests, so existing JSON requests to the same routes keep working.
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 20, fieldSize: 10 * 1024 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.test(file.originalname || '')) {
      return cb(new AppError(400, 'Only JPG, PNG or WebP images are allowed.', { imageFile: 'Choose a JPG, PNG or WebP image' }, 'INVALID_IMAGE_TYPE'));
    }
    cb(null, true);
  },
});

/** The form field that carries the file is named "imageFile". */
export const serviceImageUpload = uploader.single('imageFile');
