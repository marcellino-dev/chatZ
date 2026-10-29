import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// Garante que a pasta existe
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface SavedFile {
  url: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
}

// ==========================
// SALVAR ARQUIVO NO DISCO
// ==========================
export function saveUploadedFile(file: Express.Multer.File): SavedFile {
  const ext = path.extname(file.originalname) || '';
  const uuid = crypto.randomUUID();
  const safeName = `${uuid}${ext}`;
  const finalPath = path.join(UPLOADS_DIR, safeName);

  fs.writeFileSync(finalPath, file.buffer);

  return {
    url: `/uploads/${safeName}`,
    filename: safeName,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    type: detectType(file.mimetype),
  };
}

// ==========================
// DETECTAR TIPO
// ==========================
function detectType(mimetype: string): 'image' | 'video' | 'audio' | 'document' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}

export const uploadsDir = UPLOADS_DIR;