import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

// 보일러 설정온도 수정
export async function PATCH(req) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });
    const allowed = ['setting_temp', 'name', 'boiler_no'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));
    if (!keys.length) return NextResponse.json({ ok: true });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    const vals = keys.map((k) => fields[k]);
    vals.push(id);
    await q(`UPDATE exp_boilers SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '수정 실패' }, { status: 500 });
  }
}
