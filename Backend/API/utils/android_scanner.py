import subprocess
from ppadb.client import Client as AdbClient

def ensure_adb_running():
    try:
        
        client = AdbClient(host="127.0.0.1", port=5037)
        _ = client.version()  
        return client
    except Exception:
        # If adb isn’t running, start it
        subprocess.Popen(["adb", "start-server"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        # Try connecting again
        return AdbClient(host="127.0.0.1", port=5037)
