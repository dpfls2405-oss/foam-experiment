import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

// 변수 생성
export async function POST(req) {
  try {
    const b = await req.json();
    const { rows } = await q(
      'INSERT INTO exp_factors (name, unit, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [b.name, b.unit, b.sort_order ?? 0],
    );
    return NextResponse.json({ ok: true, row: rows[0] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '저장 실패' }, { status: 500 });
  }
}

// 변수 수정 (is_active 토글 / default_value 등)
export async function PATCH(req) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });
    const allowed = ['name', 'unit', 'sort_order', 'is_active', 'default_value'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));
    if (!keys.length) return NextResponse.json({ ok: true });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    const vals = keys.map((k) => fields[k]);
    vals.push(id);
    await q(`UPDATE exp_factors SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '수정 실패' }, { status: 500 });
  }
}
