'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Scatter } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const ZONE_LABELS = ['좌상','상','우상','좌중','중앙','우중','좌하','하','우하'];
const COLORS = ['#534AB7','#1D9E75','#D85A30','#378ADD','#D4537E','#EF9F27','#639922','#E24B4A'];

function pz(v){if(!v||typeof v==='number')return{fill:v||0,surface:0};return{fill:v.fill||0,surface:v.surface||0};}
function specHasDefect(s){return Object.values(s.defect_severity||{}).some(v=>{const d=pz(v);return d.fill>0||d.surface>0;});}
function specFillSum(s){return Object.values(s.defect_severity||{}).reduce((a,v)=>a+pz(v).fill,0);}
function specHasSurface(s){return Object.values(s.defect_severity||{}).some(v=>pz(v).surface>0);}

export default function Analysis({ runs, factors, molds, boilers }) {
  const [allSpecs, setAllSpecs] = useState([]);
  const [fixedMap, setFixedMap] = useState({});
  const [allPhotos, setAllPhotos] = useState([]);
  const [view, setView] = useState('history');
  const [loading, setLoading] = useState(true);
  const [zoneRunId, setZoneRunId] = useState('all');

  useEffect(() => { loadAll(); }, [runs]);

  async function loadAll() {
    setLoading(true);
    const [sp, fx, ph] = await Promise.all([
      supabase.from('exp_specimens').select('*').order('specimen_no'),
      supabase.from('exp_run_fixed_factors').select('*'),
      supabase.from('exp_run_photos').select('*').order('created_at'),
    ]);
    if(sp.data) setAllSpecs(sp.data);
    if(fx.data){const m={};fx.data.forEach(f=>{if(!m[f.run_id])m[f.run_id]=[];m[f.run_id].push(f);});setFixedMap(m);}
    if(ph.data) setAllPhotos(ph.data);
    setLoading(false);
  }

  function gs(rid){return allSpecs.filter(s=>s.run_id===rid);}
  function gdr(run){const sp=gs(run.id);if(!sp.length)return 0;return Math.round(sp.filter(s=>specHasDefect(s)).length/sp.length*100);}
  function gfs(run){return gs(run.id).reduce((a,s)=>a+specFillSum(s),0);}
  function gsc(run){return gs(run.id).filter(s=>specHasSurface(s)).length;}

  function generateAnalysis() {
    if(runs.length<2) return ['실험 Run이 2개 이상 있어야 비교 분석이 가능합니다.'];
    const insights = [];
    const byFactor = {};
    runs.forEach(run => {
      if(!run.active_factor_name) return;
      if(!byFactor[run.active_factor_name]) byFactor[run.active_factor_name] = [];
      byFactor[run.active_factor_name].push({
        value: run.active_factor_value,
        defectRate: gdr(run),
        fillSum: gfs(run),
        surfCount: gsc(run),
        specCount: gs(run.id).length,
        tempUp: run.temp_upper,
        tempLo: run.temp_lower,
        memo: run.memo,
      });
    });

    Object.entries(byFactor).forEach(([factorName, entries]) => {
      if(entries.length < 2) return;
      const sorted = [...entries].sort((a,b) => a.defectRate - b.defectRate);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      if(best.defectRate !== worst.defectRate) {
        insights.push(`📊 ${factorName} 변경 효과: ${worst.value} → ${best.value}로 변경 시 불량률 ${worst.defectRate}% → ${best.defectRate}%로 ${worst.defectRate - best.defectRate}%p 개선`);
      }
      if(best.fillSum !== worst.fillSum) {
        insights.push(`🔍 ${factorName} ${best.value}일 때 미충진 심각도 총합이 가장 낮음 (${best.fillSum}) vs ${worst.value}일 때 ${worst.fillSum}`);
      }
      const surfEntries = entries.filter(e => e.surfCount > 0);
      if(surfEntries.length > 0) {
        const surfWorst = surfEntries.sort((a,b) => b.surfCount - a.surfCount)[0];
        insights.push(`🔵 ${factorName} ${surfWorst.value}에서 표면불량 ${surfWorst.surfCount}건 발생`);
      }
    });

    const zoneFillSums = new Array(9).fill(0);
    const zoneSurfCounts = new Array(9).fill(0);
    allSpecs.forEach(s => {
      Object.entries(s.defect_severity || {}).forEach(([z,v]) => {
        const d = pz(v);
        zoneFillSums[Number(z)] += d.fill;
        if(d.surface > 0) zoneSurfCounts[Number(z)]++;
      });
    });
    const totalFill = zoneFillSums.reduce((a,b) => a+b, 0);
    if(totalFill > 0) {
      const topZones = zoneFillSums.map((v,i) => ({zone: ZONE_LABELS[i], sum: v}))
        .filter(z => z.sum > 0).sort((a,b) => b.sum - a.sum).slice(0, 3);
      insights.push(`📍 미충진 집중 구역: ${topZones.map(z => `${z.zone}(${z.sum})`).join(', ')} — 금형 해당 부위 점검 필요`);
    }
    const totalSurf = zoneSurfCounts.reduce((a,b) => a+b, 0);
    if(totalSurf > 0) {
      const topSurf = zoneSurfCounts.map((v,i) => ({zone: ZONE_LABELS[i], count: v}))
        .filter(z => z.count > 0).sort((a,b) => b.count - a.count).slice(0, 3);
      insights.push(`🔵 표면불량 집중 구역: ${topSurf.map(z => `${z.zone}(${z.count}건)`).join(', ')}`);
    }

    const tempRuns = runs.filter(r => r.temp_upper);
    if(tempRuns.length >= 2) {
      const sortedByTemp = [...tempRuns].sort((a,b) => a.temp_upper - b.temp_upper);
      const lowTemp = sortedByTemp[0];
      const highTemp = sortedByTemp[sortedByTemp.length - 1];
      const lowRate = gdr(lowTemp);
      const highRate = gdr(highTemp);
      if(lowRate !== highRate) {
        insights.push(`🌡 금형온도(상) ${lowTemp.temp_upper}℃(불량${lowRate}%) vs ${highTemp.temp_upper}℃(불량${highRate}%) — ${lowRate < highRate ? '낮은 온도' : '높은 온도'}에서 불량률 낮음`);
      }
    }

    if(insights.length === 0) insights.push('현재 데이터로는 유의미한 차이가 관찰되지 않습니다. 실험 데이터가 더 쌓이면 분석이 구체화됩니다.');
    return insights;
  }

  const views = [{id:'history',label:'히스토리'},{id:'scatter',label:'산포도'},{id:'zone',label:'구역분석'},{id:'factor',label:'인자비교'},{id:'photos',label:'사진'},{id:'ai',label:'분석코멘트'}];

  if(loading) return <div className="text-center py-12 text-gray-400 text-sm">로딩중...</div>;

  const tfd=allSpecs.filter(s=>specFillSum(s)>0).length;
  const tsd=allSpecs.filter(s=>specHasSurface(s)).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
        {views.map(v=>(<button key={v.id} onClick={()=>setView(v.id)}
          className={`flex-1 py-2 text-xs rounded-md transition-colors min-w-[60px] ${view===v.id?'bg-white text-gray-800 font-medium shadow-sm':'text-gray-400'}`}>{v.label}</button>))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="metric-card"><div className="text-lg font-semibold">{runs.length}</div><div className="text-[10px] text-gray-400">총Run</div></div>
        <div className="metric-card"><div className="text-lg font-semibold">{allSpecs.length}</div><div className="text-[10px] text-gray-400">총시편</div></div>
        <div className="metric-card"><div className="text-lg font-semibold text-red-500">{tfd}</div><div className="text-[10px] text-gray-400">미충진</div></div>
        <div className="metric-card"><div className="text-lg font-semibold text-blue-500">{tsd}</div><div className="text-[10px] text-gray-400">표면불량</div></div>
      </div>

      {view==='history'&&(<div className="space-y-3">{runs.map(run=>{const sp=gs(run.id);const dr=gdr(run);const fs=gfs(run);const sc=gsc(run);const fx=fixedMap[run.id]||[];
        const rPhotos=allPhotos.filter(p=>p.run_id===run.id);
        return(<div key={run.id} className="card">
          <div className="flex justify-between items-start mb-2"><div>
            <div className="flex items-center gap-2"><span className="badge badge-success">{run.phase}</span><span className="text-sm font-medium">{run.mold_name}</span>
              {run.is_control&&<span className="badge badge-danger">대조군</span>}</div>
            <div className="text-xs text-gray-400 mt-1">{new Date(run.created_at).toLocaleDateString('ko-KR')}{run.temp_upper&&` ·상${run.temp_upper}℃`}{run.temp_lower&&`/하${run.temp_lower}℃`}</div>
          </div><div className="text-right"><div className={`text-xl font-semibold ${dr>50?'text-red-500':dr>20?'text-amber-500':'text-green-500'}`}>{dr}%</div>
            <div className="text-[10px] text-gray-400">불량률</div></div></div>
          <div className="flex gap-1 flex-wrap mb-2">{run.active_factor_name&&<span className="badge badge-primary">🧪{run.active_factor_name}:{run.active_factor_value}</span>}
            {fx.map(f=>(<span key={f.id} className="badge badge-lock">🔒{f.factor_name}:{f.fixed_value}</span>))}</div>
          <div className="flex gap-3 text-xs text-gray-400"><span>시편{sp.length}</span>
            <span className="text-red-400">미충진{sp.filter(s=>specFillSum(s)>0).length}(합{fs})</span>
            <span className="text-blue-400">표면{sc}</span><span>사진{rPhotos.length}장</span></div>
          {run.photo_memo&&<div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">💬{run.photo_memo}</div>}
        </div>);})}{runs.length===0&&<div className="text-center py-8 text-gray-400 text-sm">데이터없음</div>}</div>)}

      {view==='scatter'&&(<div className="space-y-4">
        <div className="card"><h3 className="text-xs text-gray-500 mb-3">금형온도(상)×불량률</h3><div style={{height:260}}>
          <Scatter data={{datasets:runs.filter(r=>r.temp_upper).map((r,i)=>({label:`${r.mold_name}(${r.active_factor_value||'대조군'})`,
            data:[{x:r.temp_upper,y:gdr(r)}],backgroundColor:COLORS[i%COLORS.length]+'99',borderColor:COLORS[i%COLORS.length],pointRadius:8}))}}
            options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},
            scales:{x:{type:'linear',title:{display:true,text:'금형온도상(℃)',font:{size:11}},ticks:{callback:v=>v+'℃'}},
            y:{type:'linear',min:0,title:{display:true,text:'불량률(%)',font:{size:11}},ticks:{callback:v=>v+'%'}}}}}/></div></div>
        <div className="card"><h3 className="text-xs text-gray-500 mb-3">금형온도(하)×불량률</h3><div style={{height:260}}>
          <Scatter data={{datasets:runs.filter(r=>r.temp_lower).map((r,i)=>({label:`${r.mold_name}(${r.active_factor_value||'대조군'})`,
            data:[{x:r.temp_lower,y:gdr(r)}],backgroundColor:COLORS[i%COLORS.length]+'99',borderColor:COLORS[i%COLORS.length],pointRadius:8}))}}
            options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},
            scales:{x:{type:'linear',title:{display:true,text:'금형온도하(℃)',font:{size:11}},ticks:{callback:v=>v+'℃'}},
            y:{type:'linear',min:0,title:{display:true,text:'불량률(%)',font:{size:11}},ticks:{callback:v=>v+'%'}}}}}/></div></div>
      </div>)}

      {view==='zone'&&(<div className="space-y-4">
        {/* Run 선택 필터 */}
        <div className="card">
          <p className="text-xs text-gray-400 mb-2">실험 Run 선택</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={()=>setZoneRunId('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${zoneRunId==='all'?'bg-gray-800 text-white border-gray-800':'bg-white text-gray-600 border-gray-200'}`}>
              전체
            </button>
            {runs.map((r,i)=>(
              <button key={r.id} onClick={()=>setZoneRunId(r.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${zoneRunId===r.id?'text-white border-transparent':'bg-white text-gray-600 border-gray-200'}`}
                style={zoneRunId===r.id?{backgroundColor:COLORS[i%COLORS.length],borderColor:COLORS[i%COLORS.length]}:{}}>
                Run{i+1} {r.memo||r.mold_name||''} {r.active_factor_value?`(${r.active_factor_value})`:''}
              </button>
            ))}
          </div>
          {zoneRunId!=='all'&&(()=>{const r=runs.find(x=>x.id===zoneRunId);if(!r)return null;const sp=gs(r.id);
            return(<div className="mt-2 text-xs text-gray-500 flex gap-3">
              <span>시편 {sp.length}개</span>
              <span>불량률 {gdr(r)}%</span>
              <span>미충진 합산 {gfs(r)}</span>
              <span>표면불량 {gsc(r)}건</span>
            </div>);})()}
        </div>
        <div className="card"><h3 className="text-xs text-gray-500 mb-3">구역별 미충진 심각도 합산</h3>
          {(()=>{
            const specs=zoneRunId==='all'?allSpecs:allSpecs.filter(s=>s.run_id===zoneRunId);
            const zs=new Array(9).fill(0);specs.forEach(s=>{Object.entries(s.defect_severity||{}).forEach(([z,v])=>{zs[Number(z)]+=pz(v).fill;});});
            const mx=Math.max(1,...zs);return(<div className="grid grid-cols-3 gap-2 w-52 mx-auto">{ZONE_LABELS.map((l,i)=>{const s=zs[i];const it=s/mx;
              return(<div key={i} className="aspect-square flex flex-col items-center justify-center rounded-lg"
                style={{background:s===0?'#d1fae5':`rgba(220,38,38,${0.12+it*0.68})`,color:s===0?'#065f46':it>0.5?'#fff':'#991b1b'}}>
                <div className="text-xs">{l}</div><div className="text-xl font-semibold">{s}</div></div>);})}</div>);})()}</div>
        <div className="card"><h3 className="text-xs text-gray-500 mb-3">구역별 표면불량 빈도</h3>
          {(()=>{
            const specs=zoneRunId==='all'?allSpecs:allSpecs.filter(s=>s.run_id===zoneRunId);
            const zc=new Array(9).fill(0);specs.forEach(s=>{Object.entries(s.defect_severity||{}).forEach(([z,v])=>{if(pz(v).surface>0)zc[Number(z)]++;});});
            const mx=Math.max(1,...zc);return(<div className="grid grid-cols-3 gap-2 w-52 mx-auto">{ZONE_LABELS.map((l,i)=>{const c=zc[i];const it=c/mx;
              return(<div key={i} className="aspect-square flex flex-col items-center justify-center rounded-lg"
                style={{background:c===0?'#eff6ff':`rgba(59,130,246,${0.12+it*0.68})`,color:c===0?'#3b82f6':it>0.5?'#fff':'#1e40af'}}>
                <div className="text-xs">{l}</div><div className="text-xl font-semibold">{c}</div></div>);})}</div>);})()}</div>
      </div>)}

      {view==='factor'&&(<div className="space-y-4">
        <div className="card"><h3 className="text-xs text-gray-500 mb-3">변수값별 불량률</h3><div style={{height:280}}>
          {(()=>{const g={};runs.forEach(r=>{const k=r.active_factor_name?`${r.active_factor_name}:${r.active_factor_value}`:'대조군';
            g[k]={rate:gdr(r),fs:gfs(r),sc:gsc(r),cnt:gs(r.id).length};});const lb=Object.keys(g);const dt=lb.map(k=>g[k].rate);
          return(<Bar data={{labels:lb,datasets:[{data:dt,backgroundColor:dt.map(v=>v>50?'#FECACA':v>20?'#FED7AA':'#d1fae5'),
            borderColor:dt.map(v=>v>50?'#DC2626':v>20?'#EA580C':'#059669'),borderWidth:1,borderRadius:4,barPercentage:0.6}]}}
            options={{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false},
            tooltip:{callbacks:{label:c=>`불량${c.raw}% ·미충진합${g[c.label].fs} ·표면${g[c.label].sc}건`}}},
            scales:{x:{min:0,max:100,ticks:{callback:v=>v+'%'}},y:{ticks:{font:{size:11}}}}}}/>);})()}</div></div>
        <div className="card"><h3 className="text-xs text-gray-500 mb-3">Run별 단품 평균 미충진·표면불량</h3><div style={{height:220}}>
          <Bar data={{labels:runs.map(r=>r.memo||`${r.mold_name}${r.active_factor_value||''}`),
            datasets:[{label:'평균 미충진 심각도',data:runs.map(r=>{const n=gs(r.id).length;return n?+(gfs(r)/n).toFixed(1):0;}),backgroundColor:'#FECACA',borderColor:'#DC2626',borderWidth:1,borderRadius:4},
              {label:'평균 표면불량',data:runs.map(r=>{const n=gs(r.id).length;return n?+(gsc(r)/n).toFixed(2):0;}),backgroundColor:'#DBEAFE',borderColor:'#3B82F6',borderWidth:1,borderRadius:4}]}}
            options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10}}},
            tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.raw} (시편${gs(runs[c.dataIndex].id).length}개)`}}},
            scales:{y:{beginAtZero:true},x:{ticks:{font:{size:10},maxRotation:45}}}}}/></div></div>
      </div>)}

      {/* 사진 갤러리 */}
      {view==='photos'&&(<div className="space-y-4">
        {runs.map(run=>{const rPhotos=allPhotos.filter(p=>p.run_id===run.id);if(!rPhotos.length)return null;
          return(<div key={run.id} className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge badge-success">{run.phase}</span>
              <span className="text-sm font-medium">{run.mold_name}</span>
              <span className="text-xs text-gray-400">{run.active_factor_name}:{run.active_factor_value}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {rPhotos.map(p=>(<div key={p.id} className="relative">
                <img src={p.photo_url} alt="" className="w-full h-32 object-cover rounded-lg"/>
                {p.memo&&<div className="mt-1 text-[10px] text-gray-500 bg-gray-50 rounded px-2 py-1">💬{p.memo}</div>}
              </div>))}
            </div>
          </div>);}).filter(Boolean)}
        {allPhotos.length===0&&<div className="text-center py-12 text-gray-400 text-sm">등록된 사진이 없습니다</div>}
      </div>)}

      {/* 자동 분석 코멘트 */}
      {view==='ai'&&(<div className="space-y-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤖</span>
            <h3 className="text-sm font-semibold text-gray-700">데이터 기반 분석</h3>
          </div>
          <div className="space-y-2">
            {generateAnalysis().map((insight, i) => (
              <div key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {insight}
              </div>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-gray-400">
            실험 데이터가 쌓일수록 분석이 정밀해집니다. 동일 변수에 대해 2개 이상의 Run이 있어야 비교 분석이 가능합니다.
          </div>
        </div>
      </div>)}
    </div>
  );
}
