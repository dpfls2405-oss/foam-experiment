import { NextResponse } from 'next/server';
import { tx } from '@/lib/db';

// 로트 저장: Run 금형온도 수정 + 시편 전체 교체(지우고 다시 넣기)를 한 트랜잭션으로.
export async function POST(req) {
  try {
    const b = await req.json();
    const runId = b.runId;
    if (!runId) return NextResponse.json({ ok: false, error: 'runId 필요' }, { status: 400 });
    const specimens = Array.isArray(b.specimens) ? b.specimens : [];

    await tx(async (c) => {
      await c.query(
        'UPDATE exp_runs SET temp_upper = $1, temp_lower = $2 WHERE id = $3',
        [b.tempUpper ?? null, b.tempLower ?? null, runId],
      );
      await c.query('DELETE FROM exp_specimens WHERE run_id = $1', [runId]);
      for (const s of specimens) {
        await c.query(
          `INSERT INTO exp_specimens
             (run_id, specimen_no, weight, hardness, defect_severity, defect_zones, memo)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::int[], $7)`,
          [
            runId,
            s.specimen_no,
            s.weight ?? null,
            s.hardness ?? null,
            JSON.stringify(s.defect_severity ?? {}),
            Array.isArray(s.defect_zones) ? s.defect_zones : [],
            s.memo ?? '',
          ],
        );
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? '저장 실패' }, { status: 500 });
  }
}
