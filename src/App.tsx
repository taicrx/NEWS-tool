/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Activity, 
  Thermometer, 
  Wind, 
  Droplets, 
  Heart, 
  Brain, 
  Copy, 
  Trash2, 
  FileText, 
  CheckCircle2,
  Search,
  Zap,
  Download
} from 'lucide-react';
import { motion } from 'motion/react';

// --- NEWS2 Scoring Logic ---
const getRRScore = (val: number | null) => {
  if (val === null) return 0;
  if (val <= 8) return 3;
  if (val <= 11) return 1;
  if (val <= 20) return 0;
  if (val <= 24) return 2;
  return 3;
};

const getSpO2Score = (val: number | null) => {
  if (val === null) return 0;
  if (val <= 91) return 3;
  if (val <= 93) return 2;
  if (val <= 95) return 1;
  return 0;
};

const getTempScore = (val: number | null) => {
  if (val === null) return 0;
  if (val <= 35.0) return 3;
  if (val <= 36.0) return 1;
  if (val <= 38.0) return 0;
  if (val <= 39.0) return 1;
  return 2;
};

const getSBPScore = (val: number | null) => {
  if (val === null) return 0;
  if (val <= 90) return 3;
  if (val <= 100) return 2;
  if (val <= 110) return 1;
  if (val <= 219) return 0;
  return 3;
};

const getHRScore = (val: number | null) => {
  if (val === null) return 0;
  if (val <= 40) return 3;
  if (val <= 50) return 1;
  if (val <= 90) return 0;
  if (val <= 110) return 1;
  if (val <= 130) return 2;
  return 3;
};

// --- Types ---
interface Vitals {
  rr: number | null;
  spo2: number | null;
  temp: number | null;
  sbp: number | null;
  dbp: number | null;
  hr: number | null;
  gcs: number | null;
  e: number | null;
  v: number | null;
  m: number | null;
  oxygen: boolean;
  consciousness: 'Alert' | 'Altered';
  suspectedInfection: boolean;
  infectionLevel: 'None' | 'Possible' | 'Strong';
}

export default function App() {
  const [vitals, setVitals] = useState<Vitals>({
    rr: null,
    spo2: null,
    temp: null,
    sbp: null,
    dbp: null,
    hr: null,
    gcs: 15,
    e: 4,
    v: 5,
    m: 6,
    oxygen: false,
    consciousness: 'Alert',
    suspectedInfection: false,
    infectionLevel: 'None',
  });

  const [mrn, setMrn] = useState('');
  const [soapText, setSoapText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // --- Calculations ---
  const scores: Record<string, number> = useMemo(() => ({
    rr: getRRScore(vitals.rr),
    spo2: getSpO2Score(vitals.spo2),
    temp: getTempScore(vitals.temp),
    sbp: getSBPScore(vitals.sbp),
    hr: getHRScore(vitals.hr),
    oxygen: vitals.oxygen ? 2 : 0,
    consciousness: vitals.consciousness === 'Altered' ? 3 : 0,
  }), [vitals]);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  
  const riskLevel = useMemo(() => {
    if (totalScore >= 7) return { label: 'High risk', color: 'bg-red-600', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
    if (totalScore >= 5) return { label: 'Medium risk', color: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
    return { label: 'Low risk', color: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  }, [totalScore]);

  const possibleSepsis = (vitals.suspectedInfection && totalScore >= 5) ? 'Yes' : 'No';

  // --- AI Parser ---
  const parseWithAI = async () => {
    if (!soapText.trim()) return;
    setIsParsing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          你是一個專業的急診醫學助理。請解析以下病歷摘要(SOAP)，提取生命徵象數據。
          
          病歷內容: "${soapText}"
          
          請嚴格以 JSON 格式回傳：
          {
            "rr": number | null,
            "spo2": number | null,
            "temp": number | null,
            "sbp": number | null,
            "dbp": number | null,
            "hr": number | null,
            "gcs": number | null,
            "e": number | null,
            "v": number | null,
            "m": number | null,
            "oxygen": boolean,
            "consciousness": "Alert" | "Altered",
            "suspectedInfection": boolean,
            "infectionLevel": "None" | "Possible" | "Strong",
            "mrn": string | null
          }
        `,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text);
      setVitals({
        rr: data.rr,
        spo2: data.spo2,
        temp: data.temp,
        sbp: data.sbp,
        dbp: data.dbp,
        hr: data.hr,
        gcs: data.gcs,
        e: data.e,
        v: data.v,
        m: data.m,
        oxygen: data.oxygen || false,
        consciousness: data.consciousness || 'Alert',
        suspectedInfection: data.suspectedInfection || false,
        infectionLevel: data.infectionLevel || 'None',
      });
      if (data.mrn) setMrn(data.mrn);
    } catch (error) {
      console.error("AI Parsing failed:", error);
      alert("AI 解析失敗，請手動輸入。");
    } finally {
      setIsParsing(false);
    }
  };

  // --- Data Export Logic ---
  const getFullDataRow = (separator: string) => {
    const parsedAt = new Date().toISOString();
    return [
      mrn || "", 
      vitals.rr ?? "", 
      vitals.spo2 ?? "", 
      vitals.oxygen ? 'Yes' : 'No documented', 
      vitals.temp ?? "", 
      vitals.sbp ?? "", 
      vitals.dbp ?? "", 
      vitals.hr ?? "", 
      vitals.gcs ?? "", 
      vitals.e ?? "", 
      vitals.v ?? "", 
      vitals.m ?? "",
      vitals.consciousness, 
      vitals.suspectedInfection ? 'Yes' : 'No', 
      vitals.infectionLevel, 
      possibleSepsis,
      scores.rr, 
      scores.spo2, 
      scores.oxygen, 
      scores.temp,
      scores.sbp, 
      scores.hr, 
      scores.consciousness,
      totalScore, 
      riskLevel.label, 
      parsedAt
    ].join(separator);
  };

  const copyToExcel = () => {
    const row = getFullDataRow('\t');
    navigator.clipboard.writeText(row);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const downloadCSV = () => {
    const headers = [
      "MRN", "RR", "SpO2", "OxygenSupport", "Temp", "SBP", "DBP", "HR", "GCS", "E", "V", "M", 
      "Consciousness", "InfectionSuspected", "InfectionClueLevel", "PossibleSepsisFlag", 
      "RR_Score", "SpO2_Score", "Oxygen_Score", "Temp_Score", "SBP_Score", "HR_Score", 
      "Consciousness_Score", "NEWS2", "Risk", "ParsedAt"
    ].join(',');
    
    const row = getFullDataRow(',');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + row;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NEWS2_${mrn || 'export'}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setVitals({
      rr: null, spo2: null, temp: null, sbp: null, dbp: null, hr: null,
      gcs: 15, e: 4, v: 5, m: 6,
      oxygen: false, consciousness: 'Alert', suspectedInfection: false, infectionLevel: 'None'
    });
    setMrn('');
    setSoapText('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-wider mb-1">
              <Activity size={16} />
              Triage Decision Support
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              臺中醫院 NEWS2 & Sepsis 篩檢
            </h1>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs">最後更新: {new Date().toLocaleDateString('zh-TW')}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left Column: Input (3/4 width) */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Manual Entry Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Zap size={20} className="text-amber-500" />
                  檢傷數據輸入
                </h2>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-500">病歷號:</label>
                  <input 
                    type="text" 
                    value={mrn}
                    onChange={(e) => setMrn(e.target.value)}
                    placeholder="MRN"
                    className="w-32 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <VitalInput label="呼吸 (RR)" icon={<Wind size={14} />} value={vitals.rr} onChange={(v) => setVitals({...vitals, rr: v})} unit="/min" score={scores.rr} />
                <VitalInput label="血氧 (SpO2)" icon={<Droplets size={14} />} value={vitals.spo2} onChange={(v) => setVitals({...vitals, spo2: v})} unit="%" score={scores.spo2} />
                <VitalInput label="體溫 (BT)" icon={<Thermometer size={14} />} value={vitals.temp} onChange={(v) => setVitals({...vitals, temp: v})} unit="°C" step={0.1} score={scores.temp} />
                <VitalInput label="收縮壓 (SBP)" icon={<Activity size={14} />} value={vitals.sbp} onChange={(v) => setVitals({...vitals, sbp: v})} unit="mmHg" score={scores.sbp} />
                <VitalInput label="舒張壓 (DBP)" icon={<Activity size={14} />} value={vitals.dbp} onChange={(v) => setVitals({...vitals, dbp: v})} unit="mmHg" score={0} />
                <VitalInput label="心跳 (HR)" icon={<Heart size={14} />} value={vitals.hr} onChange={(v) => setVitals({...vitals, hr: v})} unit="/min" score={scores.hr} />
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Brain size={14} /> GCS (E/V/M)
                  </label>
                  <div className="flex gap-1">
                    <input type="number" placeholder="E" value={vitals.e ?? ''} onChange={(e) => setVitals({...vitals, e: Number(e.target.value)})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center" />
                    <input type="number" placeholder="V" value={vitals.v ?? ''} onChange={(e) => setVitals({...vitals, v: Number(e.target.value)})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center" />
                    <input type="number" placeholder="M" value={vitals.m ?? ''} onChange={(e) => setVitals({...vitals, m: Number(e.target.value)})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    意識狀態
                  </label>
                  <select 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    value={vitals.consciousness}
                    onChange={(e) => setVitals({...vitals, consciousness: e.target.value as any})}
                  >
                    <option value="Alert">Alert (清醒)</option>
                    <option value="Altered">Altered (混亂/無反應)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={vitals.oxygen} onChange={(e) => setVitals({...vitals, oxygen: e.target.checked})} />
                    <span className="text-sm font-bold text-slate-700">使用氧氣 (+2)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500" checked={vitals.suspectedInfection} onChange={(e) => setVitals({...vitals, suspectedInfection: e.target.checked})} />
                    <span className="text-sm font-bold text-slate-700">疑似感染</span>
                  </label>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Infection Clue Level</label>
                  <select 
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                    value={vitals.infectionLevel}
                    onChange={(e) => setVitals({...vitals, infectionLevel: e.target.value as any})}
                  >
                    <option value="None">None</option>
                    <option value="Possible">Possible</option>
                    <option value="Strong">Strong</option>
                  </select>
                </div>
              </div>
            </section>

            {/* AI Parser Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                <FileText size={20} className="text-blue-500" />
                AI SOAP 解析器
              </h2>
              <textarea 
                className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="在此貼上醫師 SOAP 紀錄..."
                value={soapText}
                onChange={(e) => setSoapText(e.target.value)}
              />
              <div className="mt-4 flex gap-3">
                <button 
                  onClick={parseWithAI}
                  disabled={isParsing || !soapText.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                >
                  {isParsing ? <Activity size={18} className="animate-spin" /> : <Search size={18} />}
                  {isParsing ? "AI 解析中..." : "AI 自動解析病歷"}
                </button>
                <button onClick={() => setSoapText('')} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: Results (1/4 width) */}
          <div className="space-y-6">
            <section className={`rounded-3xl border-2 p-8 transition-all duration-500 ${riskLevel.bg} ${riskLevel.border} shadow-xl`}>
              <div className="text-center space-y-4">
                <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${riskLevel.text}`}>
                  NEWS2 Score
                </h3>
                
                <div className="text-8xl font-black tabular-nums leading-none py-4">
                  <span className={riskLevel.text}>{totalScore}</span>
                </div>

                <div className={`py-2 px-6 rounded-full inline-block font-black text-white ${riskLevel.color}`}>
                  {riskLevel.label}
                </div>

                <div className="pt-6 grid grid-cols-2 gap-2 text-left border-t border-slate-200/50">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Sepsis Flag</div>
                  <div className={`text-[10px] font-black uppercase text-right ${possibleSepsis === 'Yes' ? 'text-red-600' : 'text-slate-400'}`}>
                    {possibleSepsis}
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button 
                  onClick={copyToExcel}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {copySuccess ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Copy size={18} />}
                  {copySuccess ? "已複製 (Tab)" : "複製 Excel 格式"}
                </button>
                <button 
                  onClick={downloadCSV}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Download size={18} />
                  下載 CSV 檔案
                </button>
                <button 
                  onClick={reset}
                  className="w-full py-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-xl font-bold text-xs transition-all"
                >
                  清除
                </button>
              </div>
            </section>
          </div>

        </div>

        {/* Footer Info */}
        <footer className="text-center py-6 text-slate-400 text-[10px] font-medium uppercase tracking-widest">
          臺中醫院急診部 - NEWS2 & Sepsis Parser v2.0
        </footer>
      </div>
    </div>
  );
}

// --- Subcomponents ---

function VitalInput({ label, icon, value, onChange, unit, step = 1, score }: { 
  label: string, 
  icon: React.ReactNode, 
  value: number | null, 
  onChange: (v: number | null) => void,
  unit: string,
  step?: number,
  score: number
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          {icon} {label}
        </label>
        {value !== null && score > 0 && (
          <span className="text-[9px] font-black px-1.5 rounded-sm bg-red-100 text-red-600">
            +{score}
          </span>
        )}
      </div>
      <div className="relative">
        <input 
          type="number" 
          step={step}
          value={value === null ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="--"
          className={`w-full p-2.5 bg-slate-50 border rounded-xl text-base font-bold outline-none transition-all focus:ring-2 focus:ring-blue-500 ${score > 0 ? 'border-red-200 text-red-700' : 'border-slate-200'}`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 uppercase">
          {unit}
        </span>
      </div>
    </div>
  );
}
