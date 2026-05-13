'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ZONE_LABELS = ['좌상', '상', '우상', '좌중', '중앙', '우중', '좌하', '하', '우하'];
const DEFAULT_COUNT = 10;

export default function LotInput({ runId, runs, factors, onRefresh, onSelectRun }) {
  const [specimens, setSpecimens] = useState([]);
  const [fixedFactors, setFixedFactors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [zoneEditIdx, setZoneEditIdx] = useState(null);
  const [specCount, setSpecCount] = useState(DEFAULT_COUNT);

  const run = runs.find(r => r.id === runId);

  useEffect(() => {
    if (runId) {
      loadSpecimens();
      loadFixed();
    }
  }, [runId]);

  async function loadSpecimens() {
    const { data } = await supabase
      .from('exp_specimens')
      .select('*')
      .eq('run_id', runId)
      .order('specimen_no');
    if (data && data.length > 0) {
      setSpecimens(data);
      setSpecCount(data.length);
    } else {
      initEmpty(DEFAULT_COUNT);
    }
  }

  async function loadFixed() {
    const { data } = await supabase
      .from('exp_run_fixed_factors')
      .select('*')
      .eq('run_id', runId);
    setFixedFactors(data || []);
  }

  function initEmpty(count) {
    setSpecimens(
      Array.from({ length: count }, (_, i) => ({
        run_id: runId,
        specimen_no: i + 1,
        weight: null,
        hardness: null,
        temp_upper: null,
        temp_lower: null,
        defect_zones: [],
        memo: '',
      }))
    );
  }

  function updateSpec(idx, field, value) {
    setSpecimens(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value === '' ? null : Number(value) };
      return next;
    });
  }

  function toggleZone(specIdx, zoneIdx) {
    setSpecimens(prev => {
      const next = [...prev];
      const zones = [...(next[specIdx].defect_zones || [])];
      const i = zones.indexOf(zoneIdx);
      if (i >= 0) zones.splice(i, 1);
      else zones.push(zoneIdx);
      next[specIdx] = { ...next[specIdx], defect_zones: zones };
      return next;
    });
  }

  async function saveAll() {
    if (!runId) return;
    setSaving(true);
    try {
      // 기존 데이터 삭제 후 재삽입
      await supabase.from('exp_specimens').delete().eq('run_id', runId);
      const rows = specimens
        .filter(s => s.weight !== null || s.hardness !== null || s.temp_upper !== null)
        .map(s => ({
          run_id: runId,
          specimen_no: s.specimen_no,
          weight: s.weight,
          hardness: s.hardness,
          temp_upper: s.temp_upper,
          temp_lower: s.temp_lower,
          defect_zones: s.defect_zones || [],
          memo: s.memo || '',
        }));
      if (rows.length) {
        const { error } = await supabase.from('exp_specimens').insert(rows);
        if (error) throw error;
      }
      alert('저장 완료');
      onRefresh();
    } catch (err) {
      alert('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function addSpecimen() {
    const newNo = specimens.length + 1;
    setSpecimens(prev => [...prev, {
      run_id: runId, specimen_no: newNo, weight: null, hardness: null,
      temp_upper: null, temp_lower: null, defect_zones: [], memo: '',
    }]);
    setSpecCount(prev => prev + 1);
  }

  function getFillRate(weight) {
    if (!weight || !run) return null;
    return (weight / run.ref_weight * 100).toFixed(1);
  }

  function getFillClass(rate) {
    if (rate === null) return '';
    const r = parseFloat(rate);
    if (r >= 98) return 'fill-ok';
    if (r >= 95) return 'fill-mid';
    return 'fill-low';
  }

  if (!runId || !run) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">로트 입력</h2>
        <div className="card text-center py-12">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm text-gray-400 mb-4">실험 Run을 선택하세요</p>
          <div className="space-y-2">
            {runs.map(r => (
              <button
                key={r.id}
                onClick={() => onSelectRun(r.id)}
                className="w-full btn btn-outline text-left"
              >
                <span className="font-medium">{r.mold_name}</span>
                <span className="text-gray-400 ml-2">{r.phase} · {r.active_factor_name}: {r.active_factor_value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 요약 계산
  const filled = specimens.filter(s => s.weight !== null);
  const avgWeight = filled.length ? Math.round(filled.reduce((a, s) => a + s.weight, 0) / filled.length) : 0;
  const avgFill = filled.length ? (filled.reduce((a, s) => a + s.weight / run.ref_weight * 100, 0) / filled.length).toFixed(1) : '0';
  const hardFilled = specimens.filter(s => s.hardness !== null);
  const avgHard = hardFilled.length ? (hardFilled.reduce((a, s) => a + s.hardness, 0) / hardFilled.length).toFixed(1) : '0';
  const tempUpFilled = specimens.filter(s => s.temp_upper !== null);
  const avgTempUp = tempUpFilled.length ? (tempUpFilled.reduce((a, s) => a + s.temp_upper, 0) / tempUpFilled.length).toFixed(1) : '0';
  const tempLoFilled = specimens.filter(s => s.temp_lower !== null);
  const avgTempLo = tempLoFilled.length ? (tempLoFilled.reduce((a, s) => a + s.temp_lower, 0) / tempLoFilled.length).toFixed(1) : '0';
  const defectCount = specimens.filter(s => (s.defect_zones || []).length > 0).length;

  return (
    <div className="space-y-4">
      {/* Run 정보 */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="badge badge-success">{run.phase}</span>
        <span className="text-sm font-semibold">{run.mold_name}</span>
        {run.boiler_no && <span className="text-xs text-gray-400">{run.boiler_no}번 보일러</span>}
        <span className="text-xs text-gray-400">· 기준 {run.ref_weight}g</span>
      </div>

      <div className="flex gap-1 flex-wrap">
        {run.active_factor_name && (
          <span className="badge badge-primary">🧪 {run.active_factor_name}: {run.active_factor_value}</span>
        )}
        {fixedFactors.map(ff => (
          <span key={ff.id} className="badge badge-lock">🔒 {ff.factor_name}: {ff.fixed_value}</span>
        ))}
      </div>

      {/* 로트 그리드 */}
      <div className="card p-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-gray-400">
                <th className="py-2 w-8 text-center">#</th>
                <th className="py-2 text-center">중량(g)</th>
                <th className="py-2 text-center">충진율</th>
                <th className="py-2 text-center">경도</th>
                <th className="py-2 text-center" colSpan={2}>금형온도(℃)</th>
                <th className="py-2 text-center w-10">구역</th>
              </tr>
              <tr className="text-[10px] text-gray-300">
                <th></th><th></th><th></th><th></th>
                <th className="border-l border-gray-100">상</th>
                <th>하</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {specimens.map((s, idx) => {
                const fill = getFillRate(s.weight);
                const hasZones = (s.defect_zones || []).length > 0;
                return (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="py-1 text-center text-xs text-gray-400 font-medium">{s.specimen_no}</td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        value={s.weight ?? ''}
                        onChange={e => updateSpec(idx, 'weight', e.target.value)}
                        className="w-full text-center text-sm border rounded px-1 py-1.5"
                        placeholder="—"
                      />
                    </td>
                    <td className="py-1 text-center">
                      {fill !== null && (
                        <span className={`text-xs font-medium ${getFillClass(fill)}`}>{fill}%</span>
                      )}
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        value={s.hardness ?? ''}
                        onChange={e => updateSpec(idx, 'hardness', e.target.value)}
                        className="w-full text-center text-sm border rounded px-1 py-1.5"
                        placeholder="—"
                      />
                    </td>
                    <td className="py-1 px-1 border-l border-gray-100">
                      <input
                        type="number"
                        step="0.1"
                        value={s.temp_upper ?? ''}
                        onChange={e => updateSpec(idx, 'temp_upper', e.target.value)}
                        className="w-full text-center text-sm border rounded px-1 py-1.5"
                        placeholder="—"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        step="0.1"
                        value={s.temp_lower ?? ''}
                        onChange={e => updateSpec(idx, 'temp_lower', e.target.value)}
                        className="w-full text-center text-sm border rounded px-1 py-1.5"
                        placeholder="—"
                      />
                    </td>
                    <td className="py-1 text-center">
                      <button
                        onClick={() => setZoneEditIdx(zoneEditIdx === idx ? null : idx)}
                        className={`text-lg ${hasZones ? 'text-red-400' : 'text-green-400'}`}
                      >
                        {hasZones ? '⚠' : '✓'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button onClick={addSpecimen} className="w-full mt-2 py-2 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:bg-gray-50">
          + 시편 추가
        </button>
      </div>

      {/* 구역맵 (선택 시) */}
      {zoneEditIdx !== null && (
        <div className="card">
          <div className="text-xs text-gray-400 mb-2">
            시편 #{specimens[zoneEditIdx]?.specimen_no} — 미충진 구역 선택
          </div>
          <div className="grid grid-cols-3 gap-1.5 w-44 mx-auto">
            {ZONE_LABELS.map((label, zi) => {
              const isHit = (specimens[zoneEditIdx]?.defect_zones || []).includes(zi);
              return (
                <button
                  key={zi}
                  onClick={() => toggleZone(zoneEditIdx, zi)}
                  className={`zone-cell ${isHit ? 'hit' : ''}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="text-center mt-2">
            <button onClick={() => setZoneEditIdx(null)} className="btn btn-sm btn-outline">닫기</button>
          </div>
        </div>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="metric-card">
          <div className="text-lg font-semibold">{avgWeight}g</div>
          <div className="text-[10px] text-gray-400">평균 중량</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold">{avgFill}%</div>
          <div className="text-[10px] text-gray-400">평균 충진율</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold">{avgHard}</div>
          <div className="text-[10px] text-gray-400">평균 경도</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold">{avgTempUp}℃</div>
          <div className="text-[10px] text-gray-400">온도(상)</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold">{avgTempLo}℃</div>
          <div className="text-[10px] text-gray-400">온도(하)</div>
        </div>
        <div className="metric-card">
          <div className={`text-lg font-semibold ${defectCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {defectCount}/{specimens.length}
          </div>
          <div className="text-[10px] text-gray-400">미충진 시편</div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={saveAll}
        disabled={saving}
        className="btn btn-primary w-full py-3 text-base"
      >
        {saving ? '저장 중...' : '💾 로트 저장'}
      </button>
    </div>
  );
}
