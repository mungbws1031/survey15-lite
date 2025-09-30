'use client';
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, RefreshCw, Upload, BarChart3, Radar as RadarIcon, Sparkles, ClipboardCheck } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

/**
 * 외관 디자인 설문 분석/종합점수 웹앱 (v3.1 JS)
 * - 디자인 향상(글래스 카드, 그라디언트 헤더, 스탯 칩/프로그레스, 섹션 아이콘)
 * - 'use client' 추가로 Next.js 클라이언트 컴포넌트 보장 (열리지 않는 이슈 해결)
 * - 로직은 v3 JS와 동일, UI/UX만 개선
 */

// ---------- 유틸
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const toPct = (x) => `${(x * 100).toFixed(1)}%`;
const nzInt = (v) => { const n = parseInt(String(v), 10); return Number.isFinite(n) && n >= 0 ? n : 0; };
const nzFloat = (v) => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : 0; };

// Charts font sizing (reduce >50%)
const CHART_FONT = 9; // px
const tickSmall = { fontSize: CHART_FONT };
const legendSmall = { fontSize: CHART_FONT };
const tooltipSmall = { fontSize: CHART_FONT };

// 간단 스모크 테스트(개발 편의): 빌드와 런타임 조합이 깨지지 않는지 콘솔에서 확인
function runSmokeTests(){
  try {
    console.assert(clamp01(-1) === 0 && clamp01(2) === 1, 'clamp01 실패');
    console.assert(sum([1,2,3]) === 6, 'sum 실패');
    const j = ['a','b','c'].join('\n');
    console.assert(j.split(/\r?\n/).length === 3, '줄바꿈 join/split 실패');
    const csv = ['H1,H2','1,2','3,4'].join('\n');
    console.assert(csv.split(/\r?\n/).length === 3, 'CSV 줄바꿈 실패');
    const npsCounts = [1,1,1,0,0,0,0, 1,1, 3,2]; // detr=3, pass=2, prom=5, total=10 → NPS=20
    const total = npsCounts.reduce((a,b)=>a+b,0);
    const detr = npsCounts.slice(0,7).reduce((a,b)=>a+b,0)/total;
    const prom = npsCounts.slice(9).reduce((a,b)=>a+b,0)/total;
    const nps = (prom - detr)*100;
    console.assert(Math.round(nps) === 20, 'NPS 계산 실패');
    console.log('%cSmoke tests passed','color:green');
  } catch (e) {
    console.warn('Smoke tests warning:', e);
  }
}

// 공통 소품
const StatChip = ({ label, value, hint }) => (
  <div className="rounded-xl px-3 py-2 bg-gradient-to-br from-muted/70 to-muted/30 border text-xs flex items-center gap-2">
    <span className="font-medium text-foreground/80">{label}</span>
    <span className="text-foreground/90 font-semibold">{value}</span>
    {hint ? <span className="text-muted-foreground">{hint}</span> : null}
  </div>
);

const ProgressBar = ({ value }) => (
  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
    <div className="h-full bg-foreground/80" style={{ width: `${clamp01(value/100)*100}%` }} />
  </div>
);

// ---------- 설문1(S-Blot) 구성
const SBlotQuestions = Array.from({ length: 10 }, (_, i) => `Q${i + 1}`);
const SBlotDefaultWeights = { Q1: 0.25, Q2: 0.1, Q3: 0.1, Q4: 0.1, Q5: 0.1, Q6: 0.1, Q7: 0.1, Q8: 0.05, Q9: 0.05, Q10: 0.05 };

function SBlotSection() {
  const [counts, setCounts] = useState(SBlotQuestions.map(() => [0, 0, 0, 0]));
  const [weights, setWeights] = useState({ ...SBlotDefaultWeights });

  // 저장/복구
  useEffect(() => {
    try { const raw = localStorage.getItem("sblot_state_v3_1"); if (raw) { const p = JSON.parse(raw); if (Array.isArray(p.counts) && typeof p.weights === 'object') { setCounts(p.counts); setWeights(p.weights); } } } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("sblot_state_v3_1", JSON.stringify({ counts, weights })); } catch {}
  }, [counts, weights]);

  const totalsPerQ = useMemo(() => counts.map((c) => sum(c)), [counts]);
  const sharesPerQ = useMemo(() => counts.map((c, qi) => { const n = totalsPerQ[qi] || 1; return c.map((v) => v / n); }), [counts, totalsPerQ]);
  const weightSum = useMemo(() => sum(SBlotQuestions.map((q) => weights[q] || 0)), [weights]);
  const normalizedWeights = useMemo(() => { const obj = {}; SBlotQuestions.forEach((q) => { obj[q] = (weights[q] || 0) / (weightSum || 1); }); return obj; }, [weights, weightSum]);

  const designScores = useMemo(() => [0,1,2,3].map(dIdx => SBlotQuestions.reduce((acc, q, qi) => acc + (normalizedWeights[q]||0) * (sharesPerQ[qi]?.[dIdx] ?? 0), 0) * 100), [sharesPerQ, normalizedWeights]);
  const rankOrder = useMemo(() => designScores.map((v,i)=>({design:`#0${i+1}`, score:v, idx:i})).sort((a,b)=>b.score-a.score), [designScores]);
  const N = useMemo(() => sum(totalsPerQ) / (totalsPerQ.length || 1), [totalsPerQ]);

  const sblotInterpretation = useMemo(() => {
    if (!Number.isFinite(rankOrder?.[0]?.score)) return "";
    const winner = rankOrder[0]; const runner = rankOrder[1] ?? { score: 0, idx: 0 };
    const band = (s) => (s>=80?"매우 강한 선호":s>=70?"강한 선호":s>=60?"보통 이상의 선호":s>=50?"경합 구도":"우세 불충분");
    const deltas = SBlotQuestions.map((q, qi) => { const w = normalizedWeights[q]||0; const winShare = sharesPerQ[qi]?.[winner.idx]??0; const runShare=sharesPerQ[qi]?.[runner.idx]??0; return { q, contrib: (winShare-runShare)*w, winShare }; }).sort((a,b)=>b.contrib-a.contrib).slice(0,3);
    const worst = SBlotQuestions.map((q,qi)=>({q, s: sharesPerQ[qi]?.[winner.idx]??0})).sort((a,b)=>a.s-b.s)[0];
    const lines = [
      `종합점수 1위: ${winner.design} (${winner.score.toFixed(1)}점, ${band(winner.score)})`,
      `2위와 격차: ${(winner.score - runner.score).toFixed(1)}점`,
      `표본(문항 평균): ${Number.isFinite(N)? N.toFixed(1):'-'}명`,
      `우세 근거 상위 문항: ${deltas.map(d=>`${d.q}↑`).join(', ')}`,
      `해석: ${winner.design}은 핵심 문항에서 일관된 우위를 보이며, 특히 ${deltas[0]?.q??'-'}에서 높은 선택 비율(${toPct(deltas[0]?.winShare||0)})이 전체 점수에 크게 기여했습니다.`,
    ];
    if (worst) lines.push(`개선 포인트: ${winner.design}은 ${worst.q}에서 상대적으로 약함 → 다음 라운드에서 해당 축 개선 시 점수 상승 여지.`);
    return lines.join("\n");
  }, [rankOrder, normalizedWeights, sharesPerQ, N]);

  const sblotConclusion = useMemo(() => {
    if (!rankOrder.length) return "";
    const winner = rankOrder[0]; const runner = rankOrder[1] ?? { score: 0 }; const gap = winner.score - (runner.score ?? 0);
    const flags = []; if (N < 10) flags.push("표본 수가 작아 불확실성 큼");
    let verdict = "추가 검증 필요"; if (winner.score >= 70 && gap >= 5) verdict = `우선 채택 권고: ${winner.design}`; else if (winner.score >= 60 && gap >= 3) verdict = `조건부 채택(개선 후 재검증): ${winner.design}`;
    const lines = [ `결론: ${verdict}`, `근거: 종합점수 ${winner.score.toFixed(1)}점, 2위와 격차 ${gap.toFixed(1)}점`, flags.length?`주의: ${flags.join(' · ')}`:undefined ].filter(Boolean);
    return lines.join("\n");
  }, [rankOrder, N]);

  const reset = () => { setCounts(SBlotQuestions.map(() => [0,0,0,0])); setWeights({ ...SBlotDefaultWeights }); };

  const exportCountsCSV = () => { const header=["Question","#01","#02","#03","#04","N"]; const rows=counts.map((row,i)=>[SBlotQuestions[i],...row,sum(row)]); const csv=[header,...rows].map(r=>r.join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='sblot_counts.csv'; a.click(); URL.revokeObjectURL(url); };
  const importCountsCSV = async (file) => { const text=await file.text(); const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean); const hasHeader=/question/i.test(lines[0]); const body=hasHeader?lines.slice(1):lines; const next=SBlotQuestions.map(()=>[0,0,0,0]); body.slice(0,10).forEach((line,idx)=>{ const c=line.split(','); next[idx]=[nzInt(c[1]),nzInt(c[2]),nzInt(c[3]),nzInt(c[4])]; }); setCounts(next); };
  const exportJSON = () => { const blob=new Blob([JSON.stringify({counts,weights},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='sblot_results.json'; a.click(); URL.revokeObjectURL(url); };

  const chartData = [ {name:'#01', score:designScores[0]||0}, {name:'#02', score:designScores[1]||0}, {name:'#03', score:designScores[2]||0}, {name:'#04', score:designScores[3]||0} ];
  const radarData = SBlotQuestions.map((q,qi)=>({ metric:q, '#01':(sharesPerQ[qi]?.[0]||0)*100, '#02':(sharesPerQ[qi]?.[1]||0)*100, '#03':(sharesPerQ[qi]?.[2]||0)*100, '#04':(sharesPerQ[qi]?.[3]||0)*100 }));
  const copyText = async (text) => { try { await navigator.clipboard.writeText(text); } catch {} };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-foreground/10 shadow-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="w-5 h-5"/> S-Blot 10문항 & 가중치</div>
          <p className="text-sm text-muted-foreground">응답 수를 입력하면 비율·종합점수·순위가 자동 계산됩니다.</p>

          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground">가중치 (합계 자동 정규화)</div>
            {SBlotQuestions.map((q) => (
              <div key={q} className="flex items-center gap-2">
                <Label className="w-12 text-foreground/80">{q}</Label>
                <Input type="number" step="0.01" value={weights[q]} onChange={(e)=> setWeights({...weights, [q]: nzFloat(e.target.value)})} />
              </div>
            ))}
            <StatChip label="가중치 합계" value={weightSum.toFixed(2)} hint="정규화: 1.00"/>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="secondary" onClick={reset}><RefreshCw className="w-4 h-4 mr-2"/>초기화</Button>
            <Button onClick={exportJSON}><Download className="w-4 h-4 mr-2"/>JSON</Button>
            <Button onClick={exportCountsCSV}><Download className="w-4 h-4 mr-2"/>CSV</Button>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="file" accept=".csv" className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f) importCountsCSV(f);}}/>
              <span className="inline-flex items-center px-3 py-2 rounded-md border"><Upload className="w-4 h-4 mr-2"/>CSV 불러오기</span>
            </label>
          </div>

          <StatChip label="추정 응답자 수(평균)" value={Number.isFinite(N)?N.toFixed(1):'-'} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 border-foreground/10 shadow-sm">
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-2 text-lg font-semibold"><BarChart3 className="w-5 h-5"/> 번호별 입력</div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/80 backdrop-blur">
                <tr className="border-b">
                  <th className="text-left py-2 pr-2">문항</th>
                  <th className="text-right px-2">① #01</th>
                  <th className="text-right px-2">② #02</th>
                  <th className="text-right px-2">③ #03</th>
                  <th className="text-right px-2">④ #04</th>
                  <th className="text-right px-2">N</th>
                </tr>
              </thead>
              <tbody>
                {SBlotQuestions.map((q, qi) => (
                  <tr key={q} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="py-2 pr-2 font-medium">{q}</td>
                    {[0,1,2,3].map((oi)=> (
                      <td key={oi} className="px-2 py-1">
                        <Input type="number" min={0} value={counts[qi][oi]} onChange={(e)=>{
                          const v = nzInt(e.target.value);
                          setCounts(prev=> prev.map((row,r)=> r===qi? row.map((c,cidx)=> cidx===oi? v: c): row));
                        }}/>
                      </td>
                    ))}
                    <td className="text-right px-2">{totalsPerQ[qi]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardContent className="pt-6 space-y-3">
                <div className="font-semibold">종합점수 & 순위 (0–100)</div>
                <ul className="mt-1 text-sm space-y-1">
                  {rankOrder.map((d, idx)=> (
                    <li key={d.design} className="flex items-center justify-between">
                      <span><b>{idx+1}위</b> {d.design}</span>
                      <span className="w-40"><ProgressBar value={d.score}/></span>
                      <span className="tabular-nums font-semibold">{d.score.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
                <div className="h-56 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" tick={tickSmall} tickMargin={4}/>
                      <YAxis domain={[0,100]} tick={tickSmall}/>
                      <Tooltip wrapperStyle={tooltipSmall}/>
                      <Legend wrapperStyle={legendSmall}/>
                      <Bar dataKey="score" name="종합점수"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="font-semibold flex items-center gap-2"><RadarIcon className="w-4 h-4"/> 문항별 선호 비율(%)</div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" tick={tickSmall}/>
                      <PolarRadiusAxis angle={30} domain={[0,100]} tick={tickSmall}/>
                      <Radar name="#01" dataKey="#01" fillOpacity={0.25} />
                      <Radar name="#02" dataKey="#02" fillOpacity={0.25} />
                      <Radar name="#03" dataKey="#03" fillOpacity={0.25} />
                      <Radar name="#04" dataKey="#04" fillOpacity={0.25} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardContent className="pt-6 space-y-3">
              <div className="font-semibold flex items-center gap-2"><ClipboardCheck className="w-4 h-4"/> 자동 해설문 & 결론</div>
              <textarea className="w-full min-h-[120px] rounded-2xl p-3 bg-muted" readOnly value={sblotInterpretation}/>
              <div className="flex gap-2"><Button size="sm" onClick={()=>copyText(sblotInterpretation)}>해설문 복사</Button></div>
              <textarea className="w-full min-h-[110px] rounded-2xl p-3 bg-muted" readOnly value={sblotConclusion}/>
              <div className="flex gap-2"><Button size="sm" onClick={()=>copyText(sblotConclusion)}>결론 복사</Button></div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- 설문2(슈얼리오브제)
const OBJLikertQs = [
  { key: "Q2", label: "Q2 호감도 (1~5)" },
  { key: "Q3", label: "Q3 신뢰감 (1~5)" },
  { key: "Q4", label: "Q4 크기 적합 (1~5)" },
  { key: "Q5", label: "Q5 그립감 (1~5)" },
  { key: "Q7", label: "Q7 표시 직관성 (1~5)" },
  { key: "Q9", label: "Q9 진행표시 도움 (1~5)" },
  { key: "Q10", label: "Q10 투입구 명확성 (1~5)" },
  { key: "Q12", label: "Q12 위생/세척 용이성 (1~5)" },
  { key: "Q14", label: "Q14 색 조합 선호 (1~5)" },
];

const Q1_KEYWORDS = ["깔끔함","의료기기다움","가전제품 같다","장난감 같다","고급스러움","차가움","따뜻함","미니멀","둔탁함","기타"];
const Q6_RING = ["매우 좋다(고급 포인트)","눈에 잘 띄어 좋다","없어도 좋겠다","지저분해 보인다","잘 모르겠다","기타"];
const Q8_ENV = ["욕실 밝은 조명","어두운 화장실","침실 아침","창가/자연광","잘 모르겠다","기타"];
const Q11_SD = ["전문적이다","구식·불편해 보인다","디자인에 무관","잘 모르겠다"];
const Q13_PLACE = ["욕실","침실","화장대","거실","휴대 전용(보관 시 안 보이는 곳)","기타"];
const Q15_COLORS = ["실버","샴페인","미스트 블루","로즈","블랙","기타"];
const Q16_PRICE = ["₩50,000 이하","₩50,000–99,000","₩100,000–199,000","₩200,000 이상"];

const CAT_QUESTIONS = [
  { key: "Q1",  label: "Q1 첫인상 키워드 (복수선택)", options: Q1_KEYWORDS,  multi: true },
  { key: "Q6",  label: "Q6 링에 대한 느낌 (단일)",   options: Q6_RING,      multi: false },
  { key: "Q8",  label: "Q8 가독성 환경 (복수)",     options: Q8_ENV,       multi: true },
  { key: "Q11", label: "Q11 SD 슬롯 인상 (단일)",   options: Q11_SD,       multi: false },
  { key: "Q13", label: "Q13 적합한 장소 (단일)",     options: Q13_PLACE,    multi: false },
  { key: "Q15", label: "Q15 대체 포인트 컬러 (복수)", options: Q15_COLORS,   multi: true },
  { key: "Q16", label: "Q16 예상 가격대 (단일)",     options: Q16_PRICE,    multi: false },
];

function ObjSection(){
  const [likertCounts, setLikertCounts] = useState(Object.fromEntries(OBJLikertQs.map((q)=>[q.key, [0,0,0,0,0]])));
  const [npsCounts, setNpsCounts] = useState(Array.from({length:11}, ()=>0));
  const [catCounts, setCatCounts] = useState({ Q1:Array(Q1_KEYWORDS.length).fill(0), Q6:Array(Q6_RING.length).fill(0), Q8:Array(Q8_ENV.length).fill(0), Q11:Array(Q11_SD.length).fill(0), Q13:Array(Q13_PLACE.length).fill(0), Q15:Array(Q15_COLORS.length).fill(0), Q16:Array(Q16_PRICE.length).fill(0) });

  useEffect(()=>{ try{ const raw=localStorage.getItem('obj_state_v3_1'); if(raw){ const p=JSON.parse(raw); if(p.likertCounts&&p.npsCounts&&p.catCounts){ setLikertCounts(p.likertCounts); setNpsCounts(p.npsCounts); setCatCounts(p.catCounts);} } }catch{} },[]);
  useEffect(()=>{ try{ localStorage.setItem('obj_state_v3_1', JSON.stringify({likertCounts,npsCounts,catCounts})); }catch{} },[likertCounts,npsCounts,catCounts]);

  const likertStats = useMemo(()=>{ const out={}; OBJLikertQs.forEach(q=>{ const arr=likertCounts[q.key]||[0,0,0,0,0]; const N=sum(arr); const mean=N? arr.map((c,i)=>c*(i+1)).reduce((a,b)=>a+b,0)/N:0; const top2=N? (arr[3]+arr[4])/N:0; const score100=clamp01((mean-1)/4)*100; out[q.key]={N,mean,top2,score100};}); return out; },[likertCounts]);
  const totalN = useMemo(()=> sum(OBJLikertQs.map(q=> likertStats[q.key].N)), [likertStats]);
  const nps = useMemo(()=>{ const total=sum(npsCounts); if(!total) return {prom:0,detr:0,pass:0,nps:0,total:0}; const detr=sum(npsCounts.slice(0,7))/total; const pass=sum(npsCounts.slice(7,9))/total; const prom=sum(npsCounts.slice(9,11))/total; return {prom,detr,pass,nps:(prom-detr)*100,total}; },[npsCounts]);
  const overallScore = useMemo(()=>{ const vals=OBJLikertQs.map(q=> likertStats[q.key].score100); const valid=vals.filter(v=>!isNaN(v)); return valid.length? sum(valid)/valid.length: 0; },[likertStats]);

  const catTop = (key, topK=3)=>{ const arr=catCounts[key]||[]; const labels=(CAT_QUESTIONS.find(q=>q.key===key)||{options:[]}).options; return arr.map((c,i)=>({label:labels[i],c})).sort((a,b)=>b.c-a.c).slice(0,topK); };
  const catTotal = (key)=> sum(catCounts[key]||[]);
  const ringFavor = useMemo(()=>{ const arr=catCounts.Q6||[]; const pos=(arr[0]||0)+(arr[1]||0); const neu=(arr[4]||0); const neg=(arr[2]||0)+(arr[3]||0); const tot=pos+neu+neg; const score=tot? ((pos-neg)/tot)*100:0; return {pos,neu,neg,tot,score}; },[catCounts.Q6]);
  const sdFavor = useMemo(()=>{ const arr=catCounts.Q11||[]; const pos=(arr[0]||0); const neg=(arr[1]||0); const neu=(arr[2]||0)+(arr[3]||0); const tot=pos+neg+neu; const score=tot?((pos-neg)/tot)*100:0; return {pos,neg,neu,tot,score}; },[catCounts.Q11]);
  const weakestKey = useMemo(()=>{ const arr=OBJLikertQs.map(q=>({key:q.key,s:likertStats[q.key].score100})); arr.sort((a,b)=>a.s-b.s); return arr[0]?.key??'-'; },[likertStats]);

  const objInterpretation = useMemo(()=>{ const bands=(s)=> s>=80?"매우 우수": s>=70?"우수": s>=60?"양호": s>=50?"보통":"개선 필요"; const topLow=[...OBJLikertQs].map(q=>({q:q.key,score:likertStats[q.key].score100})).sort((a,b)=>b.score-a.score); const best=topLow[0]; const worst=topLow[topLow.length-1]; const lines=[ `종합 점수: ${overallScore.toFixed(1)}점 (${bands(overallScore)})`, `강점 문항: ${best?.q??'-'} ( ${(best?.score||0).toFixed(1)}점 )`, `보강 문항: ${worst?.q??'-'} ( ${(worst?.score||0).toFixed(1)}점 )`, `NPS: ${nps.nps.toFixed(1)} — Promoters ${toPct(nps.prom)}, Passives ${toPct(nps.pass)}, Detractors ${toPct(nps.detr)}`, `첫인상 키워드 TOP3: ${catTop('Q1').map(x=>`${x.label}(${x.c})`).join(', ')}`, `대체 컬러 TOP2: ${catTop('Q15',2).map(x=>x.label).join(', ')}` ]; if(ringFavor.tot) lines.push(`링 인상 밸런스(+)${ringFavor.pos} / (±)${ringFavor.neu} / (-)${ringFavor.neg} → 순호감 ${ringFavor.score.toFixed(1)}pt`); if(sdFavor.tot) lines.push(`SD 슬롯 인상 순호감 ${sdFavor.score.toFixed(1)}pt (긍:${sdFavor.pos}, 부:${sdFavor.neg})`); return lines.join('\n'); },[overallScore, likertStats, nps, catCounts, ringFavor, sdFavor]);

  const objConclusion = useMemo(()=>{ let verdict='재설계 권장'; if(overallScore>=75 && nps.nps>=30) verdict='출시 적합'; else if (overallScore>=65 && nps.nps>=0) verdict='개선 후 출시 검토'; const priceArr=catCounts.Q16||[]; let priceModeIdx=-1, max=-1; priceArr.forEach((v,i)=>{ if(v>max){max=v; priceModeIdx=i;} }); const priceHint=priceModeIdx>=0? `· 예상 가격대 선호: ${Q16_PRICE[priceModeIdx]}`:''; const lines=[ `결론: ${verdict}`, `근거: 종합 ${overallScore.toFixed(1)} / NPS ${nps.nps.toFixed(1)} · 최약점 ${weakestKey}`, priceHint ].filter(Boolean); return lines.join('\n'); },[overallScore,nps,weakestKey,catCounts]);

  const reset = () => { setLikertCounts(Object.fromEntries(OBJLikertQs.map((q)=>[q.key,[0,0,0,0,0]]))); setNpsCounts(Array.from({length:11},()=>0)); setCatCounts({ Q1:Array(Q1_KEYWORDS.length).fill(0), Q6:Array(Q6_RING.length).fill(0), Q8:Array(Q8_ENV.length).fill(0), Q11:Array(Q11_SD.length).fill(0), Q13:Array(Q13_PLACE.length).fill(0), Q15:Array(Q15_COLORS.length).fill(0), Q16:Array(Q16_PRICE.length).fill(0) }); };

  const chartData = OBJLikertQs.map(q=> ({name:q.key, score: likertStats[q.key].score100}));
  const copyText = async (text) => { try{ await navigator.clipboard.writeText(text);}catch{} };
  const catBarData = (key) => { const labels=(CAT_QUESTIONS.find(x=>x.key===key)||{options:[]}).options; const arr=catCounts[key]||[]; return labels.map((lab,i)=>({name:lab, count:arr[i]||0})); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-foreground/10 shadow-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="w-5 h-5"/> 핵심 번호형 + 카테고리 입력</div>
          <p className="text-sm text-muted-foreground">복수선택 문항은 선택 합계를 입력하세요.</p>

          {OBJLikertQs.map((q)=> (
            <div key={q.key} className="border rounded-2xl p-3 space-y-2">
              <div className="font-medium">{q.label}</div>
              <div className="grid grid-cols-5 gap-2">
                {[1,2,3,4,5].map((v,idx)=> (
                  <div key={v} className="flex flex-col items-start">
                    <Label>{v}</Label>
                    <Input type="number" min={0} value={(likertCounts[q.key]||[0,0,0,0,0])[idx]} onChange={(e)=>{
                      const nv=nzInt(e.target.value); setLikertCounts(prev=> ({...prev, [q.key]: (prev[q.key]||[0,0,0,0,0]).map((c,i)=> i===idx? nv: c)})); }}/>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3">
                <span>N={likertStats[q.key].N}</span>
                <span>평균={likertStats[q.key].mean.toFixed(2)}</span>
                <span>Top2={toPct(likertStats[q.key].top2)}</span>
                <span className="flex-1"><ProgressBar value={likertStats[q.key].score100}/></span>
                <span className="tabular-nums">{likertStats[q.key].score100.toFixed(1)}</span>
              </div>
            </div>
          ))}

          <div className="border rounded-2xl p-3 space-y-2">
            <div className="font-medium">Q17 추천의향 (0~10) — NPS</div>
            <div className="grid grid-cols-11 gap-2">
              {Array.from({length:11},(_,i)=>i).map((v,idx)=> (
                <div key={v} className="flex flex-col items-start">
                  <Label>{v}</Label>
                  <Input type="number" min={0} value={npsCounts[idx]} onChange={(e)=>{ const nv=nzInt(e.target.value); setNpsCounts(prev=> prev.map((c,i2)=> i2===idx? nv: c)); }} />
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">P {toPct(nps.prom)} / Pa {toPct(nps.pass)} / D {toPct(nps.detr)} · NPS={nps.nps.toFixed(1)}</div>
          </div>

          <div className="space-y-4">
            {CAT_QUESTIONS.map((cq)=> (
              <div key={cq.key} className="border rounded-2xl p-3 space-y-2">
                <div className="font-medium">{cq.label}</div>
                <div className={`grid ${cq.options.length>6? 'grid-cols-3':'grid-cols-2'} gap-2`}>
                  {cq.options.map((opt,idx)=> (
                    <div key={idx} className="flex flex-col items-start">
                      <Label>{opt}</Label>
                      <Input type="number" min={0} value={(catCounts[cq.key]||[])[idx]||0} onChange={(e)=>{
                        const nv=nzInt(e.target.value); setCatCounts(prev=> ({...prev, [cq.key]: (prev[cq.key]||[]).map((c,i)=> i===idx? nv: c)})); }} />
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">총 선택 수: {catTotal(cq.key)}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={reset}><RefreshCw className="w-4 h-4 mr-2"/>초기화</Button>
          </div>
          <StatChip label="리커트 입력 합계" value={totalN} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 border-foreground/10 shadow-sm">
        <CardContent className="pt-6 space-y-6">
          <div className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5"/> 결과 요약</div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-muted/70 to-muted/30 border">
              <div className="text-xs text-muted-foreground">종합 점수(0~100)</div>
              <div className="text-3xl font-bold">{overallScore.toFixed(1)}</div>
              <div className="mt-2"><ProgressBar value={overallScore}/></div>
            </div>
            <div className="rounded-2xl p-4 bg-gradient-to-br from-muted/70 to-muted/30 border">
              <div className="text-xs text-muted-foreground">NPS</div>
              <div className="text-3xl font-bold">{nps.nps.toFixed(1)}</div>
              <div className="text-xs">P {toPct(nps.prom)} / D {toPct(nps.detr)}</div>
            </div>
            <div className="rounded-2xl p-4 bg-gradient-to-br from-muted/70 to-muted/30 border">
              <div className="text-xs text-muted-foreground">Top-2 Box 평균</div>
              <div className="text-3xl font-bold">{(((OBJLikertQs.map((q) => likertStats[q.key].top2).reduce((a,b)=>a+b,0)||0)/OBJLikertQs.length)*100).toFixed(1)}%</div>
              <div className="text-xs">각 문항 (4~5) 비율</div>
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={tickSmall} tickMargin={4}/>
                <YAxis domain={[0,100]} tick={tickSmall}/>
                <Tooltip wrapperStyle={tooltipSmall}/>
                <Legend wrapperStyle={legendSmall}/>
                <Bar dataKey="score" name="문항별 점수(0~100)"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {["Q1","Q6","Q8","Q11","Q13","Q15","Q16"].map((ck)=> (
              <Card key={ck} className="shadow-sm">
                <CardContent className="pt-6">
                  <div className="font-semibold">{(CAT_QUESTIONS.find(x=>x.key===ck)||{label:ck}).label}</div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={catBarData(ck)}>
                        <XAxis
                          dataKey="name"
                          interval={0}
                          angle={ck === "Q1" ? -28 : -10}
                          textAnchor="end"
                          height={ck === "Q1" ? 70 : 60}
                          tick={ck === "Q1" ? { ...tickSmall, fontStyle: 'italic' } : tickSmall }
                          tickMargin={ck === "Q1" ? 4 : 2}
                        />
                        <YAxis allowDecimals={false}/>
                        <Tooltip wrapperStyle={tooltipSmall}/>
                        <Legend wrapperStyle={legendSmall}/>
                        <Bar dataKey="count" name="응답 수"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm">
            <CardContent className="pt-6 space-y-3">
              <div className="font-semibold flex items-center gap-2"><ClipboardCheck className="w-4 h-4"/> 자동 해설문 & 결론</div>
              <textarea className="w-full min-h-[120px] rounded-2xl p-3 bg-muted" readOnly value={objInterpretation}/>
              <div className="flex gap-2"><Button size="sm" onClick={()=>copyText(objInterpretation)}>해설문 복사</Button></div>
              <textarea className="w-full min-h-[110px] rounded-2xl p-3 bg-muted" readOnly value={objConclusion}/>
              <div className="flex gap-2"><Button size="sm" onClick={()=>copyText(objConclusion)}>결론 복사</Button></div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- 앱 루트
export default function App(){
  useEffect(()=>{ runSmokeTests(); }, []);
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background via-background to-background">
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <header className="rounded-2xl p-6 bg-gradient-to-br from-foreground/5 to-foreground/0 border">
          <h1 className="text-2xl font-bold">외관 디자인 설문 분석/종합점수 웹앱</h1>
          <p className="text-sm text-muted-foreground mt-1">두 설문(① S-Blot / ② 슈얼리오브제)을 입력하면 자동으로 종합점수와 통계를 계산합니다.</p>
        </header>

        <Tabs defaultValue="sblot" className="w-full">
          <TabsList className="grid grid-cols-2 w-full rounded-2xl">
            <TabsTrigger value="sblot">① S-Blot</TabsTrigger>
            <TabsTrigger value="obj">② 슈얼리오브제</TabsTrigger>
          </TabsList>
          <TabsContent value="sblot"><SBlotSection/></TabsContent>
          <TabsContent value="obj"><ObjSection/></TabsContent>
        </Tabs>

        <footer className="text-xs text-muted-foreground">
          <div>입력값은 브라우저 메모리(로컬스토리지)에 저장됩니다. 브라우저 캐시/데이터 삭제 시 초기화될 수 있습니다.</div>
        </footer>
      </div>
    </div>
  );
}
