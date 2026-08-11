'use client';
import { useState, useEffect } from 'react';
import { compressImage } from '@/lib/supabase';

const ZONE_LABELS = ['좌상','상','우상','좌중','중앙','우중','좌하','하','우하'];
const FILL_LABELS = ['없음','경미','보통','심각'];
const FILL_COLORS = ['#f3f4f6','#FEF3C7','#FED7AA','#FECACA'];
const FILL_BORDERS = ['#d1d5db','#D97706','#EA580C','#DC2626'];
const FILL_TEXT = ['#6b7280','#92400E','#9A3412','#991B1B'];

export default function LotInput({ runId, runs, factors, onRefresh, onSelectRun }) {
  const [specimens, setSpecimens] = useState([]);
  const [fixedFactors, setFixedFactors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [zoneEditIdx, setZoneEditIdx] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [tempUpper, setTempUpper] = useState('');
  const [tempLower, setTempLower] = useState('');
  const [photos, setPhotos] = useState([]);
  const [newPhotoMemo, setNewPhotoMemo] = useState('');

  const run = runs.find(r => r.id === runId);

  useEffect(() => {
    if (runId) { loadSpecimens(); loadFixed(); loadPhotos();
      if (run) { setTempUpper(run.temp_upper||''); setTempLower(run.temp_lower||''); }
    }
  }, [runId]);

  async function loadSpecimens() {
    const data = await fetch(`/api/specimens?run_id=${runId}`).then(r=>r.json());
    if (Array.isArray(data)&&data.length) setSpecimens(data.map(s=>({...s,defect_severity:s.defect_severity||{}})));
    else setSpecimens(Array.from({length:10},(_,i)=>({run_id:runId,specimen_no:i+1,weight:null,hardness:null,defect_severity:{},memo:''})));
  }
  async function loadFixed() {
    const data = await fetch(`/api/run-fixed-factors?run_id=${runId}`).then(r=>r.json());
    setFixedFactors(Array.isArray(data)?data:[]);
  }
  async function loadPhotos() {
    const data = await fetch(`/api/run-photos?run_id=${runId}`).then(r=>r.json());
    setPhotos(Array.isArray(data)?data:[]);
  }

  function updateSpec(idx,field,value) {
    setSpecimens(prev=>{const n=[...prev];n[idx]={...n[idx],[field]:value===''?null:Number(value)};return n;});
  }
  function getZoneData(si,zi) {
    const v=(specimens[si]?.defect_severity||{})[zi];
    if(!v||typeof v==='number') return {fill:typeof v==='number'?v:0,surface:0};
    return {fill:v.fill||0,surface:v.surface||0};
  }
  function setZoneDefect(si,zi,field,value) {
    setSpecimens(prev=>{const n=[...prev];const sev={...(n[si].defect_severity||{})};
    const cur=typeof sev[zi]==='object'?{...sev[zi]}:{fill:0,surface:0};
    cur[field]=value;if(cur.fill===0&&cur.surface===0)delete sev[zi];else sev[zi]=cur;
    n[si]={...n[si],defect_severity:sev};return n;});
  }
  function hasAnyDefect(s){return Object.keys(s.defect_severity||{}).length>0;}
  function getDefectSummary(s){let mf=0,hs=false;Object.values(s.defect_severity||{}).forEach(v=>{
    const d=typeof v==='object'?v:{fill:v||0,surface:0};if(d.fill>mf)mf=d.fill;if(d.surface>0)hs=true;});return{maxFill:mf,hasSurface:hs};}
  function getZoneColor(si,zi){const d=getZoneData(si,zi);
    if(d.fill===0&&d.surface===0)return{bg:'#f9fafb',border:'#e5e7eb',text:'#9ca3af'};
    if(d.surface>0&&d.fill>0)return{bg:'#EDE9FE',border:'#7C3AED',text:'#5B21B6'};
    if(d.surface>0)return{bg:'#DBEAFE',border:'#3B82F6',text:'#1E40AF'};
    return{bg:FILL_COLORS[d.fill],border:FILL_BORDERS[d.fill],text:FILL_TEXT[d.fill]};}

  async function handlePhotoUpload(e) {
    const file=e.target.files?.[0]; if(!file||!runId)return;
    const body=await compressImage(file);
    const fd=new FormData();
    fd.append('file',body,'photo.jpg');
    fd.append('run_id',String(runId));
    const up=await fetch('/api/upload',{method:'POST',body:fd}).then(r=>r.json());
    if(!up.ok){alert('업로드 실패');return;}
    await fetch('/api/run-photos',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({run_id:runId,path:up.path,memo:newPhotoMemo||null})});
    setNewPhotoMemo('');loadPhotos();e.target.value='';
  }
  async function deletePhoto(photoId) {
    if(!confirm('사진을 삭제하시겠습니까?'))return;
    await fetch(`/api/run-photos?id=${photoId}`,{method:'DELETE'});
    loadPhotos();
  }
  async function updatePhotoMemo(photoId,memo) {
    await fetch('/api/run-photos',{method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:photoId,memo:memo||null})});
  }

  async function saveAll() {
    if(!runId)return; setSaving(true);
    try {
      const rows=specimens.filter(s=>s.weight!==null||s.hardness!==null||Object.keys(s.defect_severity||{}).length>0)
        .map(s=>({specimen_no:s.specimen_no,weight:s.weight,hardness:s.hardness,
          defect_severity:s.defect_severity||{},defect_zones:Object.keys(s.defect_severity||{}).map(Number),memo:s.memo||''}));
      const res=await fetch('/api/lot',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({runId,tempUpper:tempUpper?Number(tempUpper):null,tempLower:tempLower?Number(tempLower):null,specimens:rows})});
      const data=await res.json();
      if(!data.ok)throw new Error(data.error||'저장 실패');
      alert('저장 완료');onRefresh();
    }catch(err){alert('저장 실패: '+err.message);}finally{setSaving(false);}
  }
  async function deleteRun() {
    if(!confirm('삭제하시겠습니까?'))return;
    await fetch(`/api/runs?id=${runId}`,{method:'DELETE'});
    onSelectRun(null);onRefresh();
  }

  if(!runId||!run) return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">로트 입력</h2>
      <div className="card text-center py-12"><div className="text-3xl mb-2">📋</div>
        <p className="text-sm text-gray-400 mb-4">실험 Run을 선택하세요</p>
        {runs.map(r=>(<button key={r.id} onClick={()=>onSelectRun(r.id)} className="w-full btn btn-outline text-left mb-2">
          <span className="font-medium">{r.mold_name}</span>
          <span className="text-gray-400 ml-2">{r.phase}·{r.active_factor_name}:{r.active_factor_value}</span></button>))}
      </div></div>);

  const filled=specimens.filter(s=>s.weight!==null);
  const avgW=filled.length?Math.round(filled.reduce((a,s)=>a+s.weight,0)/filled.length):0;
  const hf=specimens.filter(s=>s.hardness!==null);
  const avgH=hf.length?(hf.reduce((a,s)=>a+s.hardness,0)/hf.length).toFixed(1):'—';
  const fillDC=specimens.filter(s=>getDefectSummary(s).maxFill>0).length;
  const surfDC=specimens.filter(s=>getDefectSummary(s).hasSurface).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="badge badge-success">{run.phase}</span>
          <span className="text-sm font-semibold">{run.mold_name}</span>
          <span className="text-xs text-gray-400">·기준{run.ref_weight}g</span>
        </div>
        <button onClick={deleteRun} className="text-xs text-gray-400 hover:text-red-500">🗑삭제</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {run.active_factor_name&&<span className="badge badge-primary">🧪{run.active_factor_name}:{run.active_factor_value}</span>}
        {fixedFactors.map(ff=>(<span key={ff.id} className="badge badge-lock">🔒{ff.factor_name}:{ff.fixed_value}</span>))}
      </div>

      <div className="card">
        <div className="text-xs text-gray-500 font-medium mb-2">금형 표면 온도 (℃)</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-400 block mb-1">상형</label>
            <input type="number" step="0.1" value={tempUpper} onChange={e=>setTempUpper(e.target.value)}
              placeholder="—" className="w-full border rounded-lg px-3 py-2 text-sm text-center"/></div>
          <div><label className="text-xs text-gray-400 block mb-1">하형</label>
            <input type="number" step="0.1" value={tempLower} onChange={e=>setTempLower(e.target.value)}
              placeholder="—" className="w-full border rounded-lg px-3 py-2 text-sm text-center"/></div>
        </div>
      </div>

      <div className="card p-3">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="text-xs text-gray-400">
            <th className="py-2 w-8 text-center">#</th><th className="py-2 text-center">중량(g)</th>
            <th className="py-2 text-center">경도</th><th className="py-2 text-center">상태</th>
            <th className="py-2 text-center w-10">구역</th>
          </tr></thead>
          <tbody>{specimens.map((s,idx)=>{const sm=getDefectSummary(s);const hd=hasAnyDefect(s);return(
            <tr key={idx} className="border-t border-gray-100">
              <td className="py-1 text-center text-xs text-gray-400 font-medium">{s.specimen_no}</td>
              <td className="py-1 px-1"><input type="number" value={s.weight??''} onChange={e=>updateSpec(idx,'weight',e.target.value)}
                className="w-full text-center text-sm border rounded px-1 py-1.5" placeholder="—"/></td>
              <td className="py-1 px-1"><input type="number" value={s.hardness??''} onChange={e=>updateSpec(idx,'hardness',e.target.value)}
                className="w-full text-center text-sm border rounded px-1 py-1.5" placeholder="—"/></td>
              <td className="py-1 text-center">{hd?(<div className="flex gap-0.5 justify-center flex-wrap">
                {sm.maxFill>0&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:FILL_COLORS[sm.maxFill],color:FILL_TEXT[sm.maxFill]}}>미충진{sm.maxFill}</span>}
                {sm.hasSurface&&<span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">표면</span>}
              </div>):(<span className="text-xs text-green-500">양호</span>)}</td>
              <td className="py-1 text-center"><button onClick={()=>{setZoneEditIdx(idx);setSelectedZone(null);}}
                className={`text-lg ${hd?'text-red-400':'text-green-400'}`}>{hd?'⚠':'✓'}</button></td>
            </tr>);})}</tbody>
        </table>
        <button onClick={()=>setSpecimens(p=>[...p,{run_id:runId,specimen_no:p.length+1,weight:null,hardness:null,defect_severity:{},memo:''}])}
          className="w-full mt-2 py-2 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:bg-gray-50">+시편추가</button>
      </div>

      {zoneEditIdx!==null&&(
        <div className="card">
          <div className="text-xs text-gray-400 mb-3">시편#{specimens[zoneEditIdx]?.specimen_no}—구역선택후불량유형지정</div>
          <div className="grid grid-cols-3 gap-2 w-48 mx-auto mb-3">
            {ZONE_LABELS.map((label,zi)=>{const c=getZoneColor(zoneEditIdx,zi);const d=getZoneData(zoneEditIdx,zi);
              return(<button key={zi} onClick={()=>setSelectedZone(zi)} className="aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all"
                style={{background:c.bg,color:c.text,border:selectedZone===zi?`2px solid ${c.text}`:`1px solid ${c.border}`}}>
                <span>{label}</span>{(d.fill>0||d.surface>0)&&<span className="text-[9px] mt-0.5">{d.fill>0&&`미${d.fill}`}{d.fill>0&&d.surface>0&&'·'}{d.surface>0&&'표'}</span>}
              </button>);})}
          </div>
          <div className="flex gap-2 justify-center mb-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{background:FILL_COLORS[2]}}></span>미충진</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-200"></span>표면</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-200"></span>복합</span>
          </div>
          {selectedZone!==null&&(
            <div className="bg-gray-50 rounded-lg p-3 space-y-3">
              <div className="text-xs font-medium text-gray-600">{ZONE_LABELS[selectedZone]}구역</div>
              <div><div className="text-[10px] text-gray-400 mb-1.5">미충진</div>
                <div className="flex gap-1">{FILL_LABELS.map((l,i)=>{const cur=getZoneData(zoneEditIdx,selectedZone).fill;return(
                  <button key={i} onClick={()=>setZoneDefect(zoneEditIdx,selectedZone,'fill',i)} className="flex-1 py-2 text-xs rounded-lg transition-all"
                    style={{background:cur===i?FILL_COLORS[i]:'white',color:cur===i?FILL_TEXT[i]:'#9ca3af',
                    border:cur===i?`1.5px solid ${FILL_BORDERS[i]}`:'1px solid #e5e7eb',fontWeight:cur===i?600:400}}>{l}</button>);})}</div></div>
              <div><div className="text-[10px] text-gray-400 mb-1.5">표면상태</div>
                <div className="flex gap-1">{['양호','쭈글쭈글'].map((l,i)=>{const cur=getZoneData(zoneEditIdx,selectedZone).surface;return(
                  <button key={i} onClick={()=>setZoneDefect(zoneEditIdx,selectedZone,'surface',i)} className="flex-1 py-2 text-xs rounded-lg transition-all"
                    style={{background:cur===i?(i===0?'#d1fae5':'#DBEAFE'):'white',color:cur===i?(i===0?'#065f46':'#1E40AF'):'#9ca3af',
                    border:cur===i?(i===0?'1.5px solid #059669':'1.5px solid #3B82F6'):'1px solid #e5e7eb',fontWeight:cur===i?600:400}}>{l}</button>);})}</div></div>
            </div>)}
          <div className="text-center mt-3"><button onClick={()=>{setZoneEditIdx(null);setSelectedZone(null);}} className="btn btn-sm btn-outline">닫기</button></div>
        </div>)}

      {/* 사진 (다중) */}
      <div className="card">
        <div className="text-xs text-gray-500 font-medium mb-2">사진 ({photos.length}장)</div>
        {photos.length>0&&(
          <div className="space-y-2 mb-3">
            {photos.map(p=>(<div key={p.id} className="flex gap-2 items-start bg-gray-50 rounded-lg p-2">
              <img src={p.photo_url} alt="" className="w-20 h-20 object-cover rounded-lg flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <input type="text" defaultValue={p.memo||''} onBlur={e=>updatePhotoMemo(p.id,e.target.value)}
                  placeholder="코멘트 입력" className="w-full text-xs border rounded px-2 py-1.5 mb-1"/>
                <div className="text-[10px] text-gray-400">{new Date(p.created_at).toLocaleString('ko-KR')}</div>
              </div>
              <button onClick={()=>deletePhoto(p.id)} className="text-xs text-gray-300 hover:text-red-500 flex-shrink-0">✕</button>
            </div>))}
          </div>)}
        <input type="text" value={newPhotoMemo} onChange={e=>setNewPhotoMemo(e.target.value)}
          placeholder="사진 설명 (촬영 전 입력)" className="w-full border rounded-lg px-3 py-2 text-sm mb-2"/>
        <div className="flex gap-2">
          <label className="btn btn-sm btn-outline cursor-pointer flex-1 text-center">📷촬영
            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden"/></label>
          <label className="btn btn-sm btn-outline cursor-pointer flex-1 text-center">🖼갤러리
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden"/></label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="metric-card"><div className="text-lg font-semibold">{avgW||'—'}g</div><div className="text-[10px] text-gray-400">평균중량</div></div>
        <div className="metric-card"><div className="text-lg font-semibold">{avgH}</div><div className="text-[10px] text-gray-400">평균경도</div></div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="metric-card"><div className="text-lg font-semibold">{tempUpper||'—'}℃</div><div className="text-[10px] text-gray-400">온도(상)</div></div>
        <div className="metric-card"><div className="text-lg font-semibold">{tempLower||'—'}℃</div><div className="text-[10px] text-gray-400">온도(하)</div></div>
        <div className="metric-card"><div className={`text-lg font-semibold ${fillDC>0?'text-red-500':'text-green-500'}`}>{fillDC}</div><div className="text-[10px] text-gray-400">미충진</div></div>
        <div className="metric-card"><div className={`text-lg font-semibold ${surfDC>0?'text-blue-500':'text-green-500'}`}>{surfDC}</div><div className="text-[10px] text-gray-400">표면불량</div></div>
      </div>
      <button onClick={saveAll} disabled={saving} className="btn btn-primary w-full py-3 text-base">{saving?'저장중...':'💾로트저장'}</button>
    </div>);
}
