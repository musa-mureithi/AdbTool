// src/components/AndroidScanner.jsx
import React, { useEffect, useState } from "react";
import useAndroidScanner from "../Hooks/useAndroidScanner";

export default function AndroidScanner() {
  const { 
    loading, deviceInfo, apps, error, csvUrl, 
    scan, uninstall, exportCSV, revokeCsvUrl 
  } = useAndroidScanner( "http://localhost:8000"); 

  const [selectedPkgs, setSelectedPkgs] = useState([]);
  const [isUninstalling, setIsUninstalling] = useState(false);

  useEffect(() => {
    scan().catch(() => {});
  }, [scan]);

  const handleScan = async () => {
    try {
      await scan();
    } catch {}
  };

  const handleUninstall = async () => {
    if (!selectedPkgs.length) {
      alert("Please tick at least one suspicious app to uninstall.");
      return;
    }
    if (!window.confirm(`Uninstall these apps?\n\n${selectedPkgs.join("\n")}`)) return;
    
    setIsUninstalling(true);
    try {
      for (const pkg of selectedPkgs) {
        await uninstall(pkg);
      }
      alert("Uninstall commands sent. Scan refreshed.");
      setSelectedPkgs([]);
    } catch (e) {
      alert("Uninstall failed: " + e.message);
    } finally {
      setIsUninstalling(false);
    }
  };

  const handleExport = async () => {
    try {
      const url = await exportCSV();
      const a = document.createElement("a");
      a.href = url;
      a.download = "android_scan_report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => revokeCsvUrl(), 60 * 1000);
    } catch (e) {
      alert("Export failed: " + e.message);
    }
  };

  const toggleSelection = (pkg) => {
    setSelectedPkgs((prev) =>
      prev.includes(pkg) ? prev.filter((p) => p !== pkg) : [...prev, pkg]
    );
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ marginBottom: 16 }}>📱 Android Scanner</h2>

      <div style={{ marginBottom: 16 }}>
        <button onClick={handleScan} disabled={loading || isUninstalling}>
          {loading ? "🔄 Scanning..." : "🔍 Run Scan"}
        </button>
        <button 
          onClick={handleExport} 
          disabled={loading || isUninstalling || !apps.length} 
          style={{ marginLeft: 8 }}
        >
          📂 Export CSV
        </button>
        <button 
          onClick={handleUninstall} 
          disabled={loading || isUninstalling || !selectedPkgs.length} 
          style={{ marginLeft: 8, background: "#d9534f", color: "white" }}
        >
          {isUninstalling ? "⏳ Uninstalling..." : "🗑️ Uninstall Selected"}
        </button>
      </div>

      {error && <div style={{ color: "red", marginBottom: 10 }}>⚠️ Error: {error}</div>}

      {deviceInfo && (
        <div style={{ marginBottom: 20, padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#f9f9f9" }}>
          <h3>📲 Device Info</h3>
          <p><strong>Model:</strong> {deviceInfo.model}</p>
          <p><strong>Serial:</strong> {deviceInfo.serial}</p>
          <p><strong>Android:</strong> {deviceInfo.android_version}</p>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, background: "#eee", padding: 8, borderRadius: 4 }}>
            {deviceInfo.battery_info}
          </pre>
        </div>
      )}

      <h3>📦 Installed Apps</h3>
      <div style={{ maxHeight: 400, overflow: "auto", border: "1px solid #ddd", borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f0f0f0" }}>
            <tr>
              <th style={{ textAlign: "center", padding: 8 }}>✔</th>
              <th style={{ textAlign: "left", padding: 8 }}>Package</th>
              <th style={{ padding: 8 }}>Installer</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Dangerous perms</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => {
              const isSuspicious = app.dangerous_permissions?.length > 0;
              return (
                <tr
                  key={app.package}
                  style={{
                    background: isSuspicious ? "#ffe6e6" : "white",
                    color: isSuspicious ? "red" : "black",
                  }}
                >
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedPkgs.includes(app.package)}
                      onChange={() => toggleSelection(app.package)}
                      disabled={loading || isUninstalling}
                    />
                  </td>
                  <td style={{ padding: 8 }}>{app.package}</td>
                  <td style={{ padding: 8 }}>{app.installer}</td>
                  <td style={{ padding: 8 }}>{app.status}</td>
                  <td style={{ padding: 8 }}>
                    {app.dangerous_permissions?.length
                      ? app.dangerous_permissions.join(", ")
                      : "None"}
                  </td>
                </tr>
              );
            })}
            {!apps.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 12 }}>
                  No apps found. Run a scan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
