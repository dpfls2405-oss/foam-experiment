'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ZONE_LABELS = ['좌상', '상', '우상', '좌중', '중앙', '우중', '좌하', '하', '우하'];
const SEV_COLORS = ['', '#FEF3C7', '#FED7AA', '#FECACA'];
const SEV_TEXT = ['', '#92400E', '#9A3412', '#991B1B'];
const SEV_LABELS = ['없음', '경미', '보통', '심각'];
const DEFAULT_COUNT = 10;

export default function LotInput({ runId, runs, factors, onRefresh, onSelectRun }) {
  const [specimens, setSpecimens] = useState([]);
  const [fixedFactors, setFixedFactors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [zoneEditIdx, setZoneEditIdx] = useState(null);
  const [tempUpper, setTempUpper] = useState('');
  const [tempLower, setTempLower] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoMemo, setPhotoMemo] = useState('');

  const run = runs.find(r => r.id === runId);

  useEffect(() => {
    if (runId) {
      loadSpecimens();
      loadFixed();
      if (run) {
        setTempUpper(run.temp_upper || '');
        setTempLower(run.temp_lower || '');
        setPhotoPreview(run.photo_url || null);
        setPhotoMemo(run.photo_memo || '');
      }
    }
  }, [runId]);

  async function loadSpecimens() {
    const { data } = await supabase.from('exp_specimens').select('*')
      .eq('run_id', runId).order('specimen_no');
    if (data && data.length > 0) {
      setSpecimens(data.map(s => ({
        ...s,
        defect_severity: s.defect_severity || {},
      })));
    } else {
      initEmpty(DEFAULT_COUNT);
    }
  }

  async function loadFixed() {
    const { data } = await supabase.from('exp_run_fixed_factors').select('*').eq('run_id', runId);
    setFixedFactors(data || []);
  }

  function initEmpty(count) {
    setSpecimens(Array.from({ length: count }, (_, i) => ({
      run_id: runId, specimen_no: i + 1,
      weight: null, hardness: null, defect_severity: {}, memo: '',
    })));
  }

  function updateSpec(idx, field, value) {
    setSpecimens(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value === '' ? null : Number(value) };
      return next;
    });
  }

  function cycleZoneSeverity(specIdx, zoneIdx) {
    setSpecimens(prev => {
      const next = [...prev];
      const sev = { ...(next[specIdx].defect_severity || {}) };
      const current = sev[zoneIdx] || 0;
      const newVal = (current + 1) % 4;
      if (newVal === 0) delete sev[zoneIdx];
      else sev[zoneIdx] = newVal;
      next[specIdx] = { ...next[specIdx], defect_severity: sev };
      return next;
    });
  }

  function getMaxSeverity(spec) {
    const sev = spec.defect_severity || {};
    const vals = Object.values(sev);
    if (vals.length === 0) return 0;
    return Math.max(...vals);
  }

  function getSeveritySum(spec) {
    const sev = spec.defect_severity || {};
    return Object.values(sev).reduce((a, b) => a + b, 0);
  }

  async function uploadPhoto() {
    if (!photoFile || !runId) return null;
    const ext = photoFile.name.split('.').pop();
    const path = `experiment/${runId}/lot-photo.${ext}`;
    const { error } = await supabase.storage.from('foam-photos').upload(path, photoFile, { upsert: true });
    if (error) { console.error(error); return null; }
    const { data: urlData } = supabase.storage.from('foam-photos').getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function saveAll() {
    if (!runId) return;
    setSaving(true);
    try {
      let photoUrl = run?.photo_url || null;
      if (photoFile) photoUrl = await uploadPhoto();

      await supabase.from('exp_runs').update({
        temp_upper: tempUpper ? Number(tempUpper) : null,
        temp_lower: tempLower ? Number(tempLower) : null,
        photo_url: photoUrl,
        photo_memo: photoMemo || null,
      }).eq('id', runId);

      await supabase.from('exp_specimens').delete().eq('run_id', runId);
      const rows = specimens
        .filter(s => s.weight !== null || s.hardness !== null || Object.keys(s.defect_severity || {}).length > 0)
        .map(s => ({
          run_id: runId, specimen_no: s.specimen_no,
          weight: s.weight, hardness: s.hardness,
          defect_severity: s.defect_severity || {},
          defect_zones: Object.keys(s.defect_severity || {}).map(Number),
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

  async function deleteRun() {
    if (!confirm('이 로트의 모든 데이터를 삭제하시겠습니까?')) return;
    await supabase.from('exp_specimens').delete().eq('run_id', runId);
    await supabase.from('exp_run_fixed_factors').delete().eq('run_id', runId);
    await supabase.from('exp_runs').delete().eq('id', runId);
    onSelectRun(null);
    onRefresh();
  }

  function addSpecimen() {
    setSpecimens(prev => [...prev, {
      run_id: runId, specimen_no: prev.length + 1,
      weight: null, hardness: null, defect_severity: {}, memo: '',
    }]);
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
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
              <button key={r.id} onClick={() => onSelectRun(r.id)} className="w-full btn btn-outline text-left">
                <span className="font-medium">{r.mold_name}</span>
                <span className="text-gray-400 ml-2">{r.phase} · {r.active_factor_name}: {r.active_factor_value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filled = specimens.filter(s => s.weight !== null);
  const avgWeight = filled.length ? Math.round(filled.reduce((a, s) => a + s.weight, 0) / filled.length) : 0;
  const hardFilled = specimens.filter(s => s.hardness !== null);
  const avgHard = hardFilled.length ? (hardFilled.reduce((a, s) => a + s.hardness, 0) / hardFilled.length).toFixed(1) : '—';
  const defectCount = specimens.filter(s => Object.keys(s.defect_severity || {}).length > 0).length;
  const totalSeverity = specimens.reduce((a, s) => a + getSeveritySum(s), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="badge badge-success">{run.phase}</span>
          <span className="text-sm font-semibold">{run.mold_name}</span>
          <span className="text-xs text-gray-400">· 기준 {run.ref_weight}g</span>
        </div>
        <button onClick={deleteRun} className="text-xs text-gray-400 hover:text-red-500">🗑 삭제</button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {run.active_factor_name && (
          <span className="badge badge-primary">🧪 {run.active_factor_name}: {run.active_factor_value}</span>
        )}
        {fixedFactors.map(ff => (
          <span key={ff.id} className="badge badge-lock">🔒 {ff.factor_name}: {ff.fixed_value}</span>
        ))}
      </div>

      {/* 금형 온도 (로트당 1회) */}
      <div className="card">
        <div className="text-xs text-gray-500 font-medium mb-2">금형 표면 온도 (℃)</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">상형</label>
            <input type="number" step="0.1" value={tempUpper}
              onChange={e => setTempUpper(e.target.value)}
              placeholder="—" className="w-full border rounded-lg px-3 py-2 text-sm text-center" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">하형</label>
            <input type="number" step="0.1" value={tempLower}
              onChange={e => setTempLower(e.target.value)}
              placeholder="—" className="w-full border rounded-lg px-3 py-2 text-sm text-center" />
          </div>
        </div>
      </div>

      {/* 로트 그리드 */}
      <div className="card p-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-gray-400">
                <th className="py-2 w-8 text-center">#</th>
                <th className="py-2 text-center">중량(g)</th>
                <th className="py-2 text-center">경도</th>
                <th className="py-2 text-center">미충진</th>
                <th className="py-2 text-center w-10">구역</th>
              </tr>
            </thead>
            <tbody>
              {specimens.map((s, idx) => {
                const maxSev = getMaxSeverity(s);
                const sevSum = getSeveritySum(s);
                const hasDefect = maxSev > 0;
                return (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="py-1 text-center text-xs text-gray-400 font-medium">{s.specimen_no}</td>
                    <td className="py-1 px-1">
                      <input type="number" value={s.weight ?? ''}
                        onChange={e => updateSpec(idx, 'weight', e.target.value)}
                        className="w-full text-center text-sm border rounded px-1 py-1.5" placeholder="—" />
                    </td>
                    <td className="py-1 px-1">
                      <input type="number" value={s.hardness ?? ''}
                        onChange={e => updateSpec(idx, 'hardness', e.target.value)}
                        className="w-full text-center text-sm border rounded px-1 py-1.5" placeholder="—" />
                    </td>
                    <td className="py-1 text-center">
                      {hasDefect ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{ background: SEV_COLORS[maxSev], color: SEV_TEXT[maxSev] }}>
                          {SEV_LABELS[maxSev]}
                        </span>
                      ) : (
                        <span className="text-xs text-green-500">양호</span>
                      )}
                    </td>
                    <td className="py-1 text-center">
                      <button onClick={() => setZoneEditIdx(zoneEditIdx === idx ? null : idx)}
                        className={`text-lg ${hasDefect ? 'text-red-400' : 'text-green-400'}`}>
                        {hasDefect ? '⚠' : '✓'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={addSpecimen}
          className="w-full mt-2 py-2 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:bg-gray-50">
          + 시편 추가
        </button>
      </div>

      {/* 구역맵 심각도 */}
      {zoneEditIdx !== null && (
        <div className="card">
          <div className="text-xs text-gray-400 mb-1">
            시편 #{specimens[zoneEditIdx]?.specimen_no} — 구역 터치로 심각도 순환
          </div>
          <div className="flex gap-2 mb-3 text-[10px] text-gray-400 justify-center">
            <span>터치: 없음 → </span>
            <span style={{ background: SEV_COLORS[1], color: SEV_TEXT[1], padding: '1px 6px', borderRadius: 4 }}>경미(1)</span>
            <span> → </span>
            <span style={{ background: SEV_COLORS[2], color: SEV_TEXT[2], padding: '1px 6px', borderRadius: 4 }}>보통(2)</span>
            <span> → </span>
            <span style={{ background: SEV_COLORS[3], color: SEV_TEXT[3], padding: '1px 6px', borderRadius: 4 }}>심각(3)</span>
            <span> → 없음</span>
          </div>
          <div className="grid grid-cols-3 gap-2 w-48 mx-auto">
            {ZONE_LABELS.map((label, zi) => {
              const sev = (specimens[zoneEditIdx]?.defect_severity || {})[zi] || 0;
              return (
                <button key={zi} onClick={() => cycleZoneSeverity(zoneEditIdx, zi)}
                  className="aspect-square flex flex-col items-center justify-center rounded-lg border transition-all text-xs"
                  style={{
                    background: sev > 0 ? SEV_COLORS[sev] : '#f9fafb',
                    color: sev > 0 ? SEV_TEXT[sev] : '#9ca3af',
                    borderColor: sev > 0 ? SEV_TEXT[sev] + '40' : '#e5e7eb',
                  }}>
                  <span>{label}</span>
                  {sev > 0 && <span className="font-semibold text-sm">{sev}</span>}
                </button>
              );
            })}
          </div>
          <div className="text-center mt-3">
            <button onClick={() => setZoneEditIdx(null)} className="btn btn-sm btn-outline">닫기</button>
          </div>
        </div>
      )}

      {/* 사진 + 코멘트 */}
      <div className="card">
        <div className="text-xs text-gray-500 font-medium mb-2">사진 · 코멘트</div>
        {photoPreview && (
          <div className="mb-2">
            <img src={photoPreview} alt="로트 사진" className="w-full rounded-lg max-h-48 object-cover" />
          </div>
        )}
        <div className="flex gap-2 mb-2">
          <label className="btn btn-sm btn-outline cursor-pointer flex-1 text-center">
            📷 촬영
            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
          </label>
          <label className="btn btn-sm btn-outline cursor-pointer flex-1 text-center">
            🖼 갤러리
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </label>
        </div>
        <textarea
          value={photoMemo}
          onChange={e => setPhotoMemo(e.target.value)}
          placeholder="사진으로 안 보이는 불량 내용, 현장 메모 등을 기록하세요"
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
          rows={2}
        />
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="metric-card">
          <div className="text-lg font-semibold">{avgWeight || '—'}g</div>
          <div className="text-[10px] text-gray-400">평균 중량</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold">{avgHard}</div>
          <div className="text-[10px] text-gray-400">평균 경도</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="metric-card">
          <div className="text-lg font-semibold">{tempUpper || '—'}℃</div>
          <div className="text-[10px] text-gray-400">금형온도(상)</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold">{tempLower || '—'}℃</div>
          <div className="text-[10px] text-gray-400">금형온도(하)</div>
        </div>
        <div className="metric-card">
          <div className={`text-lg font-semibold ${defectCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {defectCount}/{specimens.length}
          </div>
          <div className="text-[10px] text-gray-400">미충진 시편</div>
        </div>
      </div>
      {totalSeverity > 0 && (
        <div className="metric-card">
          <div className="text-lg font-semibold text-red-500">{totalSeverity}</div>
          <div className="text-[10px] text-gray-400">심각도 총합 (낮을수록 양호)</div>
        </div>
      )}

      <button onClick={saveAll} disabled={saving} className="btn btn-primary w-full py-3 text-base">
        {saving ? '저장 중...' : '💾 로트 저장'}
      </button>
    </div>
  );
}
