# API/views.py
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from ppadb.client import Client as AdbClient
from email.message import EmailMessage
import smtplib, csv, os, tempfile, json
from .utils.android_scanner import ensure_adb_running
# ========== EMAIL CONFIG ==========
EMAIL_ADDRESS = ""         
EMAIL_PASSWORD = ""        
EMAIL_RECEIVER = ""    
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465
# =================================

DANGEROUS_PERMISSIONS = {
    "android.permission.READ_SMS",
    "android.permission.RECEIVE_SMS",
    "android.permission.SEND_SMS",
    "android.permission.READ_CONTACTS",
    "android.permission.WRITE_CONTACTS",
    "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA",
    "android.permission.READ_CALL_LOG",
    "android.permission.WRITE_CALL_LOG",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.READ_PHONE_STATE",
    "android.permission.CALL_PHONE",
    "android.permission.PROCESS_OUTGOING_CALLS",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.READ_EXTERNAL_STORAGE",
}

adb = AdbClient(host="127.0.0.1", port=5037)

def get_permissions(device, package_name):
    output = device.shell(f"dumpsys package {package_name}")
    perms = []
    capture = False
    for line in output.splitlines():
        line = line.strip()
        if line.startswith("requested permissions:"):
            capture = True
            continue
        if capture:
            if not line or line.startswith("install permissions:"):
                break
            perms.append(line)
    return perms

def send_email_alert(report_file_path, suspicious_apps, all_apps):
    if not suspicious_apps:
        return
    summary_lines = ["Suspicious Apps Detected:\n"]
    for app in all_apps:
        if app["package"] in suspicious_apps:
            perms_text = ", ".join(app["dangerous_permissions"]) or "None"
            summary_lines.append(f"- {app['package']}: {perms_text}")

    msg = EmailMessage()
    msg['Subject'] = 'Android Security Alert: Suspicious Apps Detected'
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = EMAIL_RECEIVER
    msg.set_content("\n".join(summary_lines))

    with open(report_file_path, "rb") as f:
        msg.add_attachment(f.read(), maintype="text", subtype="csv", filename=os.path.basename(report_file_path))

    try:
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as smtp:
            smtp.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            smtp.send_message(msg)
    except Exception as e:
        print("Email failed:", e)


# ========== API VIEWS ==========

def scan_device(request):
    adb = ensure_adb_running()
    devices = adb.devices()
    if not devices:
        return JsonResponse({"error": "No device found"}, status=400)

    device = devices[0]
    model = device.shell("getprop ro.product.model").strip()
    android_version = device.shell("getprop ro.build.version.release").strip()
    battery = device.shell("dumpsys battery").strip()

    # Get device serial number from ADB
    serial = device.get_serial_no()  

    all_apps, suspicious = [], []
    pkgs = device.shell("pm list packages -i").splitlines()

    for line in pkgs:
        if "package:" in line:
            parts = line.replace("package:", "").split(" installer=")
            pkg = parts[0].strip()
            installer = parts[1].strip() if len(parts) > 1 else "unknown"

            status = "Safe"
            if installer != "com.android.vending":
                status = "Suspicious"
                suspicious.append(pkg)

            app_data = {
                "package": pkg,
                "installer": installer,
                "status": status,
                "dangerous_permissions": []
            }

            if status == "Suspicious":
                perms = get_permissions(device, pkg)
                dangerous = [p for p in perms if p in DANGEROUS_PERMISSIONS]
                app_data["dangerous_permissions"] = dangerous

            all_apps.append(app_data)

    # Auto export CSV for email
    fd, path = tempfile.mkstemp(suffix=".csv")
    with os.fdopen(fd, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Package", "Installer", "Status", "Dangerous Permissions"])
        for app in all_apps:
            writer.writerow([app["package"], app["installer"], app["status"], ",".join(app["dangerous_permissions"]) or "None"])

    send_email_alert(path, suspicious, all_apps)

    return JsonResponse({
        "device": {
            "model": model,
            "serial": serial,   
            "android_version": android_version,
            "battery_info": battery,
        },
        "apps": all_apps,
    })



@csrf_exempt
def uninstall_app(request):
    adb = ensure_adb_running()
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    body = json.loads(request.body.decode("utf-8"))
    package = body.get("package")
    if not package:
        return JsonResponse({"error": "No package"}, status=400)

    devices = adb.devices()
    if not devices:
        return JsonResponse({"error": "No device"}, status=400)
    device = devices[0]

    result = device.shell(f"pm uninstall {package}")
    success = "Success" in result
    return JsonResponse({"success": success, "response": result})


@csrf_exempt
def export_csv(request):
    adb = ensure_adb_running()
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    data = json.loads(request.body.decode("utf-8") or "{}")
    apps = data.get("apps", [])

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="scan_results.csv"'
    writer = csv.writer(response)
    writer.writerow(["Package", "Installer", "Status", "Dangerous Permissions"])
    for app in apps:
        writer.writerow([app["package"], app["installer"], app["status"], ",".join(app.get("dangerous_permissions", [])) or "None"])
    return response
