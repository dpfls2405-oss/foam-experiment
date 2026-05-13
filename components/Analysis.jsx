'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Scatter } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

const ZONE_LABELS = ['좌상', '상', '우상', '좌중', '중앙', '우중', '좌하', '하', '우하'];
const SEV_LABELS = ['없음', '경미', '보통', '심각'];
const COLORS = ['#534AB7', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#EF9F27', '#639922', '#E24B4A'];

export default function Analysis({ runs, factors, molds, boilers }) {
  const [allSpecs, setAllSpecs] = useState([]);
  const [fixedMap, setFixedMap] = useState({});
  const [view, setView] = useState('history');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAllData(); }, [runs]);

  async function loadAllData() {
    setLoading(true);
    const [specRes, fixRes] = await Promise.all([
      supabase.from('exp_specimens').select('*').order('specimen_no'),
      supabase.from('exp_run_fixed_factors').select('*'),
    ]);
    if (specRes.data) setAllSpecs(specRes.data);
    if (fixRes.data) {
      const map = {};
      fixRes.data.forEach(ff => {
        if (!map[ff.run_id]) map[ff.run_id] = [];
        map[ff.run_id].push(ff);
      });
      setFixedMap(map);
    }
    setLoading(false);
  }

  function getRunSpecs(runId) { return allSpecs.filter(s => s.run_id === runId); }

  function getSpecSeveritySum(spec) {
    const sev = spec.defect_severity || {};
    return Object.values(sev).reduce((a, b) => a + b, 0);
  }

  function getSpecMaxSeverity(spec) {
    const sev = spec.defect_severity || {};
    const vals = Object.values(sev);
    return vals.length ? Math.max(...vals) : 0;
  }

  function getRunDefectRate(run) {
    const specs = getRunSpecs(run.id);
    if (!specs.length) return 0;
    const defects = specs.filter(s => getSpecMaxSeverity(s) > 0).length;
    return Math.round(defects / specs.length * 100);
  }

  function getRunSeveritySum(run) {
    return getRunSpecs(run.id).reduce((a, s) => a + getSpecSeveritySum(s), 0);
  }

  const views = [
    { id: 'history', label: '히스토리' },
    { id: 'scatter', label: '산포도' },
    { id: 'zone', label: '구역분석' },
    { id: 'factor', label: '인자비교' },
  ];

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">로딩 중...</div>;

  const totalDefects = allSpecs.filter(s => getSpecMaxSeverity(s) > 0).length;
  const totalSeverity = allSpecs.reduce((a, s) => a + getSpecSeveritySum(s), 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {views.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`flex-1 py-2 text-xs rounded-md transition-colors ${
              view === v.id ? 'bg-white text-gray-800 font-medium shadow-sm' : 'text-gray-400'
            }`}>{v.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="metric-card">
          <div className="text-lg font-semibold">{runs.length}</div>
          <div className="text-[10px] text-gray-400">총 Run</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold">{allSpecs.length}</div>
          <div className="text-[10px] text-gray-400">총 시편</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold text-red-500">{totalDefects}</div>
          <div className="text-[10px] text-gray-400">미충진 시편</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold text-red-500">{totalSeverity}</div>
          <div className="text-[10px] text-gray-400">심각도 총합</div>
        </div>
      </div>

      {/* 히스토리 */}
      {view === 'history' && (
        <div className="space-y-3">
          {runs.map(run => {
            const specs = getRunSpecs(run.id);
            const defectRate = getRunDefectRate(run);
            const sevSum = getRunSeveritySum(run);
            const fixed = fixedMap[run.id] || [];
            return (
              <div key={run.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-success">{run.phase}</span>
                      <span className="text-sm font-medium">{run.mold_name}</span>
                      {run.is_control && <span className="badge badge-danger">대조군</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(run.created_at).toLocaleDateString('ko-KR')}
                      {run.boiler_no && ` · ${run.boiler_no}번 보일러`}
                      {run.temp_upper && ` · 상 ${run.temp_upper}℃`}
                      {run.temp_lower && ` / 하 ${run.temp_lower}℃`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-semibold ${defectRate > 50 ? 'text-red-500' : defectRate > 20 ? 'text-amber-500' : 'text-green-500'}`}>
                      {defectRate}%
                    </div>
                    <div className="text-[10px] text-gray-400">미충진률</div>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap mb-2">
                  {run.active_factor_name && (
                    <span className="badge badge-primary">🧪 {run.active_factor_name}: {run.active_factor_value}</span>
                  )}
                  {fixed.map(ff => (
                    <span key={ff.id} className="badge badge-lock">🔒 {ff.factor_name}: {ff.fixed_value}</span>
                  ))}
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>시편 {specs.length}개</span>
                  <span>미충진 {specs.filter(s => getSpecMaxSeverity(s) > 0).length}개</span>
                  <span>심각도합 {sevSum}</span>
                </div>
                {run.photo_memo && (
                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">💬 {run.photo_memo}</div>
                )}
              </div>
            );
          })}
          {runs.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">실험 데이터가 없습니다</div>}
        </div>
      )}

      {/* 산포도 - 온도 vs 미충진률 */}
      {view === 'scatter' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">금형온도(상) × 미충진률</h3>
            <div style={{ height: 260 }}>
              <Scatter
                data={{
                  datasets: runs.filter(r => r.temp_upper).map((run, i) => ({
                    label: `${run.mold_name} (${run.active_factor_value || '대조군'})`,
                    data: [{ x: run.temp_upper, y: getRunDefectRate(run) }],
                    backgroundColor: COLORS[i % COLORS.length] + '99',
                    borderColor: COLORS[i % COLORS.length],
                    pointRadius: 8,
                  })),
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
                  scales: {
                    x: { type: 'linear', title: { display: true, text: '금형온도 상 (℃)', font: { size: 11 } }, ticks: { callback: v => v + '℃' } },
                    y: { type: 'linear', title: { display: true, text: '미충진률 (%)', font: { size: 11 } }, min: 0, ticks: { callback: v => v + '%' } },
                  },
                }}
              />
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">금형온도(하) × 미충진률</h3>
            <div style={{ height: 260 }}>
              <Scatter
                data={{
                  datasets: runs.filter(r => r.temp_lower).map((run, i) => ({
                    label: `${run.mold_name} (${run.active_factor_value || '대조군'})`,
                    data: [{ x: run.temp_lower, y: getRunDefectRate(run) }],
                    backgroundColor: COLORS[i % COLORS.length] + '99',
                    borderColor: COLORS[i % COLORS.length],
                    pointRadius: 8,
                  })),
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
                  scales: {
                    x: { type: 'linear', title: { display: true, text: '금형온도 하 (℃)', font: { size: 11 } }, ticks: { callback: v => v + '℃' } },
                    y: { type: 'linear', title: { display: true, text: '미충진률 (%)', font: { size: 11 } }, min: 0, ticks: { callback: v => v + '%' } },
                  },
                }}
              />
            </div>
          </div>

          {/* 심각도 분포 */}
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">심각도 분포</h3>
            <div style={{ height: 200 }}>
              {(() => {
                const counts = [0, 0, 0, 0];
                allSpecs.forEach(s => { counts[getSpecMaxSeverity(s)]++; });
                return (
                  <Bar
                    data={{
                      labels: SEV_LABELS,
                      datasets: [{ data: counts, backgroundColor: ['#d1fae5', '#FEF3C7', '#FED7AA', '#FECACA'], borderColor: ['#059669', '#D97706', '#EA580C', '#DC2626'], borderWidth: 1, borderRadius: 4, barPercentage: 0.6 }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                    }}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 구역 분석 - 심각도 합산 히트맵 */}
      {view === 'zone' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">구역별 심각도 합산 (전체 Run)</h3>
            {(() => {
              const zoneSums = new Array(9).fill(0);
              allSpecs.forEach(s => {
                const sev = s.defect_severity || {};
                Object.entries(sev).forEach(([z, v]) => { zoneSums[Number(z)] += v; });
              });
              const maxSum = Math.max(1, ...zoneSums);
              return (
                <>
                  <div className="grid grid-cols-3 gap-2 w-52 mx-auto">
                    {ZONE_LABELS.map((label, i) => {
                      const sum = zoneSums[i];
                      const intensity = sum / maxSum;
                      const bg = sum === 0
                        ? '#d1fae5'
                        : `rgba(220, 38, 38, ${0.12 + intensity * 0.68})`;
                      const textColor = sum === 0 ? '#065f46' : intensity > 0.5 ? '#fff' : '#991b1b';
                      return (
                        <div key={i} className="aspect-square flex flex-col items-center justify-center rounded-lg"
                          style={{ background: bg, color: textColor }}>
                          <div className="text-xs">{label}</div>
                          <div className="text-xl font-semibold">{sum}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-4 mt-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded" style={{ background: '#d1fae5' }}></span> 0
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded" style={{ background: 'rgba(220,38,38,0.25)' }}></span> 낮음
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded" style={{ background: 'rgba(220,38,38,0.8)' }}></span> 높음
                    </span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Run별 비교 */}
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">Run별 구역 심각도</h3>
            <div className="space-y-3">
              {runs.map(run => {
                const specs = getRunSpecs(run.id);
                const zoneSums = new Array(9).fill(0);
                specs.forEach(s => {
                  const sev = s.defect_severity || {};
                  Object.entries(sev).forEach(([z, v]) => { zoneSums[Number(z)] += v; });
                });
                const maxS = Math.max(1, ...zoneSums);
                return (
                  <div key={run.id}>
                    <div className="text-xs text-gray-500 mb-1">
                      {run.mold_name} · {run.active_factor_name}: {run.active_factor_value}
                      {run.memo && ` · ${run.memo}`}
                    </div>
                    <div className="grid grid-cols-9 gap-1">
                      {ZONE_LABELS.map((label, i) => {
                        const s = zoneSums[i];
                        const bg = s === 0 ? '#f3f4f6' : `rgba(220,38,38,${0.15 + (s / maxS) * 0.65})`;
                        return (
                          <div key={i} className="text-center py-1.5 rounded text-[10px]"
                            style={{ background: bg, color: s > 0 ? (s / maxS > 0.5 ? '#fff' : '#991b1b') : '#9ca3af' }}
                            title={`${label}: ${s}`}>
                            {s || '·'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 인자 비교 */}
      {view === 'factor' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">실험 변수값별 미충진률</h3>
            <div style={{ height: 280 }}>
              {(() => {
                const grouped = {};
                runs.forEach(run => {
                  const key = run.active_factor_name
                    ? `${run.active_factor_name}: ${run.active_factor_value}`
                    : '대조군';
                  grouped[key] = { rate: getRunDefectRate(run), sevSum: getRunSeveritySum(run), count: getRunSpecs(run.id).length };
                });
                const labels = Object.keys(grouped);
                const data = labels.map(k => grouped[k].rate);
                const bgColors = data.map(v => v > 50 ? '#FECACA' : v > 20 ? '#FED7AA' : '#d1fae5');
                const borderColors = data.map(v => v > 50 ? '#DC2626' : v > 20 ? '#EA580C' : '#059669');
                return (
                  <Bar
                    data={{
                      labels,
                      datasets: [{ data, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 1, borderRadius: 4, barPercentage: 0.6 }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      indexAxis: 'y',
                      plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => `미충진률 ${ctx.raw}% · 심각도합 ${grouped[ctx.label].sevSum} (${grouped[ctx.label].count}개)` } },
                      },
                      scales: {
                        x: { min: 0, max: 100, title: { display: true, text: '미충진률 (%)', font: { size: 11 } }, ticks: { callback: v => v + '%' } },
                        y: { ticks: { font: { size: 11 } } },
                      },
                    }}
                  />
                );
              })()}
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">Run별 심각도 총합</h3>
            <div style={{ height: 220 }}>
              <Bar
                data={{
                  labels: runs.map(r => r.memo || `${r.mold_name} ${r.active_factor_value || ''}`),
                  datasets: [{
                    data: runs.map(r => getRunSeveritySum(r)),
                    backgroundColor: runs.map((_, i) => COLORS[i % COLORS.length] + '99'),
                    borderColor: runs.map((_, i) => COLORS[i % COLORS.length]),
                    borderWidth: 1, borderRadius: 4, barPercentage: 0.6,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { beginAtZero: true, title: { display: true, text: '심각도 총합', font: { size: 11 } } },
                    x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
