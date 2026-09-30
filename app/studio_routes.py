"""Estado de la cabina y diagnóstico exportable."""
from __future__ import annotations

import json

from flask import Response, jsonify, request
from donor_ranking import donor_ranking


def register_studio_routes(app, runtime):
    @app.route("/studio/state", methods=["GET", "POST"])
    def studio_api():
        if request.method == "POST":
            if request.headers.get("Origin") and request.headers["Origin"].rstrip("/") != request.host_url.rstrip("/"):
                return jsonify(error="Origen no permitido"), 403
            data = request.get_json(silent=True) or {}
            if not isinstance(data, dict):
                return jsonify(error="Datos inválidos"), 400
            with runtime.feed_lock:
                for key in ("like_goal", "gift_goal"):
                    if key in data:
                        try:
                            runtime.studio_state[key] = max(1, min(10_000_000, int(data[key])))
                            if runtime.archive:
                                runtime.archive.set_setting(key, runtime.studio_state[key])
                        except (TypeError, ValueError):
                            return jsonify(error="Meta inválida"), 400
                if "highlight" in data:
                    runtime.studio_state["highlight"] = next(
                        (dict(comment) for comment in runtime.comment_history if comment["id"] == data["highlight"]), None
                    )
                if "answered" in data:
                    for item in runtime.comment_history:
                        if item["id"] == data["answered"]:
                            item["answered"] = True
                            runtime.production.answer_question(item.get("comment", ""), True)
                            break
        with runtime.feed_lock:
            return jsonify(
                **runtime.studio_state,
                session=runtime.feed_session,
                stats=runtime.stats_payload(),
                gift_totals=runtime.live_counters.snapshot()[1],
                overlay_goals=runtime.live_counters.goals,
                pending_questions=sum(not question["answered"] for question in runtime.production.questions.values()),
                completed_summary=runtime.session_metrics.get("summary") if runtime.session_metrics and runtime.session_metrics["session"] == runtime.feed_session else None,
                diagnostics=dict(runtime.diagnostics),
                connection={key: runtime.state[key] for key in ("connected", "connecting", "username", "retry_count")},
                like_ranking=runtime.like_ranking.snapshot(runtime.feed_session),
                donor_ranking=donor_ranking(runtime.gifter_diamonds, runtime.participants, runtime.gift_history.values()),
                ranking=[
                    {"user": user, "count": count, "diamonds": runtime.gifter_diamonds.get(user)}
                    for user, count in sorted(runtime.gifter_totals.items(), key=lambda row: row[1], reverse=True)
                ],
            )

    @app.get("/diagnostics/export")
    def export_diagnostics():
        if not runtime.production.local():
            return jsonify(error="Solo disponible desde este equipo"), 403
        from release_support import diagnostic

        with runtime.feed_lock:
            payload = diagnostic(runtime)
        return Response(
            json.dumps(payload),
            mimetype="application/json",
            headers={
                "Content-Disposition": "attachment; filename=tikreader-diagnostico.json",
                "Cache-Control": "no-store",
            },
        )
