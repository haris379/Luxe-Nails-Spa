import mongoose from "mongoose";

// Used instead of the disk when the host has no persistent file system (e.g. Vercel).
// Images are capped at 5 MB, well below MongoDB's 16 MB document limit.
const uploadedImageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // server-generated, e.g. <32 hex>.jpg
    mime: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const UploadedImage = mongoose.model(
  "UploadedImage",
  uploadedImageSchema,
);
