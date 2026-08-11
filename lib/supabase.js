// 주의: DB 접근용 supabase 클라이언트는 제거되었습니다.
// DB 는 백엔드(app/api/*)에서 pg 로만 접근하고, 스토리지는 lib/storage.js(서버) 로 접근합니다.
// 이 파일에는 브라우저에서 쓰는 이미지 압축 유틸만 남깁니다.

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
