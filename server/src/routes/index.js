import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin, requirePermission as need } from '../middleware/auth.js';
import { loginLimiter, otpRequestLimiter, otpVerifyLimiter, submitLimiter } from '../middleware/rateLimit.js';
import * as pub from '../controllers/publicController.js';
import * as appt from '../controllers/appointmentController.js';
import * as admin from '../controllers/adminController.js';
import * as verify from '../controllers/verificationController.js';
import { serviceImageUpload } from '../middleware/upload.js';

const router = Router();

router.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

// Public
router.get('/business', pub.getBusiness);
router.get('/services', asyncHandler(pub.listServices));
router.get('/services/:id', asyncHandler(pub.getService));
router.get('/appointments/availability', asyncHandler(appt.getAvailability));
router.post('/verification/email/request', otpRequestLimiter, asyncHandler(verify.requestCode));
router.post('/verification/email/verify', otpVerifyLimiter, asyncHandler(verify.verifyCode));
router.post('/appointments', submitLimiter, asyncHandler(appt.createAppointment));
router.post('/contact', submitLimiter, asyncHandler(pub.createContactMessage));

// Admin
router.post('/admin/login', loginLimiter, asyncHandler(admin.login));
router.use('/admin', requireAdmin);
router.get('/admin/me', admin.me); // any signed-in admin or developer
router.post('/admin/logout', asyncHandler(admin.logout));

// Appointments and messages: business admin only
router.get('/admin/appointments', need('appointments:read'), asyncHandler(admin.listAppointments));
router.patch('/admin/appointments/:id/status', need('appointments:manage'), asyncHandler(admin.updateAppointmentStatus));
router.post('/admin/appointments/:id/resend-email', need('appointments:manage'), asyncHandler(admin.resendAppointmentEmail));
router.get('/admin/messages', need('messages:read'), asyncHandler(admin.listMessages));
router.patch('/admin/messages/:id/read', need('messages:manage'), asyncHandler(admin.markMessageRead));

// Services: both roles may read; only the developer may change anything.
// The permission check runs BEFORE multer, so an unauthorised upload is never even read.
router.get('/admin/services', need('services:read'), asyncHandler(admin.listAllServices));
router.post('/admin/services', need('services:write'), serviceImageUpload, asyncHandler(admin.createService));
router.put('/admin/services/:id', need('services:write'), serviceImageUpload, asyncHandler(admin.updateService));
router.delete('/admin/services/:id', need('services:write'), asyncHandler(admin.deleteService));

export default router;
