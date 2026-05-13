'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Settings from '@/components/Settings';
import FactorManager from '@/components/FactorManager';
import RunList from '@/components/RunList';
import LotInput from '@/components/LotInput';
import Analysis from '@/components/Analysis';

const TABS = [
  { id: 'settings', label: '설정', icon: '⚙️' },
  { id: 'ofat', label: 'OFAT', icon: '🔒' },
  { id: 'runs', label: '실험목록', icon: '🧪' },
  { id: 'lot', label: '로트입력', icon: '📋' },
  { id: 'analysis', label: '분석', icon: '📊' },
];

export default function Home() {
  const [tab, setTab] = useState('runs');
  const [selectedRunId, setSelectedRunId] = useState(null);

  const [factors, setFactors] = useState([]);
  const [molds, setMolds] = useState([]);
  const [boilers, setBoilers] = useState([]);
  const [runs, setRuns] = useState([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [fRes, mRes, bRes, rRes] = await Promise.all([
      supabase.from('exp_factors').select('*').order('sort_order'),
      supabase.from('exp_molds').select('*').order('mold_id'),
      supabase.from('exp_boilers').select('*').order('boiler_no'),
      supabase.from('exp_runs').select('*').order('created_at', { ascending: false }),
    ]);
    if (fRes.data) setFactors(fRes.data);
    if (mRes.data) setMolds(mRes.data);
    if (bRes.data) setBoilers(bRes.data);
    if (rRes.data) setRuns(rRes.data);
  }

  function openLot(runId) {
    setSelectedRunId(runId);
    setTab('lot');
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <h1 className="text-base font-semibold text-gray-800">🧪 발포 실험 트래커</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {tab === 'settings' && (
          <Settings molds={molds} boilers={boilers} factors={factors} onRefresh={loadAll} />
        )}
        {tab === 'ofat' && (
          <FactorManager factors={factors} onRefresh={loadAll} />
        )}
        {tab === 'runs' && (
          <RunList
            runs={runs} factors={factors} molds={molds} boilers={boilers}
            onRefresh={loadAll} onOpenLot={openLot}
          />
        )}
        {tab === 'lot' && (
          <LotInput
            runId={selectedRunId} runs={runs} factors={factors}
            onRefresh={loadAll} onSelectRun={setSelectedRunId}
          />
        )}
        {tab === 'analysis' && (
          <Analysis runs={runs} factors={factors} molds={molds} boilers={boilers} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="max-w-2xl mx-auto flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 pt-2.5 text-center transition-colors ${
                tab === t.id
                  ? 'text-purple-600 border-t-2 border-purple-600'
                  : 'text-gray-400 border-t-2 border-transparent'
              }`}
            >
              <div className="text-lg leading-none">{t.icon}</div>
              <div className="text-[10px] mt-0.5">{t.label}</div>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
