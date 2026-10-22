import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { SERVICE_DIR, isGeneratedName } from "./utils/uploads.js";
import { UploadedImage } from "./models/UploadedImage.js";
import routes from "./routes/index.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server requests (no Origin header) and listed origins.
        if (!origin || env.clientOrigins.includes(origin))
          return cb(null, true);
        cb(new Error("Origin not allowed by CORS"));
      },
    }),
  );
  // Uploaded service images (public, read-only). Only the services folder is exposed, and only files
  // with names the server generated. Names are random, so responses can be cached for a long time.
  app.use("/uploads/services", (req, res, next) =>
    isGeneratedName(req.path.slice(1)) ? next() : notFound(req, res),
  );
  if (env.dbUploads) {
    // No persistent disk (Vercel): serve images stored in MongoDB.
    app.get("/uploads/services/:name", async (req, res, next) => {
      try {
        const img = await UploadedImage.findOne({
          name: req.params.name,
        }).lean();
        if (!img) return notFound(req, res);
        res.set({
          "Content-Type": img.mime,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Cross-Origin-Resource-Policy": "cross-origin",
          "X-Content-Type-Options": "nosniff",
        });
        res.send(Buffer.from(img.data.buffer ?? img.data));
      } catch (err) {
        next(err);
      }
    });
  }
  app.use(
    "/uploads/services",
    express.static(SERVICE_DIR, {
      index: false,
      dotfiles: "ignore",
      maxAge: "365d",
      immutable: true,
      setHeaders(res) {
        // helmet's default "same-origin" would stop the frontend (another origin) from showing these images
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    }),
  );

  // API status route for the website root and Vercel rewrite
  app.get(["/", "/api"], (req, res) => {
    res.status(200).json({
      success: true,
      message: "Luxe Nails API is running",
    });
  });

  app.use(express.json({ limit: "20kb" }));
  app.use("/api", apiLimiter, routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
