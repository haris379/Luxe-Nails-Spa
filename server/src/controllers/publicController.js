import { Service } from '../models/Service.js';
import { ContactMessage } from '../models/ContactMessage.js';
import { business } from '../config/business.js';
import { emailConfigured, sendContactEmail } from '../utils/mailer.js';
import { AppError } from '../utils/AppError.js';
import { objectId, contactBody, serviceListQuery } from '../utils/validators.js';
import { CATEGORIES, normalizeCategory, categoryOrder } from '../utils/categories.js';

const withCategory = (s) => ({ ...s, category: normalizeCategory(s.category) });

export async function listServices(req, res) {
  const { category } = serviceListQuery.parse(req.query);
  const all = (await Service.find({ active: true }).lean()).map(withCategory);
  const services = all
    .filter((s) => !category || s.category === category)
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  res.json({ success: true, data: services });
}

export async function getService(req, res) {
  const id = objectId.parse(req.params.id);
  const service = await Service.findOne({ _id: id, active: true }).lean();
  if (!service) throw new AppError(404, 'Service not found.');
  res.json({ success: true, data: withCategory(service) });
}

export function getBusiness(req, res) {
  res.json({
    success: true,
    data: {
      name: business.name,
      timezone: business.timezone,
      hours: business.hours,
      maxAdvanceDays: business.maxAdvanceDays,
      technicians: business.technicians,
      categories: CATEGORIES,
      emailConfigured: emailConfigured(),
    },
  });
}

export async function createContactMessage(req, res) {
  const body = contactBody.parse(req.body);
  const saved = await ContactMessage.create(body);
  const emailStatus = (await sendContactEmail(saved)).status;
  res.status(201).json({
    success: true,
    message: 'Thanks! Your message has been received and the salon will reply by email.',
    data: { id: saved._id, emailStatus },
  });
}
