import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

// 금형 생성
export async function POST(req) {
  try {
    const b = await req.json();
    const { rows } = await q(
      'INSERT INTO exp_molds (mold_id, ref_weight, boiler_id, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [b.mold_id, b.ref_weight, b.boiler_id ?? null, b.description ?? null],
    );
    return NextResponse.json({ ok: true, row: rows[0] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '저장 실패' }, { status: 500 });
  }
}

// 금형 수정 (boiler_id / ref_weight / is_active 등)
export async function PATCH(req) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });
    const allowed = ['mold_id', 'ref_weight', 'boiler_id', 'description', 'is_active'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));
    if (!keys.length) return NextResponse.json({ ok: true });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    const vals = keys.map((k) => fields[k]);
    vals.push(id);
    await q(`UPDATE exp_molds SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '수정 실패' }, { status: 500 });
  }
}
