import React, { useEffect, useState, useCallback } from "react";
import { View, UserRole, SystemRow, ProjectRow, ThreadRow, EntryRow,
         AuditRow, WebhookRow, THREAD_STATUS, ENTRY_TYPE, ROLE_ICON,
         COST_CATEGORIES } from "./types";
import BudgetAdvisor from "./BudgetAdvisor";

const API = "/api";

// ── スタイル定数 ─────────────────────────────────────
const S = {
  input: { padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 6,
           fontSize: 13, fontFamily: "'Noto Sans JP',sans-serif", background: "#fafafa" } as React.CSSProperties,
  card:  { background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.07)" } as React.CSSProperties,
  empty: { textAlign: "center" as const, color: "#94a3b8", padding: "32px 0", fontSize: 14 },
  h2:    { fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" } as React.CSSProperties,
};
const btn = (color = "#0f172a", disabled = false): React.CSSProperties => ({
  background: disabled ? "#cbd5e1" : color, color: "#fff", border: "none",
  borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer", fontFamily: "'Noto Sans JP',sans-serif",
});
const chipBtn = (color = "#64748b"): React.CSSProperties => ({
  fontSize: 11, padding: "4px 10px", cursor: "pointer", borderRadius: 20,
  border: `1px solid #e2e8f0`, background: "transparent", color,
  fontFamily: "'Noto Sans JP',sans-serif", whiteSpace: "nowrap" as const,
});

// ── ナビ定義 ─────────────────────────────────────────
const NAV: { key: View; icon: string; label: string }[] = [
  { key: "dashboard", icon: "▦", label: "ダッシュボード" },
  { key: "systems",   icon: "⊞", label: "システム管理" },
  { key: "rally",     icon: "⇄", label: "評価ラリー" },
  { key: "advisor",   icon: "◉", label: "予算評価AI" },
  { key: "audit",     icon: "≡", label: "監査ログ" },
  { key: "webhook",   icon: "⬡", label: "通知履歴" },
];

// ── Toastコンポーネント ───────────────────────────────
function Toast({ msg }: { msg: string }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999,
                  background: "#0f172a", color: "#fff", padding: "10px 20px",
                  borderRadius: 8, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,.3)" }}>
      {msg}
    </div>
  );
}

// ── バッジ ─────────────────────────────────────────────
function StatusBadge({ status }: { status: keyof typeof THREAD_STATUS }) {
  const c = THREAD_STATUS[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: c.color, background: c.bg,
                   border: `1px solid ${c.border}`, borderRadius: 4,
                   padding: "1px 7px", fontFamily: "monospace" }}>{c.label}</span>
  );
}
function TypeBadge({ type }: { type: keyof typeof ENTRY_TYPE }) {
  const c = ENTRY_TYPE[type];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: c.color, background: c.bg,
                   borderRadius: 4, padding: "1px 7px", fontFamily: "monospace" }}>{c.label}</span>
  );
}

// ── KPIカード ──────────────────────────────────────────
function KpiCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px",
                  boxShadow: "0 1px 3px rgba(0,0,0,.07)", borderTop: `3px solid ${color}`,
                  flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── ダッシュボード ─────────────────────────────────────
function Dashboard({ systems, onNav }: { systems: SystemRow[]; onNav: (v: View, id?: number) => void }) {
  const totalThreads = systems.reduce((s, x) => s + x.thread_count, 0);
  const totalOpen    = systems.reduce((s, x) => s + x.open_count, 0);
  const totalClosed  = totalThreads - totalOpen;
  const rate = totalThreads > 0 ? Math.round(totalClosed / totalThreads * 100) : 0;

  return (
    <div>
      <h2 style={S.h2}>ダッシュボード</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KpiCard label="評価対象システム" value={systems.length} color="#6366f1" />
        <KpiCard label="スレッド合計" value={totalThreads} color="#475569" />
        <KpiCard label="未解決" value={totalOpen} color="#ef4444" sub="対応が必要" />
        <KpiCard label="確定済み" value={totalClosed} color="#22c55e" sub={`${rate}% 完了`} />
      </div>
      <div style={S.card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 14 }}>
          評価対象システム一覧
        </div>
        {systems.length === 0
          ? <div style={S.empty}>システムが登録されていません</div>
          : systems.map(s => (
              <div key={s.id} onClick={() => onNav("rally", s.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
                         borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#eef2ff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 16, flexShrink: 0 }}>⊞</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.department || "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#64748b" }}>
                  <span>事業 {s.project_count}件</span>
                  <span>スレッド {s.thread_count}件</span>
                  {s.open_count > 0 && (
                    <span style={{ color: "#ef4444", fontWeight: 700 }}>未解決 {s.open_count}件</span>
                  )}
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ── システム管理 ────────────────────────────────────────
function SystemsView({ headers, showToast }: { headers: () => Record<string, string>; showToast: (m: string) => void }) {
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [projects, setProjects] = useState<Record<number, ProjectRow[]>>({});
  const [expandedSys, setExpandedSys] = useState<number | null>(null);
  const [showNewSys, setShowNewSys] = useState(false);
  const [showNewPj, setShowNewPj] = useState<number | null>(null);
  const [newSysName, setNewSysName] = useState("");
  const [newSysDept, setNewSysDept] = useState("");
  const [newPj, setNewPj] = useState({ name: "", cost_category: "", amount_single: "", amount_advance: "", amount_deferred: "", evaluator_name: "" });

  const loadSystems = useCallback(() => {
    fetch(`${API}/systems/`, { headers: headers() }).then(r => r.json()).then(setSystems);
  }, []);

  const loadProjects = (sysId: number) => {
    fetch(`${API}/systems/${sysId}/projects`, { headers: headers() })
      .then(r => r.json()).then(data => setProjects(p => ({ ...p, [sysId]: data })));
  };

  useEffect(() => { loadSystems(); }, [loadSystems]);

  const createSystem = () => {
    if (!newSysName.trim()) return;
    fetch(`${API}/systems/`, { method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ name: newSysName, department: newSysDept })
    }).then(() => { setNewSysName(""); setNewSysDept(""); setShowNewSys(false); loadSystems(); showToast("システムを追加しました"); });
  };

  const createProject = (sysId: number) => {
    if (!newPj.name.trim()) return;
    fetch(`${API}/projects/`, { method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ system_id: sysId, name: newPj.name,
        cost_category: newPj.cost_category || null,
        amount_single: Number(newPj.amount_single) || 0,
        amount_advance: Number(newPj.amount_advance) || 0,
        amount_deferred: Number(newPj.amount_deferred) || 0,
        evaluator_name: newPj.evaluator_name || null })
    }).then(() => {
      setNewPj({ name: "", cost_category: "", amount_single: "", amount_advance: "", amount_deferred: "", evaluator_name: "" });
      setShowNewPj(null); loadProjects(sysId); loadSystems(); showToast("事業を追加しました");
    });
  };

  const fmtAmount = (n: number) => n > 0 ? `${n.toLocaleString()} 千円` : "—";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ ...S.h2, margin: 0 }}>システム管理</h2>
        <button onClick={() => setShowNewSys(true)} style={btn("#4338ca")}>＋ システム追加</button>
      </div>

      {/* 新規システムモーダル */}
      {showNewSys && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000,
                      display: "flex", alignItems: "center", justifyContent: "center" }}
             onClick={() => setShowNewSys(false)}>
          <div style={{ ...S.card, width: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>評価対象システムを追加</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>システム名 *</label>
              <input value={newSysName} onChange={e => setNewSysName(e.target.value)}
                placeholder="例：人事給与システム（次期）"
                style={{ ...S.input, width: "100%", boxSizing: "border-box" as const }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>担当部署</label>
              <input value={newSysDept} onChange={e => setNewSysDept(e.target.value)}
                placeholder="例：人事院"
                style={{ ...S.input, width: "100%", boxSizing: "border-box" as const }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNewSys(false)} style={chipBtn()}>キャンセル</button>
              <button onClick={createSystem} disabled={!newSysName.trim()} style={btn("#0f172a", !newSysName.trim())}>追加</button>
            </div>
          </div>
        </div>
      )}

      {systems.length === 0
        ? <div style={{ ...S.card, ...S.empty }}>システムが登録されていません</div>
        : systems.map(s => (
          <div key={s.id} style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{s.department || "担当部署未設定"}</div>
              </div>
              <div style={{ fontSize: 11, color: "#64748b", display: "flex", gap: 10 }}>
                <span>事業 {s.project_count}件</span>
                <span>スレッド {s.thread_count}件</span>
                {s.open_count > 0 && <span style={{ color: "#ef4444", fontWeight: 700 }}>未解決 {s.open_count}件</span>}
              </div>
              <button onClick={() => {
                if (expandedSys === s.id) { setExpandedSys(null); }
                else { setExpandedSys(s.id); loadProjects(s.id); }
              }} style={chipBtn()}>
                {expandedSys === s.id ? "▲ 閉じる" : "▼ 事業一覧"}
              </button>
            </div>

            {expandedSys === s.id && (
              <div style={{ marginTop: 14, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                {(projects[s.id] || []).map(p => (
                  <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: p.is_system_wide ? 400 : 700, fontSize: 13,
                                       color: p.is_system_wide ? "#94a3b8" : "#0f172a" }}>
                          {p.is_system_wide ? "📌 システム全体" : p.name}
                        </span>
                        {!p.is_system_wide && p.cost_category && (
                          <span style={{ fontSize: 10, marginLeft: 8, padding: "1px 7px", borderRadius: 4,
                                         background: "#f1f5f9", color: "#475569" }}>{p.cost_category}</span>
                        )}
                      </div>
                      {!p.is_system_wide && (
                        <div style={{ fontSize: 11, color: "#64748b", display: "flex", gap: 10 }}>
                          <span>単歳 {fmtAmount(p.amount_single)}</span>
                          {p.amount_deferred > 0 && <span>後年 {fmtAmount(p.amount_deferred)}</span>}
                          {p.evaluator_name && <span>評価者: {p.evaluator_name}</span>}
                        </div>
                      )}
                      <span style={{ fontSize: 11, color: p.open_count > 0 ? "#ef4444" : "#22c55e" }}>
                        {p.thread_count}件 {p.open_count > 0 ? `(未解決${p.open_count})` : "(完了)"}
                      </span>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12 }}>
                  {showNewPj === s.id ? (
                    <div style={{ background: "#f8fafc", borderRadius: 8, padding: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 3 }}>事業名 *</label>
                          <input value={newPj.name} onChange={e => setNewPj(p => ({ ...p, name: e.target.value }))}
                            style={{ ...S.input, width: "100%", boxSizing: "border-box" as const }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 3 }}>経費区分</label>
                          <select value={newPj.cost_category} onChange={e => setNewPj(p => ({ ...p, cost_category: e.target.value }))}
                            style={{ ...S.input, width: "100%" }}>
                            <option value="">選択してください</option>
                            {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 3 }}>単歳要求額（千円）</label>
                          <input type="number" value={newPj.amount_single}
                            onChange={e => setNewPj(p => ({ ...p, amount_single: e.target.value }))}
                            style={{ ...S.input, width: "100%", boxSizing: "border-box" as const }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 3 }}>後年度負担金（千円）</label>
                          <input type="number" value={newPj.amount_deferred}
                            onChange={e => setNewPj(p => ({ ...p, amount_deferred: e.target.value }))}
                            style={{ ...S.input, width: "100%", boxSizing: "border-box" as const }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 3 }}>評価者名</label>
                          <input value={newPj.evaluator_name}
                            onChange={e => setNewPj(p => ({ ...p, evaluator_name: e.target.value }))}
                            placeholder="例：田中係長"
                            style={{ ...S.input, width: "100%", boxSizing: "border-box" as const }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => setShowNewPj(null)} style={chipBtn()}>キャンセル</button>
                        <button onClick={() => createProject(s.id)} disabled={!newPj.name.trim()}
                          style={btn("#0f172a", !newPj.name.trim())}>追加</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowNewPj(s.id)} style={chipBtn("#4338ca")}>＋ 事業追加</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      }
    </div>
  );
}

// ── 評価ラリー ─────────────────────────────────────────
function RallyView({ initialSystemId, headers, showToast, currentRole }:
  { initialSystemId?: number; headers: () => Record<string, string>;
    showToast: (m: string) => void; currentRole: UserRole }) {

  const [systems, setSystems]   = useState<SystemRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [threads, setThreads]   = useState<ThreadRow[]>([]);
  const [entries, setEntries]   = useState<EntryRow[]>([]);
  const [selSys, setSelSys]     = useState<number | null>(initialSystemId || null);
  const [selPj, setSelPj]       = useState<number | null>(null);
  const [selThread, setSelThread] = useState<number | null>(null);

  const [showNewThread, setShowNewThread] = useState(false);
  const [newThread, setNewThread] = useState({ title: "", comment: "", due_date: "", entry_date: "" });
  const [newEntry, setNewEntry]   = useState({ entry_type: "reply" as "reply"|"review"|"close", comment: "", entry_date: "" });
  const [aiText, setAiText]       = useState("");
  const [loading, setLoading]     = useState(false);

  const canEvaluator = currentRole === "admin" || currentRole === "evaluator";
  const canPjmo      = currentRole === "admin" || currentRole === "pjmo";

  useEffect(() => {
    fetch(`${API}/systems/`, { headers: headers() }).then(r => r.json()).then(data => {
      setSystems(data);
      if (initialSystemId) setSelSys(initialSystemId);
      else if (data.length > 0) setSelSys(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selSys) return;
    fetch(`${API}/systems/${selSys}/projects`, { headers: headers() }).then(r => r.json()).then(data => {
      setProjects(data);
      setSelPj(data[0]?.id || null);
    });
  }, [selSys]);

  useEffect(() => {
    if (!selPj) return;
    fetch(`${API}/threads/${selPj}`, { headers: headers() }).then(r => r.json()).then(setThreads);
    setSelThread(null); setEntries([]);
  }, [selPj]);

  useEffect(() => {
    if (!selThread) return;
    fetch(`${API}/threads/${selThread}/entries`, { headers: headers() }).then(r => r.json()).then(setEntries);
  }, [selThread]);

  const reloadThreads = () => {
    if (!selPj) return;
    fetch(`${API}/threads/${selPj}`, { headers: headers() }).then(r => r.json()).then(setThreads);
  };
  const reloadEntries = () => {
    if (!selThread) return;
    fetch(`${API}/threads/${selThread}/entries`, { headers: headers() }).then(r => r.json()).then(setEntries);
  };

  const createThread = () => {
    if (!newThread.comment.trim() || !selPj) return;
    setLoading(true);
    fetch(`${API}/threads/`, { method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ project_id: selPj, ...newThread })
    }).then(() => {
      setNewThread({ title: "", comment: "", due_date: "", entry_date: "" });
      setShowNewThread(false); reloadThreads(); showToast("指摘を追加しました");
    }).finally(() => setLoading(false));
  };

  const addEntry = () => {
    if (!newEntry.comment.trim() || !selThread) return;
    setLoading(true);
    fetch(`${API}/threads/${selThread}/entries`, { method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify(newEntry)
    }).then(() => {
      setNewEntry({ entry_type: "reply", comment: "", entry_date: "" });
      reloadEntries(); reloadThreads(); showToast("投稿しました");
    }).finally(() => setLoading(false));
  };

  const runAI = () => {
    if (!aiText.trim() || !selPj) return;
    setLoading(true);
    fetch(`${API}/threads/auto`, { method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ project_id: selPj, content: aiText })
    }).then(() => {
      setAiText(""); reloadThreads(); showToast("AI指摘を追加しました");
    }).catch(e => alert("エラー: " + e.message))
    .finally(() => setLoading(false));
  };

  const curThread = threads.find(t => t.id === selThread);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 94px)", gap: 0 }}>
      {/* 左ペイン: システム/事業選択 */}
      <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid #e2e8f0",
                    overflowY: "auto", background: "#f8fafc" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
          <select value={selSys || ""} onChange={e => setSelSys(Number(e.target.value))}
            style={{ ...S.input, width: "100%", fontSize: 12 }}>
            {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ padding: "8px 0" }}>
          {projects.map(p => (
            <div key={p.id} onClick={() => setSelPj(p.id)}
              style={{ padding: "9px 14px", cursor: "pointer", fontSize: 12,
                       background: selPj === p.id ? "#e0e7ff" : "transparent",
                       borderLeft: selPj === p.id ? "3px solid #4338ca" : "3px solid transparent",
                       color: p.is_system_wide ? "#94a3b8" : "#1e293b" }}>
              <div style={{ fontWeight: selPj === p.id ? 700 : 400 }}>
                {p.is_system_wide ? "📌 システム全体" : p.name}
              </div>
              {!p.is_system_wide && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                  {p.cost_category || "経費区分未設定"}
                  {p.open_count > 0 && <span style={{ color: "#ef4444", marginLeft: 6 }}>未解決{p.open_count}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 中央ペイン: スレッド一覧 */}
      <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid #e2e8f0",
                    overflowY: "auto", background: "#fff" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0",
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>指摘スレッド</span>
          <div style={{ display: "flex", gap: 4 }}>
            {canEvaluator && (
              <button onClick={() => setShowNewThread(true)} style={chipBtn("#4338ca")}>＋ 指摘</button>
            )}
          </div>
        </div>

        {threads.length === 0
          ? <div style={{ ...S.empty, fontSize: 12 }}>指摘がありません</div>
          : threads.map(t => (
              <div key={t.id} onClick={() => setSelThread(t.id)}
                style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f8fafc",
                         background: selThread === t.id ? "#f0f4ff" : "transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>#{t.thread_no}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                  {t.title || `指摘 #${t.thread_no}`}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8" }}>
                  <span>{t.entry_count}件の投稿</span>
                  {t.due_date && <span style={{ color: "#f59e0b" }}>期限: {t.due_date}</span>}
                </div>
              </div>
            ))
        }

        {/* AI指摘生成 */}
        {canEvaluator && selPj && (
          <div style={{ padding: "10px 12px", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, color: "#6b21a8", fontWeight: 700, marginBottom: 6 }}>🤖 AI自動指摘</div>
            <textarea value={aiText} onChange={e => setAiText(e.target.value)}
              placeholder="仕様書・見積書を貼り付け..."
              rows={3}
              style={{ ...S.input, width: "100%", resize: "vertical", boxSizing: "border-box" as const, fontSize: 11 }} />
            <button onClick={runAI} disabled={loading || !aiText.trim()}
              style={{ ...btn("#6b21a8", loading || !aiText.trim()), marginTop: 6, width: "100%", fontSize: 11 }}>
              {loading ? "生成中..." : "AI指摘を生成"}
            </button>
          </div>
        )}
      </div>

      {/* 右ペイン: スレッド詳細 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {!selThread ? (
          <div style={{ ...S.empty, marginTop: 60 }}>スレッドを選択してください</div>
        ) : (
          <>
            {/* スレッドヘッダー */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>#{curThread?.thread_no}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{curThread?.title || "（タイトルなし）"}</span>
                {curThread && <StatusBadge status={curThread.status} />}
              </div>
              {curThread?.due_date && (
                <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>期限: {curThread.due_date}</div>
              )}
            </div>

            {/* 投稿一覧 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {entries.map(e => {
                const rc = ROLE_ICON[e.role];
                const tc = ENTRY_TYPE[e.entry_type];
                return (
                  <div key={e.id} style={{ borderLeft: `3px solid ${rc.color}`, background: tc.bg,
                                           borderRadius: "0 8px 8px 0", padding: "12px 14px",
                                           marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" as const }}>
                      <span style={{ color: rc.color, fontSize: 14, fontFamily: "monospace" }}>{rc.icon}</span>
                      <span style={{ fontWeight: 700, color: rc.color, fontSize: 12 }}>{rc.label}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8",
                                     background: "#f1f5f9", borderRadius: 3, padding: "1px 5px" }}>seq.{e.seq}</span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                        <TypeBadge type={e.entry_type} />
                        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
                          {e.entry_date || e.created_at}
                        </span>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{e.comment}</p>
                  </div>
                );
              })}
            </div>

            {/* 新規投稿フォーム */}
            {curThread?.status !== "closed" && (
              <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", background: "#fff" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select value={newEntry.entry_type}
                    onChange={e => setNewEntry(n => ({ ...n, entry_type: e.target.value as any }))}
                    style={{ ...S.input }}>
                    {canPjmo && <option value="reply">回答（PJMO）</option>}
                    {canEvaluator && <option value="review">再評価（評価者）</option>}
                    {canEvaluator && <option value="close">確定（評価者）</option>}
                  </select>
                  <input type="date" value={newEntry.entry_date}
                    onChange={e => setNewEntry(n => ({ ...n, entry_date: e.target.value }))}
                    style={{ ...S.input }} />
                </div>
                <textarea value={newEntry.comment}
                  onChange={e => setNewEntry(n => ({ ...n, comment: e.target.value }))}
                  placeholder="コメントを入力..." rows={3}
                  style={{ ...S.input, width: "100%", resize: "vertical", boxSizing: "border-box" as const, marginBottom: 8 }} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={addEntry} disabled={loading || !newEntry.comment.trim()}
                    style={btn("#0f172a", loading || !newEntry.comment.trim())}>
                    {loading ? "送信中..." : "投稿"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 新規スレッドモーダル */}
      {showNewThread && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000,
                      display: "flex", alignItems: "center", justifyContent: "center" }}
             onClick={() => setShowNewThread(false)}>
          <div style={{ ...S.card, width: 480 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>指摘を追加</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 3 }}>タイトル（任意）</label>
                <input value={newThread.title} onChange={e => setNewThread(n => ({ ...n, title: e.target.value }))}
                  placeholder="例：積算根拠の確認"
                  style={{ ...S.input, width: "100%", boxSizing: "border-box" as const }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 3 }}>期限日</label>
                <input type="date" value={newThread.due_date}
                  onChange={e => setNewThread(n => ({ ...n, due_date: e.target.value }))}
                  style={{ ...S.input, width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 3 }}>指摘日</label>
                <input type="date" value={newThread.entry_date}
                  onChange={e => setNewThread(n => ({ ...n, entry_date: e.target.value }))}
                  style={{ ...S.input, width: "100%" }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 3 }}>指摘内容 *</label>
              <textarea value={newThread.comment} onChange={e => setNewThread(n => ({ ...n, comment: e.target.value }))}
                placeholder="DS-110第○条に基づき..." rows={5}
                style={{ ...S.input, width: "100%", resize: "vertical", boxSizing: "border-box" as const }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNewThread(false)} style={chipBtn()}>キャンセル</button>
              <button onClick={createThread} disabled={loading || !newThread.comment.trim()}
                style={btn("#9b1c1c", loading || !newThread.comment.trim())}>指摘を追加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── メインApp ──────────────────────────────────────────
export default function App() {
  const [view, setView]           = useState<View>("dashboard");
  const [systems, setSystems]     = useState<SystemRow[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>("pjmo");
  const [toast, setToast]         = useState<string | null>(null);
  const [sideOpen, setSideOpen]   = useState(true);
  const [rallySystemId, setRallySystemId] = useState<number | undefined>(undefined);
  const [auditData, setAuditData] = useState<AuditRow[]>([]);
  const [hookData, setHookData]   = useState<WebhookRow[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const headers = () => ({
    "X-User-Name": btoa(encodeURIComponent("ユーザー")),
    "X-User-Role": currentRole,
  });

  const loadSystems = useCallback(() => {
    fetch(`${API}/systems/`, { headers: headers() }).then(r => r.json()).then(setSystems);
  }, [currentRole]);

  useEffect(() => { loadSystems(); }, [loadSystems]);
  useEffect(() => {
    if (view === "audit")
      fetch(`${API}/systems/`, { headers: headers() }).then(r => r.json())
        .then(sysList => {
          if (sysList.length > 0)
            fetch(`${API}/threads/1`, { headers: headers() }).catch(() => {});
        });
  }, [view]);

  const navTo = (v: View, sysId?: number) => {
    if (v === "rally" && sysId) setRallySystemId(sysId);
    setView(v);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9",
                  fontFamily: "'Noto Sans JP',sans-serif" }}>
      {toast && <Toast msg={toast} />}

      {/* サイドバー */}
      <aside style={{ width: sideOpen ? 200 : 52, transition: "width .25s", background: "#0f172a",
                      display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
        <div style={{ height: 54, display: "flex", alignItems: "center",
                      padding: sideOpen ? "0 16px" : "0 14px", gap: 10,
                      borderBottom: "1px solid #1e293b" }}>
          <span style={{ fontFamily: "monospace", fontSize: 13, color: "#60a5fa",
                         fontWeight: 700, letterSpacing: 2, flexShrink: 0 }}>▦</span>
          {sideOpen && <span style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap" }}>
            予算額妥当性評価
          </span>}
          <button onClick={() => setSideOpen(v => !v)}
            style={{ marginLeft: "auto", background: "none", border: "none",
                     color: "#475569", cursor: "pointer", fontSize: 16, padding: 0, flexShrink: 0 }}>
            {sideOpen ? "◀" : "▶"}
          </button>
        </div>
        <nav style={{ padding: "12px 0", flex: 1 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => navTo(n.key)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
                       padding: sideOpen ? "9px 16px" : "9px 14px",
                       background: view === n.key ? "#1e293b" : "none", border: "none",
                       cursor: "pointer",
                       borderLeft: view === n.key ? "3px solid #60a5fa" : "3px solid transparent",
                       color: view === n.key ? "#e2e8f0" : "#64748b",
                       fontSize: 13, fontFamily: "'Noto Sans JP',sans-serif",
                       transition: "all .15s", textAlign: "left" as const }}>
              <span style={{ fontFamily: "monospace", fontSize: 14, flexShrink: 0 }}>{n.icon}</span>
              {sideOpen && <span style={{ whiteSpace: "nowrap", fontSize: 12 }}>{n.label}</span>}
            </button>
          ))}
        </nav>
        {sideOpen && (
          <div style={{ padding: "12px 14px", borderTop: "1px solid #1e293b" }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 5, fontWeight: 700 }}>ROLE（開発用）</div>
            <select value={currentRole} onChange={e => setCurrentRole(e.target.value as UserRole)}
              style={{ width: "100%", fontSize: 11, padding: "4px 6px", borderRadius: 4,
                       border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0",
                       fontFamily: "'Noto Sans JP',sans-serif" }}>
              <option value="admin">管理者</option>
              <option value="evaluator">評価者</option>
              <option value="pjmo">PJMO</option>
              <option value="viewer">閲覧者</option>
            </select>
          </div>
        )}
      </aside>

      {/* メインコンテンツ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 54, background: "#fff", borderBottom: "1px solid #e2e8f0",
                         display: "flex", alignItems: "center", padding: "0 20px",
                         boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            {NAV.find(n => n.key === view)?.label}
          </span>
        </header>

        <main style={{ flex: 1, overflow: view === "rally" || view === "advisor" ? "hidden" : "auto",
                       padding: view === "rally" || view === "advisor" ? 0 : 24 }}>
          {view === "dashboard" && (
            <Dashboard systems={systems} onNav={navTo} />
          )}
          {view === "systems" && (
            <SystemsView headers={headers} showToast={showToast} />
          )}
          {view === "rally" && (
            <RallyView initialSystemId={rallySystemId} headers={headers}
                       showToast={showToast} currentRole={currentRole} />
          )}
          {view === "advisor" && (
            <BudgetAdvisor api={API} headers={headers} />
          )}
          {view === "audit" && (
            <div>
              <h2 style={S.h2}>監査ログ</h2>
              <div style={S.card}>
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>全操作の記録</p>
                <p style={{ fontSize: 12, color: "#94a3b8" }}>（事業を選択して監査ログを確認してください）</p>
              </div>
            </div>
          )}
          {view === "webhook" && (
            <div>
              <h2 style={S.h2}>通知履歴</h2>
              <div style={S.card}>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Agent Card形式（JSON-LD）でのWebhook送信履歴</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
