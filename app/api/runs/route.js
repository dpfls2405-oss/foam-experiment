import { NextResponse } from 'next/server';
import { q, tx } from '@/lib/db';

// 실험 Run 생성 (+ 고정변수 rows) — 한 트랜잭션으로
export async function POST(req) {
  try {
    const b = await req.json();
    const fixedRows = Array.isArray(b.fixedRows) ? b.fixedRows : [];
    const run = await tx(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO exp_runs
          (phase, mold_id, mold_name, boiler_id, boiler_no, ref_weight, is_control,
           active_factor_id, active_factor_name, active_factor_value, memo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          b.phase, b.mold_id, b.mold_name, b.boiler_id ?? null, b.boiler_no ?? null,
          b.ref_weight ?? null, b.is_control ?? false,
          b.active_factor_id ?? null, b.active_factor_name ?? null, b.active_factor_value ?? null,
          b.memo ?? null,
        ],
      );
      const newRun = rows[0];
      for (const f of fixedRows) {
        if (!f.fixed_value) continue;
        await c.query(
          'INSERT INTO exp_run_fixed_factors (run_id, factor_id, factor_name, fixed_value) VALUES ($1,$2,$3,$4)',
          [newRun.id, f.factor_id, f.factor_name, f.fixed_value],
        );
      }
      return newRun;
    });
    return NextResponse.json({ ok: true, run });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '생성 실패' }, { status: 500 });
  }
}

// Run 수정 (금형온도 상/하 등)
export async function PATCH(req) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });
    const allowed = ['temp_upper', 'temp_lower', 'memo', 'photo_memo'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));
    if (!keys.length) return NextResponse.json({ ok: true });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    const vals = keys.map((k) => fields[k]);
    vals.push(id);
    await q(`UPDATE exp_runs SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '수정 실패' }, { status: 500 });
  }
}

// Run 삭제 (사진·시편·고정변수까지 연쇄) — 한 트랜잭션으로
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });
    await tx(async (c) => {
      await c.query('DELETE FROM exp_run_photos WHERE run_id = $1', [id]);
      await c.query('DELETE FROM exp_specimens WHERE run_id = $1', [id]);
      await c.query('DELETE FROM exp_run_fixed_factors WHERE run_id = $1', [id]);
      await c.query('DELETE FROM exp_runs WHERE id = $1', [id]);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '삭제 실패' }, { status: 500 });
  }
}
