import React, { useEffect, useState, useCallback } from "react";

type Status = "issue" | "reply" | "review" | "close";
type UserRole = "admin" | "evaluator" | "pjmo" | "viewer";
type View = "dashboard" | "rally" | "ai" | "audit" | "webhook";

interface ReviewLog {
  id: number; author: string; role: string; comment: string;
  status: Status; version: number;
  confirmed_by: string | null; confirmed_at: string | null; created_at: string;
}
interface Project { id: number; name: string; description: string; }
interface AuditEntry { user_name: string; action: string; target_table: string; target_id: number; created_at: string; }
interface WebhookLog { id: number; event_type: string; status: string; created_at: string; sent_at: string | null; }

// process.env は Vite の define で展開される
const API = (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) || "http://localhost:8000";

const SC: Record<Status, { label: string; color: string; bg: string; border: string; hex: string }> = {
  issue:  { label: "指摘",   color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5", hex: "#ef4444" },
  reply:  { label: "回答",   color: "#15803d", bg: "#f0fdf4", border: "#86efac", hex: "#22c55e" },
  review: { label: "再評価", color: "#92400e", bg: "#fffbeb", border: "#fcd34d", hex: "#f59e0b" },
  close:  { label: "確定",   color: "#475569", bg: "#f8fafc", border: "#cbd5e1", hex: "#94a3b8" },
};
const RC: Record<string, { icon: string; accent: string }> = {
  "評価者": { icon: "◈", accent: "#1e3a8a" },
  "PJMO":   { icon: "◇", accent: "#166534" },
  "AI":     { icon: "◆", accent: "#6b21a8" },
};
const NAV: { key: View; icon: string; label: string }[] = [
  { key: "dashboard", icon: "▦", label: "ダッシュボード" },
  { key: "rally",     icon: "⇄", label: "レビューラリー" },
  { key: "ai",        icon: "◈", label: "AI自動レビュー" },
  { key: "audit",     icon: "≡", label: "監査ログ" },
  { key: "webhook",   icon: "⬡", label: "通知履歴" },
];

const S: Record<string, React.CSSProperties> = {
  input: { padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 6,
           fontSize: 13, fontFamily: "'Noto Sans JP',sans-serif", background: "#fafafa" },
};

function Badge({ s }: { s: Status }) {
  const c = SC[s];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: c.color, background: c.bg,
                   border: `1px solid ${c.border}`, borderRadius: 4,
                   padding: "1px 7px", fontFamily: "monospace", letterSpacing: 0.5 }}>{c.label}</span>
  );
}

function KpiCard({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "18px 20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                  borderTop: `3px solid ${color}`, flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "#475569" }}>{label}</span>
        <span style={{ fontFamily: "monospace", color, fontWeight: 700 }}>{count}件 ({pct}%)</span>
      </div>
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function LogEntry({ log, canConfirm, canNotify, onClose, onConfirm, onNotify }: {
  log: ReviewLog; canConfirm: boolean; canNotify: boolean;
  onClose(id: number): void; onConfirm(id: number): void; onNotify(id: number): void;
}) {
  const sc = SC[log.status] ?? SC.issue;
  const rc = RC[log.role] ?? { icon: "○", accent: "#64748b" };
  return (
    <div style={{ borderLeft: `3px solid ${rc.accent}`, background: sc.bg,
                  borderRadius: "0 8px 8px 0", padding: "13px 16px", marginBottom: 8,
                  position: "relative", boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  opacity: log.status === "close" ? 0.6 : 1, transition: "opacity 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
        <span style={{ color: rc.accent, fontSize: 16, fontFamily: "monospace" }}>{rc.icon}</span>
        <span style={{ fontWeight: 700, color: rc.accent, fontSize: 13 }}>{log.role}</span>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{log.author}</span>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8",
                       background: "#f1f5f9", border: "1px solid #e2e8f0",
                       borderRadius: 3, padding: "1px 5px" }}>v{log.version}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
          <Badge s={log.status} />
          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{log.created_at}</span>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: "#1e293b", whiteSpace: "pre-wrap" }}>{log.comment}</p>
      {log.confirmed_by && (
        <div style={{ marginTop: 7, fontSize: 11, color: "#64748b" }}>
          ✓ {log.confirmed_by} が確定（{log.confirmed_at}）
        </div>
      )}
      {log.status !== "close" && (
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }}>
          {canNotify  && <Btn color="#0ea5e9" title="通知" onClick={() => onNotify(log.id)}>📡</Btn>}
          {canConfirm && <Btn color="#16a34a" title="確定" onClick={() => onConfirm(log.id)}>✓</Btn>}
          <Btn color="#94a3b8" title="クローズ" onClick={() => onClose(log.id)}>✕</Btn>
        </div>
      )}
    </div>
  );
}

function Btn({ color, title, onClick, children }: React.PropsWithChildren<{ color: string; title?: string; onClick(): void }>) {
  return (
    <button onClick={onClick} title={title} style={{ background: "none", border: `1px solid ${color}`,
      borderRadius: 4, cursor: "pointer", color, fontSize: 11, padding: "2px 6px", fontWeight: 700 }}>
      {children}
    </button>
  );
}

function FormRow({ label, children, flex }: React.PropsWithChildren<{ label: string; flex?: number }>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex }}>
      <label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: 0.5 }}>{label}</label>
      {children}
    </div>
  );
}

function Dashboard({ logs, onNav }: { logs: ReviewLog[]; onNav(v: View): void }) {
  const total = logs.length;
  const issue  = logs.filter(l => l.status === "issue").length;
  const reply  = logs.filter(l => l.status === "reply").length;
  const review = logs.filter(l => l.status === "review").length;
  const closed = logs.filter(l => l.status === "close").length;
  const open   = total - closed;
  const closeRate = total > 0 ? Math.round(closed / total * 100) : 0;
  const maxVer = logs.length > 0 ? Math.max(...logs.map(l => l.version)) : 0;
  const recent = [...logs].reverse().slice(0, 5);

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 18px" }}>ダッシュボード</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KpiCard label="総スレッド"    value={total}        color="#475569" />
        <KpiCard label="未解決指摘"    value={issue}        color="#ef4444" sub="対応が必要" />
        <KpiCard label="オープン"      value={open}         color="#f59e0b" />
        <KpiCard label="確定済み"      value={closed}       color="#22c55e" sub={`${closeRate}% 完了`} />
        <KpiCard label="最新バージョン" value={`v${maxVer}`} color="#6366f1" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 14 }}>種別分布</div>
          <MiniBar label="指摘 (issue)"    count={issue}  total={total} color="#ef4444" />
          <MiniBar label="回答 (reply)"    count={reply}  total={total} color="#22c55e" />
          <MiniBar label="再評価 (review)" count={review} total={total} color="#f59e0b" />
          <MiniBar label="確定 (close)"    count={closed} total={total} color="#94a3b8" />
        </div>
        <div style={{ background: "#fff", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 14 }}>処理状況</div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, justifyContent: "center", padding: "8px 0" }}>
            <div style={{ position: "relative", width: 100, height: 100 }}>
              <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)", width: 100, height: 100 }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                {total > 0 && (
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="3.5"
                    strokeDasharray={`${closeRate} ${100 - closeRate}`} strokeLinecap="round" />
                )}
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>{closeRate}%</span>
                <span style={{ fontSize: 9, color: "#94a3b8" }}>完了率</span>
              </div>
            </div>
            <div style={{ fontSize: 12 }}>
              {([["確定済み", closed, "#22c55e"], ["未対応", open, "#f59e0b"]] as const).map(([l, v, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />
                  <span style={{ color: "#475569" }}>{l}</span>
                  <span style={{ fontWeight: 700, color: c, fontFamily: "monospace", marginLeft: "auto" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>直近アクティビティ（5件）</span>
          <button onClick={() => onNav("rally")} style={{ background: "none", border: "1px solid #e2e8f0",
            borderRadius: 5, fontSize: 11, color: "#64748b", padding: "3px 10px", cursor: "pointer" }}>
            すべて表示 →
          </button>
        </div>
        {recent.length === 0
          ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 13 }}>データなし</div>
          : recent.map(log => {
              const rc2 = RC[log.role] ?? { icon: "○", accent: "#64748b" };
              return (
                <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: 10,
                                           padding: "9px 0", borderBottom: "1px solid #f8fafc" }}>
                  <span style={{ color: rc2.accent, fontFamily: "monospace", fontSize: 15, marginTop: 1 }}>{rc2.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: rc2.accent }}>{log.role}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{log.author}</span>
                      <Badge s={log.status} />
                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto", fontFamily: "monospace" }}>{log.created_at}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#475569", overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.comment}</p>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(1);
  const [logs, setLogs]   = useState<ReviewLog[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [hooks, setHooks] = useState<WebhookLog[]>([]);
  const [view, setView]   = useState<View>("dashboard");
  const [comment, setComment] = useState("");
  const [author, setAuthor]   = useState("山田主任");
  const [role,   setRole]     = useState("PJMO");
  const [status, setStatus]   = useState<Status>("reply");
  const [aiText, setAiText]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>("pjmo");
  const [toast, setToast]   = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(true);

  const canConfirm = currentRole === "admin" || currentRole === "evaluator";
  const canExport  = currentRole === "admin" || currentRole === "evaluator";
  const canNotify  = currentRole === "admin" || currentRole === "pjmo";

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const headers = () => ({ "X-User-Name": author, "X-User-Role": currentRole });

  const loadProjects = useCallback(() => {
    fetch(`${API}/projects/`).then(r => r.json()).then(setProjects).catch(console.error);
  }, []);
  const loadLogs = useCallback(() => {
    fetch(`${API}/review/${projectId}`, { headers: headers() })
      .then(r => r.json()).then(setLogs).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentRole]);
  const loadAudit = useCallback(() => {
    fetch(`${API}/review/${projectId}/audit`, { headers: headers() })
      .then(r => r.json()).then(setAudit).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentRole]);
  const loadHooks = useCallback(() => {
    fetch(`${API}/notify/logs/${projectId}`, { headers: headers() })
      .then(r => r.json()).then(setHooks).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentRole]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { if (view === "audit")   loadAudit(); }, [view, loadAudit]);
  useEffect(() => { if (view === "webhook") loadHooks(); }, [view, loadHooks]);

  const sendComment = () => {
    if (!comment.trim()) return;
    setLoading(true);
    fetch(`${API}/review/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ project_id: projectId, author, role, comment, status }),
    }).then(() => { setComment(""); loadLogs(); showToast("送信しました"); })
      .finally(() => setLoading(false));
  };
  const closeLog = (id: number) => {
    fetch(`${API}/review/${id}`, { method: "DELETE", headers: headers() })
      .then(() => { loadLogs(); showToast("クローズしました"); });
  };
  const confirmLog = (id: number) => {
    fetch(`${API}/review/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ confirmed_by: author }),
    }).then(() => { loadLogs(); showToast("評価を確定しました"); });
  };
  const notifyLog = (id: number) => {
    fetch(`${API}/notify/review/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json", ...headers() },
    }).then(() => showToast("通知を送信しました（Agent Card形式）"));
  };
  const sendAi = () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    fetch(`${API}/review/auto`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ project_id: projectId, text: aiText }),
    })
      .then(r => r.json())
      .then(() => { setAiText(""); setView("rally"); loadLogs(); showToast("AIレビューを登録しました"); })
      .catch(e => alert("AI APIエラー: " + e.message))
      .finally(() => setAiLoading(false));
  };
  const exportFile = (type: "excel" | "pdf") => {
    fetch(`${API}/export/${projectId}/${type}`, { headers: headers() })
      .then(r => { if (!r.ok) throw new Error("エクスポートエラー"); return r.blob(); })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `review_pj${projectId}.${type === "excel" ? "xlsx" : "pdf"}`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`${type.toUpperCase()} をダウンロードしました`);
      }).catch(e => alert(e.message));
  };

  const issueCount = logs.filter(l => l.status === "issue").length;
  const currentProject = projects.find(p => p.id === projectId);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Noto Sans JP',sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#0f172a", color: "#fff",
                      padding: "10px 20px", borderRadius: 8, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
          {toast}
        </div>
      )}
      <aside style={{ width: sideOpen ? 200 : 52, transition: "width 0.25s ease", background: "#0f172a",
                      display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
        <div style={{ height: 54, display: "flex", alignItems: "center",
                      padding: sideOpen ? "0 16px" : "0 14px", gap: 10, borderBottom: "1px solid #1e293b" }}>
          <span style={{ fontFamily: "monospace", fontSize: 13, color: "#60a5fa", fontWeight: 700, letterSpacing: 2, flexShrink: 0 }}>▦</span>
          {sideOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap" }}>PJMO Review</span>}
          <button onClick={() => setSideOpen(v => !v)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, padding: 0, flexShrink: 0 }}>
            {sideOpen ? "◀" : "▶"}
          </button>
        </div>
        <nav style={{ padding: "12px 0", flex: 1 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setView(n.key)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
                       padding: sideOpen ? "9px 16px" : "9px 14px",
                       background: view === n.key ? "#1e293b" : "none", border: "none", cursor: "pointer",
                       borderLeft: view === n.key ? "3px solid #60a5fa" : "3px solid transparent",
                       color: view === n.key ? "#e2e8f0" : "#64748b",
                       fontSize: 13, fontFamily: "'Noto Sans JP',sans-serif",
                       transition: "all 0.15s", textAlign: "left" }}>
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 54, background: "#fff", borderBottom: "1px solid #e2e8f0",
                         display: "flex", alignItems: "center", padding: "0 20px", gap: 14,
                         boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <select value={projectId} onChange={e => setProjectId(Number(e.target.value))}
            style={{ ...S.input, minWidth: 240, fontSize: 13 }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {currentProject && <span style={{ fontSize: 11, color: "#94a3b8" }}>{currentProject.description}</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {issueCount > 0 && (
              <span style={{ background: "#dc2626", color: "#fff", borderRadius: 12,
                             padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                ⚠ 未解決指摘 {issueCount}件
              </span>
            )}
            {canExport && (<>
              <button onClick={() => exportFile("excel")} style={exportBtn("#16a34a")}>↓ Excel</button>
              <button onClick={() => exportFile("pdf")}   style={exportBtn("#dc2626")}>↓ PDF</button>
            </>)}
          </div>
        </header>
        <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {view === "dashboard" && <Dashboard logs={logs} onNav={setView} />}
          {view === "rally" && (
            <div>
              <h2 style={h2}>レビューラリー</h2>
              <div style={card}>
                {logs.length === 0
                  ? <div style={empty}>レビュー履歴がありません</div>
                  : logs.map(log => (
                      <LogEntry key={log.id} log={log}
                        canConfirm={canConfirm} canNotify={canNotify}
                        onClose={closeLog} onConfirm={confirmLog} onNotify={notifyLog} />
                    ))}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 18, marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <FormRow label="氏名" flex={1}><input value={author} onChange={e => setAuthor(e.target.value)} style={{ ...S.input, minWidth: 100 }} /></FormRow>
                    <FormRow label="役割"><select value={role} onChange={e => setRole(e.target.value)} style={S.input}><option value="PJMO">PJMO</option><option value="評価者">評価者</option></select></FormRow>
                    <FormRow label="種別"><select value={status} onChange={e => setStatus(e.target.value as Status)} style={S.input}><option value="issue">指摘</option><option value="reply">回答</option><option value="review">再評価</option><option value="close">確定</option></select></FormRow>
                  </div>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="コメントを入力..." rows={4}
                    style={{ ...S.input, width: "100%", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", marginBottom: 10 }} />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={sendComment} disabled={loading || !comment.trim()} style={primaryBtn(loading || !comment.trim())}>
                      {loading ? "送信中..." : "送信"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {view === "ai" && (
            <div>
              <h2 style={h2}>AI自動レビュー</h2>
              <div style={card}>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.75, margin: "0 0 14px" }}>
                  調達仕様書・見積書のテキストを貼り付けると、DS-110/DS-910の観点からClaudeが自動レビューし、
                  指摘事項をラリーに登録します。
                </p>
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6,
                              padding: "9px 14px", marginBottom: 14, fontSize: 11, color: "#92400e" }}>
                  ⚠ docker-compose の ollama サービスが起動している必要があります（モデル変更: OLLAMA_MODEL 環境変数）
                </div>
                <textarea value={aiText} onChange={e => setAiText(e.target.value)}
                  placeholder="調達仕様書・見積書・要件定義書等を貼り付けてください" rows={10}
                  style={{ ...S.input, width: "100%", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", marginBottom: 12 }} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={sendAi} disabled={aiLoading || !aiText.trim()}
                    style={{ ...primaryBtn(aiLoading || !aiText.trim()), background: aiLoading || !aiText.trim() ? "#cbd5e1" : "#7c3aed" }}>
                    {aiLoading ? "AIレビュー中..." : "🤖 AIレビュー実行"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {view === "audit" && (
            <div>
              <h2 style={h2}>監査ログ</h2>
              <div style={card}>
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>全操作の記録（直近100件）</p>
                {audit.length === 0
                  ? <div style={empty}>ログなし</div>
                  : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["日時", "ユーザー", "操作", "対象テーブル", "対象ID"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left",
                                                 borderBottom: "2px solid #e2e8f0", fontWeight: 700, color: "#475569" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {audit.map((a, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11 }}>{a.created_at}</span></td>
                            <td style={td}>{a.user_name}</td>
                            <td style={td}><code style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>{a.action}</code></td>
                            <td style={td}>{a.target_table}</td>
                            <td style={td}>{a.target_id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            </div>
          )}
          {view === "webhook" && (
            <div>
              <h2 style={h2}>通知履歴（MCP/Webhook）</h2>
              <div style={card}>
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
                  Agent Card形式（JSON-LD）でのWebhook送信履歴
                </p>
                {hooks.length === 0
                  ? <div style={empty}>送信履歴なし（ラリー画面の 📡 ボタンで送信できます）</div>
                  : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["ID", "イベント", "ステータス", "作成日時", "送信日時"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left",
                                                 borderBottom: "2px solid #e2e8f0", fontWeight: 700, color: "#475569" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hooks.map(w => (
                          <tr key={w.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={td}>{w.id}</td>
                            <td style={td}><code style={{ background: "#f0fdf4", padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>{w.event_type}</code></td>
                            <td style={td}><span style={{ color: w.status === "sent" ? "#16a34a" : "#dc2626", fontWeight: 700, fontSize: 11 }}>{w.status}</span></td>
                            <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11 }}>{w.created_at}</span></td>
                            <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11 }}>{w.sent_at ?? "—"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: "22px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" };
const empty: React.CSSProperties = { textAlign: "center", color: "#94a3b8", padding: "36px 0", fontSize: 14 };
const td: React.CSSProperties = { padding: "8px 10px", color: "#334155" };
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#cbd5e1" : "#0f172a", color: "#fff", border: "none", borderRadius: 6,
  padding: "9px 24px", fontSize: 13, fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer", fontFamily: "'Noto Sans JP',sans-serif",
});
const exportBtn = (color: string): React.CSSProperties => ({
  background: "none", border: `1px solid ${color}`, color, borderRadius: 5,
  padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
  fontFamily: "'Noto Sans JP',sans-serif",
});
