import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `media-${uniqueSuffix}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for photos and 1-min videos
}).single('file');

export function uploadMediaHandler(req: Request, res: Response): void {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'File upload failed' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const isImage = req.file.mimetype.startsWith('image/');

    res.json({
      url: fileUrl,
      filename: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      mediaType: isImage ? 'image' : 'file',
    });
  });
}
