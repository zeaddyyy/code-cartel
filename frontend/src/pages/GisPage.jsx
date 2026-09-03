import { useMemo, useState } from "react";

export default function GisPage({ cameras, geoCameras, mapPosition, PageHeading, PanelHeader, DataTable }) {
  const [district, setDistrict] = useState("ALL");
  const districts = useMemo(() => [...new Set(cameras.map((camera) => camera.location_name?.split(/[,|-]/)[0]?.trim()).filter(Boolean))].sort(), [cameras]);
  const filtered = useMemo(() => district === "ALL" ? geoCameras : geoCameras.filter((camera) => camera.location_name?.split(/[,|-]/)[0]?.trim() === district), [geoCameras, district]);
  // Grid aggregation keeps the map responsive for large registries: one DOM
  // marker represents all cameras in its cell, while the table remains full.
  const clusters = useMemo(() => {
    const cells = new Map();
    filtered.forEach((camera) => {
      const p = mapPosition(camera); const key = `${Math.round(parseFloat(p.left) / 2)}:${Math.round(parseFloat(p.top) / 2)}`;
      const cell = cells.get(key) || { ...camera, count: 0, ids: [] }; cell.count += 1; cell.ids.push(camera.camera_id); cells.set(key, cell);
    });
    return [...cells.values()];
  }, [filtered, mapPosition]);
  return <div className="page-view"><PageHeading title="GIS map" subtitle="District-aware camera locations with scalable clustering" count={`${filtered.length.toLocaleString()} located`} /><section className="panel map-page"><div className="gis-controls"><label>District <select value={district} onChange={(event) => setDistrict(event.target.value)}><option value="ALL">All districts</option>{districts.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><span>{clusters.length.toLocaleString()} map cells · {cameras.length.toLocaleString()} total registry records</span></div><div className="map-surface large-map">{clusters.map((camera) => <span className={`map-camera ${camera.count > 1 ? "cluster" : camera.health_status === "CONNECTED" ? "online" : "offline"}`} key={`${camera.id}-${camera.count}`} style={mapPosition(camera)} title={camera.count > 1 ? `${camera.count} cameras: ${camera.ids.slice(0, 5).join(", ")}` : camera.camera_id}>{camera.count > 1 ? camera.count : "●"}</span>)}{!filtered.length && <p>No cameras with valid coordinates for this district.</p>}</div></section><section className="panel registry-panel"><PanelHeader title="District coverage" action="Aggregated for scale" /><div className="region-grid">{districts.map((name) => <article className="region-card" key={name}><div>{name}</div><b>{cameras.filter((camera) => camera.location_name?.split(/[,|-]/)[0]?.trim() === name).length.toLocaleString()}</b><small>registered cameras</small></article>)}</div></section><section className="panel registry-panel"><PanelHeader title="Location data quality" action={`${cameras.length - geoCameras.length} need coordinates`} /><DataTable rows={cameras} columns={["Camera", "Location name", "Coordinates", "Status"]} render={(camera) => <><td><b>{camera.camera_id}</b></td><td>{camera.location_name || "Unavailable"}</td><td>{geoCameras.some((located) => located.id === camera.id) ? `${camera.latitude}, ${camera.longitude}` : "Missing — update in Administration"}</td><td><span className="table-status">{camera.health_status || camera.status || "UNKNOWN"}</span></td></>} empty="No cameras are registered." /></section></div>;
}
