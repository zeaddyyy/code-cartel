import { useEffect, useMemo, useState } from "react";
import "./App.css";
import GisPage from "./pages/GisPage.jsx";
import LiveWallPage from "./pages/LiveWallPage.jsx";
import AnprPage from "./pages/AnprPage.jsx";
import VehiclesPage from "./pages/VehiclesPage.jsx";
import CameraRegistryPage from "./pages/CameraRegistryPage.jsx";
import AlertsPage from "./pages/AlertsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import HealthPage from "./pages/HealthPage.jsx";
import AdministrationPage from "./pages/AdministrationPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import WatchlistPage from "./pages/WatchlistPage.jsx";
import RegionsPage from "./pages/RegionsPage.jsx";

const API = import.meta.env.VITE_API_URL || `http://${window.location.hostname || "localhost"}:5001`;
const vehicleClasses = new Set(["car", "motorcycle", "bus", "truck"]);

function snapshotUrl(snapshotPath) {
  if (!snapshotPath) return "";
  // Detection records may have been created by an isolated worker on another
  // port. Rebind the stored filename to the active backend origin.
  const filename = snapshotPath.split("/").pop();
  return `${API}/api/snapshots/${encodeURIComponent(filename)}`;
}

function EvidenceImage({ snapshotPath, alt = "Evidence snapshot", className = "table-thumb" }) {
  const [open, setOpen] = useState(false);
  if (!snapshotPath) return <span>Unavailable</span>;
  const src = snapshotUrl(snapshotPath);
  return <>
  <button className="evidence-thumb-button evidence-placeholder" type="button" onClick={() => setOpen(true)} title="Open evidence snapshot"><span className={className}>Open evidence</span></button>
    {open && <div className="evidence-modal-backdrop" role="dialog" aria-modal="true" aria-label="Full-size evidence snapshot" onClick={() => setOpen(false)}><div className="evidence-modal" onClick={(event) => event.stopPropagation()}><div className="evidence-modal-head"><b>{alt}</b><div><a href={src} target="_blank" rel="noreferrer">Open original</a><button type="button" onClick={() => setOpen(false)} aria-label="Close full-size image">×</button></div></div><img src={src} alt={alt} /><small>Click outside the image or press close to return.</small></div></div>}
  </>;
}

function Preview({ camera }) {
  const [failed, setFailed] = useState(false);
  const hlsUrl = camera.hls_url ? new URL(camera.hls_url, "https://live.corp8.cloud").toString() : "";
  if (hlsUrl && !failed) return <div className="preview-live"><video src={hlsUrl} autoPlay muted playsInline controls onError={() => setFailed(true)} /><span>LIVE PREVIEW · HLS</span></div>;
  if (camera.webrtc_url) return <div className="preview-empty">WebRTC preview available<br /><a href={camera.webrtc_url} target="_blank" rel="noreferrer">Open WHEP endpoint</a><small>Browser negotiation unavailable; AI ingestion continues independently.</small></div>;
  return <div className="preview-empty">Preview unavailable<br /><small>HLS/WebRTC endpoint unavailable</small></div>;
}

function App() {
  const [cameras, setCameras] = useState([]);
  const [detections, setDetections] = useState([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [activePage, setActivePage] = useState("Dashboard");
  const [admin, setAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem("netrax_admin_token") || "");
  const [loginOpen, setLoginOpen] = useState(false);
  const [login, setLogin] = useState({ username: "admin", password: "" });
  const [loginError, setLoginError] = useState("");
  const [cameraSearch, setCameraSearch] = useState("");
  const [cameraOffset, setCameraOffset] = useState(0);
  const [cameraForm, setCameraForm] = useState({ camera_id: "", name: "", location_name: "", latitude: "", longitude: "", rtsp_url: "", webrtc_url: "", hls_url: "" });
  const [filters, setFilters] = useState({ camera: "", object: "", confidence: "", time: "", status: "" });

  const load = async () => {
    try {
      const [cameraResponse, detectionResponse] = await Promise.all([fetch(`${API}/api/cameras`), fetch(`${API}/api/detections?limit=200`)]);
      if (!cameraResponse.ok || !detectionResponse.ok) throw new Error("Backend unavailable");
      const [cameraData, detectionData] = await Promise.all([cameraResponse.json(), detectionResponse.json()]);
      setCameras(cameraData.cameras || []); setDetections(detectionData.detections || []); setError("");
    } catch (requestError) { setError(requestError.message); localStorage.setItem("netrax_last_client_error", JSON.stringify({ source: "FRONTEND", message: requestError.message, created_at: new Date().toISOString() })); }
  };
  // Defer the first request until after mount; the interval keeps the command
  // center synchronized without blocking the initial render.
  useEffect(() => { const initialLoad = setTimeout(load, 0); const timer = setInterval(load, 5000); const clockTimer = setInterval(() => setNow(Date.now()), 60000); return () => { clearTimeout(initialLoad); clearInterval(timer); clearInterval(clockTimer); }; }, []);

  const visibleCameras = useMemo(() => cameras.filter((camera) => {
    if (filters.status && (camera.health_status || camera.status) !== filters.status) return false;
    if (cameraSearch) {
      const query = cameraSearch.toLowerCase();
      const haystack = [camera.camera_id, camera.name, camera.location_name, camera.id].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }), [cameras, filters.status, cameraSearch]);
  const visibleDetections = useMemo(() => detections.filter((detection) => {
    if (filters.camera && detection.camera_id !== filters.camera) return false;
    if (filters.object && detection.object_class !== filters.object) return false;
    if (filters.confidence && Number(detection.confidence) < Number(filters.confidence)) return false;
    if (filters.time && now - new Date(detection.detected_at).getTime() > Number(filters.time) * 60 * 1000) return false;
    return true;
  }), [detections, filters, now]);
  const classes = [...new Set(detections.map((detection) => detection.object_class))].sort();
  const online = cameras.filter((camera) => ["CONNECTED", "ONLINE"].includes(camera.health_status || camera.status)).length;
  const tracks = new Set(detections.filter((detection) => detection.track_id).map((detection) => `${detection.camera_id}:${detection.track_id}`)).size;
  const set = (key) => (event) => setFilters({ ...filters, [key]: event.target.value });
  const updateForm = (key) => (event) => setCameraForm({ ...cameraForm, [key]: event.target.value });
  const adminHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` });
  const openAdmin = () => adminToken ? (setAdmin(true), setActivePage("Administration")) : setLoginOpen(true);
  const submitLogin = async (event) => { event.preventDefault(); const response = await fetch(`${API}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(login) }); if (!response.ok) { setLoginError("Invalid username or password"); return; } const data = await response.json(); sessionStorage.setItem("netrax_admin_token", data.token); setAdminToken(data.token); setAdmin(true); setActivePage("Administration"); setLoginOpen(false); };
  const addCamera = async (event) => {
    event.preventDefault();
    const response = await fetch(`${API}/api/cameras`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ ...cameraForm, latitude: Number(cameraForm.latitude), longitude: Number(cameraForm.longitude) }) });
    if (!response.ok) { setError("Camera could not be added"); return; }
    setCameraForm({ camera_id: "", name: "", location_name: "", latitude: "", longitude: "", rtsp_url: "", webrtc_url: "", hls_url: "" }); load();
  };
  const deleteCamera = async (id) => { if (!window.confirm("Delete this camera and its dependent records?")) return; await fetch(`${API}/api/cameras/${id}`, { method: "DELETE", headers: adminHeaders() }); load(); };
  const editCamera = async (camera) => { const name = window.prompt("Camera name", camera.name || ""); if (name === null) return; await fetch(`${API}/api/cameras/${camera.id}`, { method: "PUT", headers: adminHeaders(), body: JSON.stringify({ name }) }); load(); };

  const vehicles = detections.filter((detection) => vehicleClasses.has(detection.object_class));
  const people = detections.filter((detection) => detection.object_class === "person");
  const anprReads = detections.filter((detection) => detection.plate_number);
  const speedViolations = detections.filter((detection) => detection.speed_violation === true || detection.speed_status === "REVIEW_REQUIRED");
  const activeAlerts = 0;
  const geoCameras = cameras.filter((camera) => camera.latitude !== null && camera.latitude !== undefined && camera.longitude !== null && camera.longitude !== undefined && Number.isFinite(Number(camera.latitude)) && Number.isFinite(Number(camera.longitude)));
  const latitudes = geoCameras.map((camera) => Number(camera.latitude));
  const longitudes = geoCameras.map((camera) => Number(camera.longitude));
  const minLat = latitudes.length ? Math.min(...latitudes) : 0;
  const maxLat = latitudes.length ? Math.max(...latitudes) : 1;
  const minLon = longitudes.length ? Math.min(...longitudes) : 0;
  const maxLon = longitudes.length ? Math.max(...longitudes) : 1;
  const mapPosition = (camera) => ({ left: `${10 + (Number(camera.longitude) - minLon) / Math.max(maxLon - minLon, 0.0001) * 80}%`, top: `${10 + (maxLat - Number(camera.latitude)) / Math.max(maxLat - minLat, 0.0001) * 80}%` });
  const wallStart = Math.min(cameraOffset, Math.max(0, visibleCameras.length - 9));
  const wallCameras = visibleCameras.slice(wallStart, wallStart + 9);
  const navItems = [["▦", "Dashboard"], ["▣", "Cameras"], ["▤", "Live wall"], ["⌗", "ANPR"], ["▱", "Vehicles"], ["♟", "Alerts"], ["⌖", "GIS map"], ["▥", "Analytics"], ["⌕", "Search"], ["◈", "Watchlist"], ["▤", "Reports"], ["◇", "Regions"], ["◉", "System health"], ["⚙", "Administration"]];
  return <div className="app command-shell">
    <aside className="sidebar"><div className="brand-mark"><span>⬡</span><div><strong>NetraX</strong><small>COMMAND CENTER</small></div></div><nav>{navItems.map(([icon, label]) => <button className={activePage === label ? "active" : ""} key={label} onClick={() => label === "Administration" ? openAdmin() : (setActivePage(label), setAdmin(false))}><i>{icon}</i>{label}</button>)}</nav><button className="logout" onClick={() => { setAdmin(false); setActivePage("Dashboard"); }}>↪ <span>Dashboard</span></button></aside>
    <div className="workspace">
      <header className="topbar"><button className="menu-button" aria-label="Toggle navigation">☰</button><div className="topbar-title"><b>NETRAX COMMAND CENTER</b><small>Integrated video management · Gujarat Police operations</small></div><div className="topbar-meta"><span className="clock">{new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}<small>{new Date(now).toLocaleDateString()}</small></span><span className={`system-dot ${error ? "down" : "up"}`} /> <span>{error ? "Backend offline" : "System operational"}</span><button className="icon-button" onClick={openAdmin}>{adminToken ? "Admin · secured" : "Admin login"}</button></div></header>
      <main>
      {activePage !== "Dashboard" && activePage !== "Administration" ? <PageView page={activePage} cameras={cameras} detections={detections} visibleCameras={visibleCameras} visibleDetections={visibleDetections} error={error} online={online} vehicles={vehicles} anprReads={anprReads} speedViolations={speedViolations} geoCameras={geoCameras} mapPosition={mapPosition} /> : activePage === "Administration" ? <AdministrationPage cameras={cameras} cameraForm={cameraForm} updateForm={updateForm} addCamera={addCamera} editCamera={editCamera} deleteCamera={deleteCamera} PanelHeader={PanelHeader} adminToken={adminToken} /> : <>
        {admin && <section className="admin-panel"><div className="section-title"><h2>Camera administration</h2><span>CRUD controls · protect this route with SSO/RBAC in production</span></div><form onSubmit={addCamera} className="admin-form">{["camera_id", "name", "location_name", "latitude", "longitude"].map((field) => <input key={field} required={field !== "name" && field !== "location_name"} placeholder={field.replace("_", " ")} value={cameraForm[field]} onChange={updateForm(field)} />)}<button type="submit">Register camera</button></form><div className="admin-list">{cameras.map((camera) => <div key={camera.id}><span><b>{camera.camera_id}</b> · {camera.name || "Unnamed"} · {camera.status}</span><span><button onClick={() => editCamera(camera)}>Rename</button><button className="danger" onClick={() => deleteCamera(camera.id)}>Delete</button></span></div>)}</div></section>}
        {error && <p className="error">{error} · Data shown below is the last successfully loaded state.</p>}
        <section className="metric-strip"><Metric label="Total cameras" value={cameras.length} tone="blue" /><Metric label="Online" value={online} tone="green" /><Metric label="Offline" value={Math.max(0, cameras.length - online)} tone="red" /><Metric label="AI active" value={online ? tracks : 0} tone="blue" note="observed tracks" /><Metric label="Vehicles" value={vehicles.length} tone="blue" /><Metric label="Persons" value={people.length} tone="blue" /><Metric label="ANPR reads" value={anprReads.length} tone="green" /><Metric label="Active alerts" value={activeAlerts} tone="red" note="alert API not configured" /><Metric label="Speed violations" value={speedViolations.length} tone="amber" note={speedViolations.length ? "review required" : "calibration required"} /></section>
        <section className="command-grid"><article className="panel map-panel"><PanelHeader title="Live map overview" action={geoCameras.length ? `${geoCameras.length} located` : "GIS coordinates unavailable"} /><div className="map-surface"><div className="map-watermark">POSTGIS<br /><b>CAMERA REGISTRY</b></div>{geoCameras.slice(0, 40).map((camera) => <span className={`map-camera ${camera.health_status === "CONNECTED" ? "online" : "offline"}`} key={camera.id} style={mapPosition(camera)} title={`${camera.camera_id} · ${camera.location_name || "Location unavailable"}`}>●</span>)}{geoCameras.length === 0 && <p>No camera coordinates loaded from the registry.</p>}</div><div className="map-legend"><span><i className="legend-online" />Online</span><span><i className="legend-offline" />Offline</span><span><i className="legend-alert" />Alert data unavailable</span></div></article><article className="panel wall-panel"><PanelHeader title="Live camera wall" action={`${visibleCameras.length} matched`} /><div className="wall-controls"><input value={cameraSearch} onChange={(event) => { setCameraSearch(event.target.value); setCameraOffset(0); }} placeholder="Search camera ID, name, location" aria-label="Search cameras" />{visibleCameras.length > 9 && <><span>Window {wallStart + 1}–{Math.min(wallStart + 9, visibleCameras.length)}</span><input type="range" min="0" max={Math.max(0, visibleCameras.length - 9)} value={wallStart} onChange={(event) => setCameraOffset(Number(event.target.value))} aria-label="Switch camera wall window" /></>}</div><section className="wall-grid">{wallCameras.map((camera) => <article className="wall-tile" key={camera.id}><Preview camera={camera} /><div><b>{camera.camera_id}</b><small>{camera.name || "Unnamed camera"}</small><small>{camera.location_name || "Location unavailable"}</small></div></article>)}{visibleCameras.length === 0 && <div className="empty-state">No cameras match the current search.</div>}</section></article></section>
        <section className="lower-grid"><article className="panel compact-panel"><PanelHeader title="Recent alerts" action="No alert feed" />{visibleDetections.slice(0, 5).map((detection) => <div className="feed-row" key={detection.id}><span className="feed-icon">{vehicleClasses.has(detection.object_class) ? "▰" : "●"}</span><div><b>{detection.object_class} detected</b><small>{detection.camera_name || detection.sentinel_camera_id || detection.camera_id}</small></div><time>{new Date(detection.detected_at).toLocaleTimeString()}</time></div>)}{visibleDetections.length === 0 && <div className="empty-state">No detection events available.</div>}</article><article className="panel compact-panel"><PanelHeader title="Vehicle intelligence" action={`${vehicles.length} events`} />{vehicles.slice(0, 5).map((vehicle) => <div className="feed-row" key={vehicle.id}>{vehicle.snapshot_path ? <img src={snapshotUrl(vehicle.snapshot_path)} alt="vehicle evidence" /> : <span className="feed-icon">▱</span>}<div><b>{vehicle.plate_number || "Plate unavailable"}</b><small>{vehicle.object_class} · {Math.round(Number(vehicle.confidence) * 100)}% · {vehicle.camera_name || vehicle.camera_id}</small></div><time>{new Date(vehicle.detected_at).toLocaleTimeString()}</time></div>)}{vehicles.length === 0 && <div className="empty-state">No vehicle events available.</div>}</article><article className="panel compact-panel"><PanelHeader title="Event timeline" action={`${visibleDetections.length} events`} />{visibleDetections.slice(0, 5).map((detection) => <div className="timeline-row" key={detection.id}><span /> <time>{new Date(detection.detected_at).toLocaleTimeString()}</time><div><b>{detection.object_class} · {(Number(detection.confidence) * 100).toFixed(1)}%</b><small>{detection.camera_name || detection.camera_id}</small></div></div>)}{visibleDetections.length === 0 && <div className="empty-state">Timeline is empty.</div>}</article><article className="panel compact-panel health-panel"><PanelHeader title="System health" action={error ? "Offline" : "Connected"} /><div className="health-ring"><b>{error ? "—" : "OK"}</b><small>{error ? "Backend unavailable" : "API reachable"}</small></div><div className="health-lines"><span>Camera registry <b>{cameras.length}</b></span><span>Connected feeds <b>{online}</b></span><span>Stored events <b>{detections.length}</b></span><span>Snapshots <b>{vehicles.filter((v) => v.snapshot_path).length}</b></span></div></article></section>
        <section className="filters command-filters"><input className="camera-search" value={cameraSearch} onChange={(event) => { setCameraSearch(event.target.value); setCameraOffset(0); }} placeholder="Search by camera ID" aria-label="Search by camera ID" /><select value={filters.camera} onChange={set("camera")}><option value="">All cameras</option>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.camera_id}</option>)}</select><select value={filters.object} onChange={set("object")}><option value="">All objects</option>{classes.map((name) => <option key={name}>{name}</option>)}</select><select value={filters.confidence} onChange={set("confidence")}><option value="">Any confidence</option><option value="0.4">40%+</option><option value="0.7">70%+</option><option value="0.9">90%+</option></select><select value={filters.time} onChange={set("time")}><option value="">Any time</option><option value="15">Last 15 min</option><option value="60">Last hour</option><option value="1440">Today</option></select><select value={filters.status} onChange={set("status")}><option value="">Any camera status</option><option value="CONNECTED">Connected</option><option value="ONLINE">Online</option><option value="DISCONNECTED">Disconnected</option><option value="ERROR">Error</option></select><button onClick={load}>Refresh data</button></section>
        <section className="events panel"><div className="section-title"><h2>Detection events</h2><span>{visibleDetections.length} shown · original-resolution coordinates</span></div><div className="table-wrap"><table><thead><tr><th>Object</th><th>Confidence</th><th>Camera</th><th>Track ID</th><th>Bounding box</th><th>Timestamp</th></tr></thead><tbody>{visibleDetections.map((detection) => <tr key={detection.id}><td><b>{detection.object_class}</b></td><td>{(Number(detection.confidence) * 100).toFixed(1)}%</td><td>{detection.sentinel_camera_id || detection.camera_id}<small>{detection.camera_name}</small></td><td>{detection.track_id || "—"}</td><td>{detection.x1},{detection.y1} → {detection.x2},{detection.y2}</td><td>{new Date(detection.detected_at).toLocaleString()}</td></tr>)}</tbody></table></div></section>
      </>}
      </main>{loginOpen && <div className="admin-login-backdrop"><form className="admin-login" onSubmit={submitLogin}><span className="admin-lock">SECURE OPERATOR ACCESS</span><h2>Administrator sign in</h2><p>Sign in to manage the camera registry.</p><input autoFocus value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} placeholder="Username" /><input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} placeholder="Password" /><div className="admin-login-actions"><button type="button" onClick={() => setLoginOpen(false)}>Cancel</button><button type="submit">Sign in securely</button></div>{loginError && <small className="login-error">{loginError}</small>}</form></div>}<footer className="app-footer"><span>NetraX Command Center</span><span>Government operations interface · evidence-aware analytics</span><span>v1.0 · {new Date().getFullYear()}</span></footer>
    </div>
  </div>;
}

function Metric({ label, value, tone, note }) { return <div className={`metric metric-${tone}`}><label>{label}</label><b>{Number(value).toLocaleString()}</b><small>{note || "live API value"}</small></div>; }

function PanelHeader({ title, action }) { return <div className="panel-header"><h2>{title}</h2><span>{action}</span></div>; }

function PageView({ page, cameras, detections, visibleCameras, visibleDetections, error, online, vehicles, anprReads, speedViolations, geoCameras, mapPosition }) {
  if (page === "Search") return <SearchPage PageHeading={PageHeading} PanelHeader={PanelHeader} />;
  if (page === "Watchlist") return <WatchlistPage PageHeading={PageHeading} PanelHeader={PanelHeader} />;
  if (page === "Reports") return <ReportsPage PageHeading={PageHeading} PanelHeader={PanelHeader} />;
  if (page === "Regions") return <RegionsPage PageHeading={PageHeading} PanelHeader={PanelHeader} />;
  if (page === "Cameras") return <CameraRegistryPage cameras={cameras} online={online} PageHeading={PageHeading} PanelHeader={PanelHeader} />;
  if (page === "Live wall") return <LiveWallPage visibleCameras={visibleCameras} Preview={Preview} PageHeading={PageHeading} />;
  if (page === "ANPR") return <AnprPage anprReads={anprReads} EvidenceImage={EvidenceImage} PageHeading={PageHeading} PanelHeader={PanelHeader} DataTable={DataTable} />;
  if (page === "Vehicles") return <VehiclesPage vehicles={vehicles} EvidenceImage={EvidenceImage} PageHeading={PageHeading} PanelHeader={PanelHeader} DataTable={DataTable} />;
  if (page === "Alerts") return <AlertsPage PageHeading={PageHeading} PanelHeader={PanelHeader} />;
  if (page === "GIS map") return <GisPage cameras={cameras} geoCameras={geoCameras} mapPosition={mapPosition} PageHeading={PageHeading} PanelHeader={PanelHeader} DataTable={DataTable} />;
  if (page === "Analytics") return <AnalyticsPage detections={detections} vehicles={vehicles} anprReads={anprReads} speedViolations={speedViolations} Metric={Metric} PageHeading={PageHeading} PanelHeader={PanelHeader} DataTable={DataTable} />;
  return <HealthPage cameras={cameras} online={online} visibleDetections={visibleDetections} error={error} PageHeading={PageHeading} PanelHeader={PanelHeader} DataTable={DataTable} Metric={Metric} />;
}

function PageHeading({ title, subtitle, count }) { return <div className="page-heading"><div><small>NETRAX OPERATIONS</small><h1>{title}</h1><p>{subtitle}</p></div><span className="page-badge">{count}</span></div>; }

function DataTable({ rows, columns, render, empty }) { return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || row.camera_id || row.objectClass || index}>{render(row)}</tr>)}</tbody></table>{!rows.length && <div className="empty-state">{empty}</div>}</div>; }

export default App;
