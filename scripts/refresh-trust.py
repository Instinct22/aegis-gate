#!/usr/bin/env python3
"""Обновляет trust.json снимками VirusTotal для текущих файлов релиза.

Берёт SHA-256 из https://api.aegis-gate.ru/api/app/latest. Если отчёт этого
хеша уже есть, файл не трогает. Новый хеш спрашивает у VirusTotal API v3
(переменная VIRUSTOTAL_API_KEY) и при отсутствии загружает файл. Без ключа
новые сборки остаются без снимка: страница показывает «Отчёта пока нет»
и не подставляет цифры прошлого файла.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRUST_PATH = ROOT / "trust.json"
LATEST = "https://api.aegis-gate.ru/api/app/latest"
VT_API = "https://www.virustotal.com/api/v3"
CHANNEL = "stable"
TARGETS = (
    ("windows", "amd64"),
    ("android", "arm64"),
    ("android", "arm"),
    ("android", "x64"),
)
UPLOAD_LIMIT = 32 * 1024 * 1024
API_GAP = 16
POLL_SECONDS = 20
POLL_TRIES = 30

_last_call = 0.0


class VtError(RuntimeError):
    def __init__(self, status: int, body: str):
        super().__init__(f"VirusTotal HTTP {status}: {body[:300]}")
        self.status = status


def load_trust() -> dict:
    if not TRUST_PATH.exists():
        return {"generatedAt": None, "reports": {}}
    data = json.loads(TRUST_PATH.read_text(encoding="utf-8"))
    data.setdefault("reports", {})
    return data


def save_trust(data: dict) -> None:
    data["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    TRUST_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def http_json(url: str, method: str = "GET", body: bytes | None = None, headers: dict | None = None) -> dict:
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise VtError(exc.code, detail) from exc
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def latest(platform: str, arch: str) -> dict:
    url = f"{LATEST}?platform={platform}&arch={arch}&channel={CHANNEL}"
    data = http_json(url, headers={"Accept": "application/json"})
    sha = str(data.get("sha256") or "").lower()
    if len(sha) != 64 or not data.get("url") or not data.get("version"):
        raise RuntimeError(f"Нет sha256 в ответе latest для {platform}/{arch}")
    return {
        "platform": platform,
        "arch": arch,
        "sha256": sha,
        "version": str(data["version"]),
        "url": str(data["url"]),
        "filename": str(data.get("filename") or data["url"].rstrip("/").split("/")[-1]),
    }


def vt(path: str, method: str = "GET", body: bytes | None = None, headers: dict | None = None) -> dict:
    global _last_call
    key = os.environ.get("VIRUSTOTAL_API_KEY", "").strip()
    if not key:
        raise RuntimeError("VIRUSTOTAL_API_KEY не задан")
    wait = API_GAP - (time.time() - _last_call)
    if wait > 0:
        time.sleep(wait)
    merged = {"x-apikey": key, "Accept": "application/json"}
    if headers:
        merged.update(headers)
    try:
        return http_json(VT_API + path, method, body, merged)
    finally:
        _last_call = time.time()


def report_from_file(payload: dict, meta: dict) -> dict:
    attrs = payload.get("data", {}).get("attributes", {})
    stats = attrs.get("last_analysis_stats") or {}
    finished = sum(int(stats.get(name, 0) or 0) for name in ("malicious", "suspicious", "undetected", "harmless"))
    hits = []
    for name, row in (attrs.get("last_analysis_results") or {}).items():
        category = row.get("category")
        if category in ("malicious", "suspicious"):
            hits.append({
                "name": name,
                "category": category,
                "verdict": row.get("result") or category,
            })
    hits.sort(key=lambda item: (item["category"] != "malicious", item["name"].lower()))
    scanned = attrs.get("last_analysis_date")
    return {
        "sha256": meta["sha256"],
        "status": "ready" if finished else "scanning",
        "filename": meta["filename"],
        "version": meta["version"],
        "platform": meta["platform"],
        "arch": meta["arch"],
        "malicious": int(stats.get("malicious") or 0),
        "suspicious": int(stats.get("suspicious") or 0),
        "undetected": int(stats.get("undetected") or 0),
        "harmless": int(stats.get("harmless") or 0),
        "scannedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(scanned)) if scanned else None,
        "hits": hits,
    }


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "aegis-gate-trust/1"})
    with urllib.request.urlopen(req, timeout=180) as response, dest.open("wb") as handle:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)


def upload(path: Path) -> str:
    global _last_call
    upload_url = VT_API + "/files"
    if path.stat().st_size > UPLOAD_LIMIT:
        given = vt("/files/upload_url")["data"]
        upload_url = given if isinstance(given, str) else given["url"]
    boundary = "----AegisGateVtBoundary"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    wait = API_GAP - (time.time() - _last_call)
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(
        upload_url,
        data=body,
        method="POST",
        headers={
            "x-apikey": os.environ["VIRUSTOTAL_API_KEY"].strip(),
            "Accept": "application/json",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise VtError(exc.code, exc.read().decode("utf-8", "replace")) from exc
    finally:
        _last_call = time.time()
    return result["data"]["id"]


def wait_analysis(analysis_id: str) -> None:
    for _ in range(POLL_TRIES):
        time.sleep(POLL_SECONDS)
        payload = vt(f"/analyses/{analysis_id}")
        status = payload.get("data", {}).get("attributes", {}).get("status")
        print(f"  анализ {analysis_id}: {status}")
        if status == "completed":
            return
    raise TimeoutError(f"Анализ {analysis_id} не завершился")


def lookup(meta: dict) -> dict | None:
    try:
        payload = vt(f"/files/{meta['sha256']}")
    except VtError as exc:
        if exc.status == 404:
            return None
        raise
    return report_from_file(payload, meta)


def scan(meta: dict) -> dict:
    try:
        payload = vt(f"/files/{meta['sha256']}")
    except VtError as exc:
        if exc.status != 404:
            raise
        print(f"  файла нет на VirusTotal, загружаем {meta['filename']}")
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / meta["filename"]
            download(meta["url"], dest)
            analysis_id = upload(dest)
        wait_analysis(analysis_id)
        payload = vt(f"/files/{meta['sha256']}")
    return report_from_file(payload, meta)


def main() -> int:
    trust = load_trust()
    reports = trust["reports"]
    changed = False
    key = os.environ.get("VIRUSTOTAL_API_KEY", "").strip()
    for platform, arch in TARGETS:
        meta = latest(platform, arch)
        current = reports.get(meta["sha256"])
        print(f"{platform}/{arch} {meta['version']} {meta['sha256'][:12]}")
        if not key:
            if current and current.get("status") == "ready":
                print("  снимок уже есть")
            else:
                print("  нового снимка нет, VIRUSTOTAL_API_KEY не задан")
            continue
        fresh = lookup(meta) if current and current.get("status") == "ready" else scan(meta)
        if fresh is None:
            print("  VirusTotal не вернул отчёт")
            continue
        if current == fresh:
            print("  снимок совпадает с VirusTotal")
            continue
        reports[meta["sha256"]] = fresh
        save_trust(trust)
        changed = True
        done = fresh["malicious"] + fresh["suspicious"] + fresh["undetected"] + fresh["harmless"]
        print(f"  {fresh['status']}: {fresh['malicious']}/{done}")
    if not changed:
        print("trust.json без изменений")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 — точка входа скрипта, ошибка должна быть видна в CI
        print(exc, file=sys.stderr)
        sys.exit(1)
