import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { Service } from "../models/Service.js";
import { UploadedImage } from "../models/UploadedImage.js";
import { AppError } from "./AppError.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// All uploads live under one root that is decided by the server, never by the client.
export const UPLOAD_ROOT = path.resolve(
  env.uploadDir || path.join(here, "../../uploads"),
);
export const SERVICE_DIR = path.join(UPLOAD_ROOT, "services");
export const SERVICE_URL_PREFIX = "/uploads/services/";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Only names we generate ourselves are ever read, served or deleted.
const GENERATED_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

/** Identifies the real image type from the file's first bytes. Returns { ext, mime } or null. */
export function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { ext: "jpg", mime: "image/jpeg" };
  if (
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { ext: "png", mime: "image/png" };
  if (
    buf.subarray(0, 4).toString("latin1") === "RIFF" &&
    buf.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return { ext: "webp", mime: "image/webp" };
  return null;
}

export const ensureUploadDirs = () =>
  env.dbUploads
    ? Promise.resolve()
    : fs.mkdir(SERVICE_DIR, { recursive: true });

/**
 * Validates the content (not the client's claimed type) and stores the image under a random
 * server-generated name. The extension comes from the detected type. Returns the public URL path.
 */
export async function saveServiceImage(buffer) {
  const type = detectImageType(buffer);
  if (!type) {
    throw new AppError(
      400,
      "That file is not a valid JPG, PNG or WebP image.",
      { imageFile: "Choose a JPG, PNG or WebP image" },
      "INVALID_IMAGE",
    );
  }
  const name = `${crypto.randomBytes(16).toString("hex")}.${type.ext}`;
  if (env.dbUploads) {
    await UploadedImage.create({ name, mime: type.mime, data: buffer });
    return `${SERVICE_URL_PREFIX}${name}`;
  }
  await ensureUploadDirs();
  await fs.writeFile(path.join(SERVICE_DIR, name), buffer, { flag: "wx" }); // 'wx': never overwrite
  return `${SERVICE_URL_PREFIX}${name}`;
}

export const isGeneratedName = (name) => GENERATED_NAME.test(String(name));

/** Returns the file name if `url` is exactly one of OUR upload URLs, otherwise null. */
export function uploadedNameFromUrl(url) {
  if (typeof url !== "string" || !url.startsWith(SERVICE_URL_PREFIX))
    return null;
  const name = url.slice(SERVICE_URL_PREFIX.length);
  return GENERATED_NAME.test(name) ? name : null;
}

/** Removes a file we created. Silent on failure so a cleanup problem never hides the real result. */
export async function removeUploadedFile(url) {
  const name = uploadedNameFromUrl(url);
  if (!name) return false;
  if (env.dbUploads) {
    const r = await UploadedImage.deleteOne({ name }).catch(() => null);
    return Boolean(r?.deletedCount);
  }
  const target = path.join(SERVICE_DIR, name);
  if (path.dirname(target) !== SERVICE_DIR) return false; // defence in depth
  try {
    await fs.unlink(target);
    return true;
  } catch (err) {
    if (err.code !== "ENOENT")
      console.error(`Could not delete an uploaded file (${err.code})`);
    return false;
  }
}

/**
 * Deletes a replaced/removed image only when it is one of our uploads AND no other service
 * still points at it. Manually supplied paths (e.g. /images/...) are never touched.
 */
export async function removeImageIfUnused(url, exceptServiceId) {
  if (!uploadedNameFromUrl(url)) return false;
  const stillUsed = await Service.exists({
    image: url,
    _id: { $ne: exceptServiceId },
  });
  return stillUsed ? false : removeUploadedFile(url);
}
