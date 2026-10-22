import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const errors = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!errors[key]) errors[key] = issue.message;
    }
    return res.status(400).json({ success: false, message: 'Please correct the highlighted fields.', errors });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.code && { code: err.code }),
      ...(err.details && { errors: err.details }),
    });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, code: 'IMAGE_TOO_LARGE', message: 'The image is too large. Please choose a file of 5 MB or less.', errors: { imageFile: 'Image must be 5 MB or smaller' } });
    }
    return res.status(400).json({ success: false, code: 'UPLOAD_ERROR', message: 'The upload could not be processed. Please choose one JPG, PNG or WebP image.', errors: { imageFile: 'Invalid upload' } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body too large.' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid identifier.' });
  }
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Something went wrong on our side. Please try again.',
    ...(env.nodeEnv !== 'production' && { debug: err.message }),
  });
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
