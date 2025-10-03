# API/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("scan/", views.scan_device, name="scan"),
    path("uninstall/", views.uninstall_app, name="uninstall"),
    path("export/", views.export_csv, name="export"),
]
