import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

// 고정변수 조회: ?run_id= 있으면 해당 Run만, 없으면 전체
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('run_id');
    const { rows } = runId
      ? await q('SELECT * FROM exp_run_fixed_factors WHERE run_id = $1', [runId])
      : await q('SELECT * FROM exp_run_fixed_factors');
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? 'load failed' }, { status: 500 });
  }
}
