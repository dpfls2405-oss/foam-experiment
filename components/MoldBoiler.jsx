'use client';
import { useState } from 'react';

async function patchJson(url, body) {
  await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export default function MoldBoiler({ molds, boilers, onRefresh }) {
  const [showAddMold, setShowAddMold] = useState(false);
  const [newMold, setNewMold] = useState({ mold_id: '', ref_weight: 580, boiler_id: '', description: '' });
  const [editingBoiler, setEditingBoiler] = useState(null);
  const [boilerTemp, setBoilerTemp] = useState('');

  async function addMold() {
    if (!newMold.mold_id) return alert('금형 ID를 입력하세요');
    const res = await fetch('/api/molds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mold_id: newMold.mold_id,
        ref_weight: Number(newMold.ref_weight),
        boiler_id: newMold.boiler_id || null,
        description: newMold.description || null,
      }),
    });
    const data = await res.json();
    if (!data.ok) return alert('저장 실패: ' + (data.error || ''));
    setNewMold({ mold_id: '', ref_weight: 580, boiler_id: '', description: '' });
    setShowAddMold(false);
    onRefresh();
  }

  async function updateMoldBoiler(moldId, boilerId) {
    await patchJson('/api/molds', { id: moldId, boiler_id: boilerId || null });
    onRefresh();
  }

  async function updateMoldWeight(moldId, weight) {
    await patchJson('/api/molds', { id: moldId, ref_weight: Number(weight) });
    onRefresh();
  }

  async function toggleMold(moldId, isActive) {
    await patchJson('/api/molds', { id: moldId, is_active: !isActive });
    onRefresh();
  }

  async function updateBoilerTemp(boilerId) {
    await patchJson('/api/boilers', { id: boilerId, setting_temp: Number(boilerTemp) });
    setEditingBoiler(null);
    setBoilerTemp('');
    onRefresh();
  }

  const activeMolds = molds.filter(m => m.is_active);
  const inactiveMolds = molds.filter(m => !m.is_active);

  return (
    <div className="space-y-4">
      {/* 보일러 섹션 */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-700">보일러 ({boilers.length}대)</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {boilers.map(b => (
            <div key={b.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-gray-400">{b.boiler_no}번</div>
                  <div className="text-sm font-medium">{b.name}</div>
                </div>
                {editingBoiler === b.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={boilerTemp}
                      onChange={e => setBoilerTemp(e.target.value)}
                      className="w-16 text-xs text-center border rounded px-1 py-1"
                      autoFocus
                    />
                    <button onClick={() => updateBoilerTemp(b.id)} className="text-xs text-purple-600">✓</button>
                    <button onClick={() => setEditingBoiler(null)} className="text-xs text-gray-400">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingBoiler(b.id); setBoilerTemp(b.setting_temp || ''); }}
                    className="text-lg font-semibold text-gray-800"
                  >
                    {b.setting_temp}℃
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                연결 금형: {activeMolds.filter(m => m.boiler_id === b.id).map(m => m.mold_id).join(', ') || '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 금형 섹션 */}
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
              <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <div className="text-sm font-medium">{m.mold_id}</div>
                  <div className="text-xs text-gray-400">{m.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-400">기준</div>
                  <input
                    type="number"
                    defaultValue={m.ref_weight}
                    onBlur={e => updateMoldWeight(m.id, e.target.value)}
                    className="w-16 text-xs text-center border rounded px-1 py-1"
                  />
                  <span className="text-xs text-gray-400">g</span>
                </div>
                <select
                  value={m.boiler_id || ''}
                  onChange={e => updateMoldBoiler(m.id, e.target.value)}
                  className="text-xs border rounded px-2 py-1 w-24"
                >
                  <option value="">보일러</option>
                  {boilers.map(b => (
                    <option key={b.id} value={b.id}>{b.boiler_no}번</option>
                  ))}
                </select>
                <button
                  onClick={() => toggleMold(m.id, m.is_active)}
                  className="text-xs text-gray-300 hover:text-red-400"
                  title="비활성화"
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
                <button
                  onClick={() => toggleMold(m.id, m.is_active)}
                  className="text-xs text-purple-500"
                >
                  활성화
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
