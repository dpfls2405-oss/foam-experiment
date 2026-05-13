'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function FactorManager({ factors, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newFactor, setNewFactor] = useState({ name: '', unit: '' });

  const active = factors.filter(f => f.is_active);
  const inactive = factors.filter(f => !f.is_active);

  async function addFactor() {
    if (!newFactor.name || !newFactor.unit) return alert('변수명과 단위를 입력하세요');
    const maxOrder = Math.max(0, ...factors.map(f => f.sort_order || 0));
    const { error } = await supabase.from('exp_factors').insert({
      name: newFactor.name,
      unit: newFactor.unit,
      sort_order: maxOrder + 1,
    });
    if (error) return alert('저장 실패: ' + error.message);
    setNewFactor({ name: '', unit: '' });
    setShowAdd(false);
    onRefresh();
  }

  async function toggleFactor(id, isActive) {
    await supabase.from('exp_factors').update({ is_active: !isActive }).eq('id', id);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🔒</span>
          <span className="text-sm font-semibold text-purple-800">OFAT 규칙</span>
        </div>
        <p className="text-xs text-purple-700 leading-relaxed">
          실험 시 변수 1개만 변경하고 나머지는 고정합니다. 실험 Run 생성 시 활성 변수 중 1개를 실험 대상으로 선택하면, 나머지는 자동으로 고정값 입력 필드가 표시됩니다.
        </p>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-700">활성 변수 ({active.length}개)</h2>
          <button onClick={() => setShowAdd(true)} className="btn btn-sm btn-outline">
            + 변수 추가
          </button>
        </div>

        {showAdd && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
            <input
              type="text"
              value={newFactor.name}
              onChange={e => setNewFactor({ ...newFactor, name: e.target.value })}
              placeholder="변수명 (예: 온도, 가스벤트, 주입위치)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              autoFocus
            />
            <input
              type="text"
              value={newFactor.unit}
              onChange={e => setNewFactor({ ...newFactor, unit: e.target.value })}
              placeholder="단위 (예: ℃, mm, 초)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button onClick={addFactor} className="btn btn-sm btn-primary">저장</button>
              <button onClick={() => setShowAdd(false)} className="btn btn-sm btn-outline">취소</button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {active.map(f => (
            <div key={f.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium">{f.name}</div>
                <span className="badge badge-primary">{f.unit}</span>
              </div>
              <button
                onClick={() => toggleFactor(f.id, f.is_active)}
                className="text-xs text-gray-300 hover:text-red-400"
                title="비활성화"
              >
                ✕
              </button>
            </div>
          ))}
          {active.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-sm">활성 변수가 없습니다</div>
          )}
        </div>
      </div>

      {inactive.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">비활성 변수</h2>
          <div className="space-y-2">
            {inactive.map(f => (
              <div key={f.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{f.name} ({f.unit})</span>
                <button
                  onClick={() => toggleFactor(f.id, f.is_active)}
                  className="text-xs text-purple-500"
                >
                  활성화
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
