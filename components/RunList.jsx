'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function RunList({ runs, factors, molds, boilers, onRefresh, onOpenLot }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    phase: '1차', mold_id: '', is_control: false,
    active_factor_id: '', active_factor_value: '', memo: '', fixedValues: {},
  });
  const [specimenCounts, setSpecimenCounts] = useState({});
  const [fixedFactorsMap, setFixedFactorsMap] = useState({});

  const activeFactors = factors.filter(f => f.is_active);
  const activeMolds = molds.filter(m => m.is_active);

  useEffect(() => { loadExtra(); }, [runs]);

  async function loadExtra() {
    if (!runs.length) return;
    const [specRes, fixRes] = await Promise.all([
      supabase.from('exp_specimens').select('run_id'),
      supabase.from('exp_run_fixed_factors').select('*'),
    ]);
    if (specRes.data) {
      const counts = {};
      specRes.data.forEach(s => { counts[s.run_id] = (counts[s.run_id] || 0) + 1; });
      setSpecimenCounts(counts);
    }
    if (fixRes.data) {
      const map = {};
      fixRes.data.forEach(ff => {
        if (!map[ff.run_id]) map[ff.run_id] = [];
        map[ff.run_id].push(ff);
      });
      setFixedFactorsMap(map);
    }
  }

  function openCreateForm() {
    const defaults = {};
    activeFactors.forEach(f => {
      if (f.default_value) defaults[f.id] = f.default_value;
    });
    setForm({ ...form, fixedValues: defaults });
    setShowCreate(true);
  }

  async function createRun() {
    if (!form.mold_id) return alert('금형을 선택하세요');
    if (!form.active_factor_id && !form.is_control) return alert('실험 변수를 선택하세요');

    const mold = activeMolds.find(m => m.id === Number(form.mold_id));
    const boiler = boilers.find(b => b.id === mold?.boiler_id);
    const activeFactor = activeFactors.find(f => f.id === Number(form.active_factor_id));

    const { data: run, error } = await supabase.from('exp_runs').insert({
      phase: form.phase,
      mold_id: mold.id,
      mold_name: mold.mold_id,
      boiler_id: boiler?.id || null,
      boiler_no: boiler?.boiler_no || null,
      ref_weight: mold.ref_weight,
      is_control: form.is_control,
      active_factor_id: form.is_control ? null : activeFactor?.id,
      active_factor_name: form.is_control ? null : activeFactor?.name,
      active_factor_value: form.is_control ? null : form.active_factor_value,
      memo: form.memo,
    }).select().single();

    if (error) return alert('생성 실패: ' + error.message);

    if (!form.is_control) {
      const fixedRows = activeFactors
        .filter(f => f.id !== Number(form.active_factor_id))
        .map(f => ({
          run_id: run.id, factor_id: f.id, factor_name: f.name,
          fixed_value: form.fixedValues[f.id] || '',
        }))
        .filter(r => r.fixed_value);
      if (fixedRows.length) {
        await supabase.from('exp_run_fixed_factors').insert(fixedRows);
      }
    }

    setShowCreate(false);
    setForm({
      phase: '1차', mold_id: '', is_control: false,
      active_factor_id: '', active_factor_value: '', memo: '', fixedValues: {},
    });
    onRefresh();
  }

  async function deleteRun(runId, e) {
    e.stopPropagation();
    if (!confirm('이 실험 Run과 모든 시편 데이터를 삭제하시겠습니까?')) return;
    await supabase.from('exp_specimens').delete().eq('run_id', runId);
    await supabase.from('exp_run_fixed_factors').delete().eq('run_id', runId);
    await supabase.from('exp_runs').delete().eq('id', runId);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-700">실험 Run ({runs.length}개)</h2>
        <button onClick={openCreateForm} className="btn btn-sm btn-primary">+ 실험 추가</button>
      </div>

      {showCreate && (
        <div className="card space-y-3 border-purple-200 bg-purple-50/30">
          <div className="text-sm font-semibold text-purple-800 mb-1">새 실험 Run</div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm">
              <option>1차</option><option>2차</option><option>3차</option>
            </select>
            <select value={form.mold_id} onChange={e => setForm({ ...form, mold_id: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm">
              <option value="">금형 선택</option>
              {activeMolds.map(m => {
                const b = boilers.find(b => b.id === m.boiler_id);
                return <option key={m.id} value={m.id}>{m.mold_id} {b ? `(${b.boiler_no}번)` : ''}</option>;
              })}
            </select>
          </div>

          {form.mold_id && (() => {
            const mold = activeMolds.find(m => m.id === Number(form.mold_id));
            const boiler = boilers.find(b => b.id === mold?.boiler_id);
            return mold ? (
              <div className="flex gap-2 flex-wrap">
                <span className="badge badge-primary">기준 {mold.ref_weight}g</span>
                {boiler && <span className="badge bg-blue-50 text-blue-700">{boiler.boiler_no}번 보일러</span>}
              </div>
            ) : null;
          })()}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_control}
              onChange={e => setForm({ ...form, is_control: e.target.checked })} className="rounded" />
            대조군 (변수 변경 없음)
          </label>

          {!form.is_control && (
            <>
              <div className="text-xs text-gray-500 font-medium">실험 변수 (1개만 선택)</div>
              <div className="space-y-2">
                {activeFactors.map(f => {
                  const isActive = Number(form.active_factor_id) === f.id;
                  return (
                    <div key={f.id} className={`flex items-center gap-2 p-2 rounded-lg ${isActive ? 'bg-purple-100' : 'bg-gray-50'}`}>
                      <input type="radio" name="active-factor" checked={isActive}
                        onChange={() => setForm({ ...form, active_factor_id: String(f.id) })}
                        className="accent-purple-600" />
                      <span className="text-sm font-medium flex-1">{f.name}</span>
                      {isActive ? (
                        <div className="flex items-center gap-1">
                          <span className="badge badge-primary">실험 중</span>
                          <input type="text" value={form.active_factor_value}
                            onChange={e => setForm({ ...form, active_factor_value: e.target.value })}
                            placeholder="실험값" className="w-20 text-xs text-center border rounded px-2 py-1" />
                          <span className="text-xs text-gray-400">{f.unit}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">🔒</span>
                          <input type="text" value={form.fixedValues[f.id] || ''}
                            onChange={e => setForm({
                              ...form, fixedValues: { ...form.fixedValues, [f.id]: e.target.value }
                            })}
                            placeholder="고정값" className="w-20 text-xs text-center border rounded px-2 py-1" />
                          <span className="text-xs text-gray-400">{f.unit}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <input type="text" value={form.memo}
            onChange={e => setForm({ ...form, memo: e.target.value })}
            placeholder="메모 (예: 온도 53℃로 변경)"
            className="w-full border rounded-lg px-3 py-2 text-sm" />

          <div className="flex gap-2">
            <button onClick={createRun} className="btn btn-primary">생성</button>
            <button onClick={() => setShowCreate(false)} className="btn btn-outline">취소</button>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 text-sm">
          <div className="text-3xl mb-2">🧪</div>
          실험 Run이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => {
            const count = specimenCounts[run.id] || 0;
            const fixed = fixedFactorsMap[run.id] || [];
            return (
              <div key={run.id} className="card cursor-pointer hover:border-purple-300 transition-colors"
                onClick={() => onOpenLot(run.id)}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-success">{run.phase}</span>
                    <span className="text-sm font-medium">{run.mold_name}</span>
                    {run.boiler_no && <span className="text-xs text-gray-400">{run.boiler_no}번</span>}
                    {run.is_control && <span className="badge badge-danger">대조군</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {new Date(run.created_at).toLocaleDateString('ko-KR')}
                    </span>
                    <button onClick={e => deleteRun(run.id, e)}
                      className="text-gray-300 hover:text-red-500 text-xs px-1" title="삭제">🗑</button>
                  </div>
                </div>
                {run.active_factor_name && (
                  <div className="flex gap-1 flex-wrap mb-2">
                    <span className="badge badge-primary">🧪 {run.active_factor_name}: {run.active_factor_value}</span>
                    {fixed.map(ff => (
                      <span key={ff.id} className="badge badge-lock">🔒 {ff.factor_name}: {ff.fixed_value}</span>
                    ))}
                  </div>
                )}
                {run.memo && <div className="text-xs text-gray-400 mb-2">{run.memo}</div>}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">시편 {count}개</span>
                  <span className="text-xs text-purple-500">로트 입력 →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
