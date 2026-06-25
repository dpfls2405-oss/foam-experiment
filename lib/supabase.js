import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** 업로드 전 브라우저에서 리사이즈+JPEG 압축 (긴 변 1600px, 품질 0.75) */
export async function compressImage(file, maxDim = 1600, quality = 0.75) {
  try {
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width, height = bitmap.height;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (bitmap.close) bitmap.close();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return (blob && blob.size < file.size) ? blob : file; // 더 커지면 원본 유지
  } catch {
    return file; // 압축 실패 시 원본 업로드
  }
}
