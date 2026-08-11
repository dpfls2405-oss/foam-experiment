import { NextResponse } from 'next/server';
import { uploadFile, getSignedUrl } from '@/lib/storage';

// 사진 업로드 → 회사 버킷의 foam-experiment/ 폴더에 저장.
// 저장 경로는 서버에서 만든다(브라우저가 보낸 문자열을 경로로 쓰지 않음).
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const runId = formData.get('run_id');
    if (!file) return NextResponse.json({ ok: false, error: 'file 필요' }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const safeRun = String(runId ?? 'misc').replace(/[^a-zA-Z0-9_-]/g, '');
    const path = `foam-experiment/${safeRun}/${Date.now()}.jpg`;
    await uploadFile(path, bytes, 'image/jpeg');

    const url = await getSignedUrl(path); // 업로드 직후 미리보기용 임시 주소
    return NextResponse.json({ ok: true, path, url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '업로드 실패' }, { status: 500 });
  }
}
