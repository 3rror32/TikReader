"""Historial, respaldos y exportaciones de sesiones.

El módulo recibe el runtime del servidor para mantener el estado en un solo lugar
sin acoplar las rutas HTTP al proceso de conexión con TikTok.
"""
from __future__ import annotations

import csv
import io
import json
import sqlite3
import tempfile
import time
from pathlib import Path
from uuid import uuid4

from flask import Response, jsonify, request, send_file


def register_history_routes(app, runtime):
    def make_archive_backup():
        archive = runtime.archive
        folder = Path(archive.path).resolve().parent / "backups"
        folder.mkdir(exist_ok=True)
        target = folder / ("tikreader-" + time.strftime("%Y%m%d-%H%M%S") + "-" + uuid4().hex[:8] + ".sqlite3")
        archive.backup(target)
        return target

    @app.get("/history")
    def history_api():
        return jsonify(sessions=runtime.archive.sessions() if runtime.archive else [])

    @app.get("/history/search")
    def search_history():
        results = runtime.archive.search(request.args.get("q", "")[:200], request.args.get("user", "")[:100]) if runtime.archive else []
        return jsonify(results=results)

    @app.post("/history/backup")
    def backup_history():
        if not runtime.archive:
            return jsonify(error="Historial no disponible"), 503
        with runtime.feed_lock:
            target = make_archive_backup()
        return send_file(target, as_attachment=True, download_name=target.name)

    @app.delete("/history/<session>")
    def delete_history(session):
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict) or data.get("confirmation") != "ELIMINAR " + session:
            return jsonify(error="Falta confirmación exacta"), 400
        if not runtime.archive:
            return jsonify(error="Historial no disponible"), 503
        with runtime.feed_lock:
            if session == runtime.feed_session:
                return jsonify(error="No se puede eliminar la sesión que está cargada en el servidor"), 409
            target = make_archive_backup()
            count = runtime.archive.delete_session(session)
        return jsonify(deleted=count, backup=target.name)

    @app.post("/history/restore")
    def restore_history():
        if not runtime.archive:
            return jsonify(error="Historial no disponible"), 503
        if request.content_length is None or request.content_length > 25 * 1024 * 1024:
            return jsonify(error="El límite de carga es 25 MB"), 413
        upload = request.files.get("backup")
        if not upload:
            return jsonify(error="Selecciona un respaldo SQLite"), 400
        try:
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "restore.sqlite3"
                upload.save(path)
                sessions, events = runtime.archive.inspect_backup(path)
                if request.form.get("confirmation") != "RESTAURAR":
                    return jsonify(preview=True, sessions=len(sessions), events=len(events))
                with runtime.feed_lock:
                    backup = make_archive_backup()
                    count = runtime.archive.restore(path, runtime.feed_session)
                return jsonify(imported=count, backup=backup.name)
        except (sqlite3.Error, ValueError, TypeError, KeyError):
            return jsonify(error="Respaldo inválido o incompatible; no se restauró"), 400

    @app.route("/history/retention", methods=["GET", "POST"])
    def history_retention():
        if not runtime.archive:
            return jsonify(error="Historial no disponible"), 503
        data = (request.get_json(silent=True) or {}) if request.method == "POST" else request.args
        if not hasattr(data, "get"):
            return jsonify(error="Datos inválidos"), 400
        try:
            days = int(data.get("days", 90))
            if days not in (7, 30, 90, 365):
                raise ValueError()
        except (ValueError, TypeError):
            return jsonify(error="Elige 7, 30, 90 o 365 días"), 400
        with runtime.feed_lock:
            count = runtime.archive.retention(days, runtime.feed_session)
            backup = None
            if request.method == "POST":
                if data.get("confirmation") != f"LIMPIAR {days}":
                    return jsonify(error="Falta confirmación exacta"), 400
                if count:
                    backup = make_archive_backup().name
                    count = runtime.archive.retention(days, runtime.feed_session, delete=True)
            root = Path(runtime.archive.path).parent
            size = sum(path.stat().st_size for path in root.rglob("*") if path.is_file())
        return jsonify(sessions=count, days=days, bytes=size, backup=backup)

    @app.get("/history/<session>/summary")
    def session_summary(session):
        with runtime.feed_lock:
            records = runtime.archive.records(session) if runtime.archive else (
                [{"kind": "comment", **comment} for comment in runtime.comment_history]
                + [{"kind": "gift", **gift} for gift in runtime.gift_history.values()]
                + [{"kind": "sample", **sample} for sample in runtime.viewer_samples]
                if session == runtime.feed_session else []
            )
        comments = [row for row in records if row["kind"] == "comment"]
        gifts = [row for row in records if row["kind"] == "gift"]
        samples = [row for row in records if row["kind"] == "sample"]
        completed = next((row for row in records if row["kind"] == "summary"), None)
        if completed is None and runtime.session_metrics and runtime.session_metrics["session"] == session:
            completed = runtime.session_metrics.get("summary")
        participants = {}
        for comment in comments:
            user = comment.get("user", "Usuario")
            participants[user] = participants.get(user, 0) + 1
        return jsonify(
            comments=len(comments),
            questions=sum(1 for comment in comments if "?" in comment.get("comment", "") or "¿" in comment.get("comment", "")),
            gifts=sum(gift.get("count", 0) for gift in gifts),
            participants=len(participants),
            peak_viewers=completed["peak_viewers"] if completed else max((sample["viewers"] for sample in samples), default=None),
            duration_seconds=completed["duration_seconds"] if completed else None,
            completed_summary=completed,
            active_users=sorted(
                [{"user": user, "count": count} for user, count in participants.items()],
                key=lambda row: row["count"], reverse=True,
            )[:10],
            viewer_samples=samples[-720:],
        )

    @app.get("/history/<session>/export")
    def export_history(session):
        records = runtime.archive.records(session) if runtime.archive else []
        if request.args.get("format") == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["tipo", "usuario", "comentario_o_regalo", "cantidad", "hora", "respondido"])

            def safe(value):
                text = str(value or "")
                return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) else text

            for item in records:
                writer.writerow(
                    [safe(item.get(key)) for key in ("kind", "user")]
                    + [safe(item.get("comment", item.get("gift", ""))), item.get("count", ""), safe(item.get("timestamp")), item.get("answered", False)]
                )
            return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=tikreader-history.csv"})
        return Response(
            json.dumps(records, ensure_ascii=False),
            mimetype="application/json",
            headers={"Content-Disposition": "attachment; filename=tikreader-history.json"},
        )
