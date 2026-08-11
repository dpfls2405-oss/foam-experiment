import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { signPaths } from '@/lib/storage';

// 사진 조회: ?run_id= 있으면 해당 Run만, 없으면 전체.
// DB엔 경로만 있으므로 photo_url 을 임시 조회 주소(signed URL)로 바꿔서 내려준다.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('run_id');
    const { rows } = runId
      ? await q('SELECT * FROM exp_run_photos WHERE run_id = $1 ORDER BY created_at', [runId])
      : await q('SELECT * FROM exp_run_photos ORDER BY created_at');

    const paths = rows.map((r) => r.photo_url).filter(Boolean);
    if (paths.length) {
      let map = {};
      try { map = await signPaths(paths); } catch { map = {}; }
      for (const r of rows) {
        if (r.photo_url && map[r.photo_url]) r.photo_url = map[r.photo_url];
      }
    }
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? 'load failed' }, { status: 500 });
  }
}

// 사진 메타 저장 (업로드 후 경로 기록)
export async function POST(req) {
  try {
    const b = await req.json();
    if (!b.run_id || !b.path) return NextResponse.json({ ok: false, error: 'run_id/path 필요' }, { status: 400 });
    const { rows } = await q(
      'INSERT INTO exp_run_photos (run_id, photo_url, memo) VALUES ($1, $2, $3) RETURNING *',
      [b.run_id, b.path, b.memo ?? null],
    );
    return NextResponse.json({ ok: true, row: rows[0] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '저장 실패' }, { status: 500 });
  }
}

// 사진 메모 수정
export async function PATCH(req) {
  try {
    const { id, memo } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });
    await q('UPDATE exp_run_photos SET memo = $1 WHERE id = $2', [memo ?? null, id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '수정 실패' }, { status: 500 });
  }
}

// 사진 삭제 (?id=)
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });
    await q('DELETE FROM exp_run_photos WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '삭제 실패' }, { status: 500 });
  }
}
