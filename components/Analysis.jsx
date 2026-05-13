'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Scatter, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

const ZONE_LABELS = ['좌상', '상', '우상', '좌중', '중앙', '우중', '좌하', '하', '우하'];
const COLORS = ['#534AB7', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#EF9F27', '#639922', '#E24B4A'];

export default function Analysis({ runs, factors, molds, boilers }) {
  const [allSpecs, setAllSpecs] = useState([]);
  const [fixedMap, setFixedMap] = useState({});
  const [view, setView] = useState('history');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [runs]);

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

  function getRunSpecs(runId) {
    return allSpecs.filter(s => s.run_id === runId);
  }

  function calcFillRate(weight, refWeight) {
    if (!weight || !refWeight) return null;
    return parseFloat((weight / refWeight * 100).toFixed(1));
  }

  const views = [
    { id: 'history', label: '히스토리' },
    { id: 'scatter', label: '산포도' },
    { id: 'zone', label: '구역분석' },
    { id: 'factor', label: '인자비교' },
  ];

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">데이터 로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 서브탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {views.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex-1 py-2 text-xs rounded-md transition-colors ${
              view === v.id ? 'bg-white text-gray-800 font-medium shadow-sm' : 'text-gray-400'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* 전체 요약 카드 */}
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
          <div className="text-lg font-semibold">
            {allSpecs.length > 0 && runs.length > 0
              ? (allSpecs.filter(s => s.weight).reduce((a, s) => {
                  const run = runs.find(r => r.id === s.run_id);
                  return a + (s.weight / (run?.ref_weight || 580) * 100);
                }, 0) / allSpecs.filter(s => s.weight).length).toFixed(1)
              : '0'}%
          </div>
          <div className="text-[10px] text-gray-400">평균 충진율</div>
        </div>
        <div className="metric-card">
          <div className="text-lg font-semibold text-red-500">
            {allSpecs.filter(s => (s.defect_zones || []).length > 0).length}
          </div>
          <div className="text-[10px] text-gray-400">미충진 시편</div>
        </div>
      </div>

      {/* 히스토리 뷰 */}
      {view === 'history' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">실험 히스토리</h3>
          {runs.map((run, ri) => {
            const specs = getRunSpecs(run.id);
            const filled = specs.filter(s => s.weight);
            const avgFill = filled.length
              ? (filled.reduce((a, s) => a + s.weight / run.ref_weight * 100, 0) / filled.length).toFixed(1)
              : '—';
            const defects = specs.filter(s => (s.defect_zones || []).length > 0).length;
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
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-semibold ${
                      parseFloat(avgFill) >= 98 ? 'fill-ok' : parseFloat(avgFill) >= 95 ? 'fill-mid' : 'fill-low'
                    }`}>
                      {avgFill}%
                    </div>
                    <div className="text-[10px] text-gray-400">충진율</div>
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
                  <span>미충진 {defects}개</span>
                  {filled.length > 0 && (
                    <span>평균경도 {(specs.filter(s => s.hardness).reduce((a, s) => a + s.hardness, 0) / specs.filter(s => s.hardness).length || 0).toFixed(1)}</span>
                  )}
                </div>
              </div>
            );
          })}
          {runs.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">실험 데이터가 없습니다</div>
          )}
        </div>
      )}

      {/* 산포도 뷰 */}
      {view === 'scatter' && (
        <div className="space-y-4">
          {/* 온도(상) vs 충진율 */}
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">금형온도(상) × 충진율</h3>
            <div style={{ height: 260 }}>
              <Scatter
                data={{
                  datasets: runs.map((run, i) => {
                    const specs = getRunSpecs(run.id).filter(s => s.weight && s.temp_upper);
                    return {
                      label: `${run.mold_name} (${run.active_factor_value || '대조군'})`,
                      data: specs.map(s => ({
                        x: s.temp_upper,
                        y: calcFillRate(s.weight, run.ref_weight),
                      })),
                      backgroundColor: COLORS[i % COLORS.length] + '99',
                      borderColor: COLORS[i % COLORS.length],
                      pointRadius: 5,
                    };
                  }),
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
                  scales: {
                    x: { title: { display: true, text: '금형온도 상 (℃)', font: { size: 11 } } },
                    y: { title: { display: true, text: '충진율 (%)', font: { size: 11 } }, min: 85, max: 105 },
                  },
                }}
              />
            </div>
          </div>

          {/* 온도(하) vs 충진율 */}
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">금형온도(하) × 충진율</h3>
            <div style={{ height: 260 }}>
              <Scatter
                data={{
                  datasets: runs.map((run, i) => {
                    const specs = getRunSpecs(run.id).filter(s => s.weight && s.temp_lower);
                    return {
                      label: `${run.mold_name} (${run.active_factor_value || '대조군'})`,
                      data: specs.map(s => ({
                        x: s.temp_lower,
                        y: calcFillRate(s.weight, run.ref_weight),
                      })),
                      backgroundColor: COLORS[i % COLORS.length] + '99',
                      borderColor: COLORS[i % COLORS.length],
                      pointRadius: 5,
                    };
                  }),
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
                  scales: {
                    x: { title: { display: true, text: '금형온도 하 (℃)', font: { size: 11 } } },
                    y: { title: { display: true, text: '충진율 (%)', font: { size: 11 } }, min: 85, max: 105 },
                  },
                }}
              />
            </div>
          </div>

          {/* 충진율 분포 히스토그램 */}
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">충진율 분포</h3>
            <div style={{ height: 220 }}>
              {(() => {
                const bins = [90, 92, 94, 96, 98, 100, 102];
                const binLabels = bins.slice(0, -1).map((b, i) => `${b}-${bins[i + 1]}%`);
                const counts = binLabels.map(() => 0);
                allSpecs.forEach(s => {
                  if (!s.weight) return;
                  const run = runs.find(r => r.id === s.run_id);
                  if (!run) return;
                  const fill = s.weight / run.ref_weight * 100;
                  for (let i = 0; i < bins.length - 1; i++) {
                    if (fill >= bins[i] && fill < bins[i + 1]) { counts[i]++; break; }
                  }
                });
                return (
                  <Bar
                    data={{
                      labels: binLabels,
                      datasets: [{ data: counts, backgroundColor: '#534AB799', borderColor: '#534AB7', borderWidth: 1, borderRadius: 3 }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, title: { display: true, text: '시편 수', font: { size: 11 } }, ticks: { stepSize: 1 } },
                        x: { ticks: { font: { size: 10 } } },
                      },
                    }}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 구역 분석 뷰 */}
      {view === 'zone' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">구역별 미충진 빈도 (전체 Run 누적)</h3>
            {(() => {
              const zoneCounts = new Array(9).fill(0);
              allSpecs.forEach(s => {
                (s.defect_zones || []).forEach(z => { zoneCounts[z]++; });
              });
              const maxCount = Math.max(1, ...zoneCounts);
              return (
                <div className="grid grid-cols-3 gap-2 w-52 mx-auto">
                  {ZONE_LABELS.map((label, i) => {
                    const count = zoneCounts[i];
                    const intensity = count / maxCount;
                    const bg = count === 0
                      ? '#E1F5EE'
                      : `rgba(226, 75, 74, ${0.15 + intensity * 0.65})`;
                    const textColor = count === 0 ? '#085041' : intensity > 0.5 ? '#fff' : '#791F1F';
                    return (
                      <div
                        key={i}
                        className="aspect-square flex flex-col items-center justify-center rounded-lg"
                        style={{ background: bg, color: textColor }}
                      >
                        <div className="text-xs">{label}</div>
                        <div className="text-lg font-semibold">{count}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div className="flex justify-center gap-4 mt-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ background: '#E1F5EE' }}></span> 0건
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ background: 'rgba(226,75,74,0.3)' }}></span> 적음
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ background: 'rgba(226,75,74,0.8)' }}></span> 많음
              </span>
            </div>
          </div>

          {/* Run별 구역 비교 */}
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">Run별 구역 히트맵 비교</h3>
            <div className="space-y-4">
              {runs.map(run => {
                const specs = getRunSpecs(run.id);
                const zoneCounts = new Array(9).fill(0);
                specs.forEach(s => { (s.defect_zones || []).forEach(z => { zoneCounts[z]++; }); });
                const maxC = Math.max(1, ...zoneCounts);
                return (
                  <div key={run.id}>
                    <div className="text-xs text-gray-500 mb-1">
                      {run.mold_name} · {run.active_factor_name}: {run.active_factor_value}
                    </div>
                    <div className="grid grid-cols-9 gap-1">
                      {ZONE_LABELS.map((label, i) => {
                        const c = zoneCounts[i];
                        const bg = c === 0 ? '#f3f4f6' : `rgba(226,75,74,${0.2 + (c / maxC) * 0.6})`;
                        return (
                          <div key={i} className="text-center py-1.5 rounded text-[10px]"
                            style={{ background: bg, color: c > 0 ? '#fff' : '#9ca3af' }}
                            title={`${label}: ${c}건`}
                          >
                            {c || '·'}
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

      {/* 인자 비교 뷰 */}
      {view === 'factor' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">실험 변수값별 평균 충진율 비교</h3>
            <div style={{ height: 280 }}>
              {(() => {
                const grouped = {};
                runs.forEach(run => {
                  const key = run.active_factor_name
                    ? `${run.active_factor_name}: ${run.active_factor_value}`
                    : '대조군';
                  const specs = getRunSpecs(run.id).filter(s => s.weight);
                  if (specs.length === 0) return;
                  const avgFill = specs.reduce((a, s) => a + s.weight / run.ref_weight * 100, 0) / specs.length;
                  grouped[key] = { avg: parseFloat(avgFill.toFixed(1)), count: specs.length };
                });
                const labels = Object.keys(grouped);
                const data = labels.map(k => grouped[k].avg);
                const bgColors = data.map(v => v >= 98 ? '#1D9E75' : v >= 95 ? '#EF9F27' : '#E24B4A');
                return (
                  <Bar
                    data={{
                      labels,
                      datasets: [{ data, backgroundColor: bgColors, borderRadius: 4, barPercentage: 0.6 }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      indexAxis: 'y',
                      plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => `${ctx.raw}% (${grouped[ctx.label].count}개)` } },
                      },
                      scales: {
                        x: { min: 85, max: 105, title: { display: true, text: '평균 충진율 (%)', font: { size: 11 } } },
                        y: { ticks: { font: { size: 11 } } },
                      },
                    }}
                  />
                );
              })()}
            </div>
          </div>

          {/* Run별 충진율 바 차트 */}
          <div className="card">
            <h3 className="text-xs text-gray-500 mb-3">Run별 평균 충진율</h3>
            <div style={{ height: 220 }}>
              <Bar
                data={{
                  labels: runs.map(r => r.memo || `${r.mold_name} ${r.active_factor_value || ''}`),
                  datasets: [{
                    data: runs.map(run => {
                      const specs = getRunSpecs(run.id).filter(s => s.weight);
                      if (!specs.length) return 0;
                      return parseFloat((specs.reduce((a, s) => a + s.weight / run.ref_weight * 100, 0) / specs.length).toFixed(1));
                    }),
                    backgroundColor: runs.map((_, i) => COLORS[i % COLORS.length] + '99'),
                    borderColor: runs.map((_, i) => COLORS[i % COLORS.length]),
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.6,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.raw + '%' } } },
                  scales: {
                    y: { min: 85, max: 105, ticks: { callback: v => v + '%' } },
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
