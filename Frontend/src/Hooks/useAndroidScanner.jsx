import { useState, useCallback } from "react";

export default function useAndroidScanner(baseUrl = "") {
  const api = (path) => `${baseUrl.replace(/\/$/, "")}${path}`;

  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [apps, setApps] = useState([]);
  const [error, setError] = useState(null);
  const [csvUrl, setCsvUrl] = useState(null); // temporary download URL

  // ✅ Scan
  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(api("/scan/")); // ✅ fixed with trailing slash
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Scan failed");
      }
      const data = await res.json();
      setDeviceInfo(data.device || null);
      setApps(data.apps || []);
      setLoading(false);
      return data;
    } catch (e) {
      setError(e.message || String(e));
      setLoading(false);
      throw e;
    }
  }, [baseUrl]);

  // ✅ Uninstall
  const uninstall = useCallback(async (packageName) => {
    if (!packageName) throw new Error("No package name provided");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(api("/uninstall/"), { // ✅ fixed with trailing slash
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: packageName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || JSON.stringify(data));
      }
      // refresh scan automatically
      await scan();
      setLoading(false);
      return data;
    } catch (e) {
      setError(e.message || String(e));
      setLoading(false);
      throw e;
    }
  }, [scan, baseUrl]);

  // ✅ Export
  const exportCSV = useCallback(async (providedApps) => {
    setLoading(true);
    setError(null);
    setCsvUrl(null);
    try {
      const payload = providedApps ? { apps: providedApps } : {};
      const res = await fetch(api("/export/"), { // ✅ fixed with trailing slash
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Export failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setCsvUrl(url);
      setLoading(false);
      return url;
    } catch (e) {
      setError(e.message || String(e));
      setLoading(false);
      throw e;
    }
  }, [baseUrl]);

  const revokeCsvUrl = useCallback(() => {
    if (csvUrl) {
      window.URL.revokeObjectURL(csvUrl);
      setCsvUrl(null);
    }
  }, [csvUrl]);

  return {
    loading,
    deviceInfo,
    apps,
    error,
    csvUrl,
    scan,
    uninstall,
    exportCSV,
    revokeCsvUrl,
  };
}
