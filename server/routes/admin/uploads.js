import { Router } from "express";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { UPLOAD_DIR } from "../../db.js";
import { asyncHandler, HttpError } from "../../lib/util.js";

const router = Router();

const MAX_BYTES = 3 * 1024 * 1024;
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function looksLikeImage(buffer, mime) {
  if (mime === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/webp") return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  return false;
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const dataUrl = req.body?.dataUrl;
    if (typeof dataUrl !== "string") throw new HttpError(400, "Choose an image to upload.");
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
    if (!match) throw new HttpError(400, "Use a JPG, PNG or WebP image.");
    const mime = match[1];
    const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    if (!buffer.length) throw new HttpError(400, "The image appears to be empty.");
    if (buffer.length > MAX_BYTES) throw new HttpError(413, "Images must be smaller than 3 MB.");
    if (!looksLikeImage(buffer, mime)) throw new HttpError(400, "The file does not look like a valid image.");

    const filename = `${randomUUID()}.${EXTENSIONS[mime]}`;
    writeFileSync(join(UPLOAD_DIR, filename), buffer);
    res.status(201).json({ url: `/uploads/${filename}` });
  })
);

export default router;
