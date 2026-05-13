'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Settings({ molds, boilers, factors, onRefresh }) {
  const [showAddMold, setShowAddMold] = useState(false);
  const [newMold, setNewMold] = useState({ mold_id: '', ref_weight: 770, boiler_id: '', description: '' });
  const [saving, setSaving] = useState(false);

  const activeMolds = molds.filter(m => m.is_active);
  const inactiveMolds = molds.filter(m => !m.is_active);
  const activeFactors = factors.filter(f => f.is_active);

  async function addMold() {
    if (!newMold.mold_id) return alert('금형 ID를 입력하세요');
    const { error } = await supabase.from('exp_molds').insert({
      mold_id: newMold.mold_id,
      ref_weight: Number(newMold.ref_weight),
      boiler_id: newMold.boiler_id || null,
      description: newMold.description || null,
    });
    if (error) return alert('저장 실패: ' + error.message);
    setNewMold({ mold_id: '', ref_weight: 770, boiler_id: '', description: '' });
    setShowAddMold(false);
    onRefresh();
  }

  async function saveMoldWeight(moldId, weight) {
    await supabase.from('exp_molds').update({ ref_weight: Number(weight) }).eq('id', moldId);
    onRefresh();
  }

  async function updateMoldBoiler(moldId, boilerId) {
    await supabase.from('exp_molds').update({ boiler_id: boilerId || null }).eq('id', moldId);
    onRefresh();
  }

  async function toggleMold(moldId, isActive) {
    await supabase.from('exp_molds').update({ is_active: !isActive }).eq('id', moldId);
    onRefresh();
  }

  async function saveFactorDefault(factorId, value) {
    await supabase.from('exp_factors').update({ default_value: value || null }).eq('id', factorId);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      {/* 금형 관리 */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-700">금형 ({activeMolds.length}개 활성)</h2>
          <button onClick={() => setShowAddMold(true)} className="btn btn-sm btn-outline">
            + 금형 추가
          </button>
        </div>

        {showAddMold && (
          <div className="bg-purple-50 rounded-lg p-3 mb-3 space-y-2">
            <input
              type="text"
              value={newMold.mold_id}
              onChange={e => setNewMold({ ...newMold, mold_id: e.target.value })}
              placeholder="금형 ID (예: TC13-F)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={newMold.ref_weight}
                onChange={e => setNewMold({ ...newMold, ref_weight: e.target.value })}
                placeholder="기준 중량(g)"
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={newMold.boiler_id}
                onChange={e => setNewMold({ ...newMold, boiler_id: e.target.value })}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">보일러 선택</option>
                {boilers.map(b => (
                  <option key={b.id} value={b.id}>{b.boiler_no}번 보일러</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={newMold.description}
              onChange={e => setNewMold({ ...newMold, description: e.target.value })}
              placeholder="설명 (선택)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button onClick={addMold} className="btn btn-sm btn-primary">저장</button>
              <button onClick={() => setShowAddMold(false)} className="btn btn-sm btn-outline">취소</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {activeMolds.map(m => {
            const boiler = boilers.find(b => b.id === m.boiler_id);
            return (
              <div key={m.id} className="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0 flex-wrap">
                <div className="flex-1 min-w-[100px]">
                  <div className="text-sm font-medium">{m.mold_id}</div>
                  <div className="text-xs text-gray-400">{m.description}</div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">기준</span>
                  <input
                    type="number"
                    defaultValue={m.ref_weight}
                    onBlur={e => saveMoldWeight(m.id, e.target.value)}
                    className="w-16 text-xs text-center border rounded px-1 py-1.5"
                  />
                  <span className="text-xs text-gray-400">g</span>
                </div>
                <select
                  value={m.boiler_id || ''}
                  onChange={e => updateMoldBoiler(m.id, e.target.value)}
                  className="text-xs border rounded px-2 py-1.5 w-24"
                >
                  <option value="">보일러</option>
                  {boilers.map(b => (
                    <option key={b.id} value={b.id}>{b.boiler_no}번</option>
                  ))}
                </select>
                <button
                  onClick={() => toggleMold(m.id, m.is_active)}
                  className="text-xs text-gray-300 hover:text-red-400 px-1"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {inactiveMolds.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-2">비활성 금형</div>
            {inactiveMolds.map(m => (
              <div key={m.id} className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-400">{m.mold_id}</span>
                <button onClick={() => toggleMold(m.id, m.is_active)} className="text-xs text-purple-500">
                  활성화
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 고정변수 기본값 */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">고정변수 기본 셋팅값</h2>
        <p className="text-xs text-gray-400 mb-3">실험 Run 생성 시 고정값 기본 입력에 사용됩니다</p>
        <div className="space-y-2">
          {activeFactors.map(f => (
            <div key={f.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1">
                <div className="text-sm font-medium">{f.name}</div>
              </div>
              <input
                type="text"
                defaultValue={f.default_value || ''}
                onBlur={e => saveFactorDefault(f.id, e.target.value)}
                placeholder="기본값"
                className="w-24 text-sm text-center border rounded px-2 py-1.5"
              />
              <span className="text-xs text-gray-400 w-10">{f.unit}</span>
            </div>
          ))}
          {activeFactors.length === 0 && (
            <div className="text-sm text-gray-400 text-center py-4">OFAT 탭에서 변수를 추가하세요</div>
          )}
        </div>
      </div>
    </div>
  );
}
