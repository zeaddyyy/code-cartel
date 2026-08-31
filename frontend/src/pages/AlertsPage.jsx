import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || `http://${window.location.hostname || "localhost"}:5001`;

export default function AlertsPage({ PageHeading, PanelHeader }) {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const load = async () => { try { const response = await fetch(`${API}/api/alerts?limit=100`); if (!response.ok) throw new Error("Alert service unavailable"); const data = await response.json(); setAlerts(data.data || []); setError(""); } catch (e) { setError(e.message); } };
  useEffect(() => { const initial = setTimeout(load, 0); const timer = setInterval(load, 5000); return () => { clearTimeout(initial); clearInterval(timer); }; }, []);
  const resolve = async (id) => { await fetch(`${API}/api/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RESOLVED" }) }); load(); };
  const active = alerts.filter((alert) => alert.status === "OPEN");
  return <div className="page-view"><PageHeading title="Alert center" subtitle="Real-time watchlist correlation and operational review" count={`${active.length} active`} />{error && <p className="error">{error}</p>}<section className="panel registry-panel"><PanelHeader title="Watchlist matches" action="Live event stream" /><div className="table-wrap"><table><thead><tr><th>Priority</th><th>Alert</th><th>Evidence</th><th>Time</th><th>Action</th></tr></thead><tbody>{alerts.map((alert) => <tr key={alert.id}><td><b>{alert.priority}</b></td><td>{alert.message}</td><td>{alert.evidence_snapshot ? "Available" : "Unavailable"}</td><td>{new Date(alert.created_at).toLocaleString()}</td><td>{alert.status === "OPEN" ? <button onClick={() => resolve(alert.id)}>Resolve</button> : "Resolved"}</td></tr>)}</tbody></table>{!alerts.length && <div className="empty-state">No watchlist matches have been detected.</div>}</div></section></div>;
}
