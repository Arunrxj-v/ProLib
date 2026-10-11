#!/usr/bin/env python3
"""Bug-fix acceptance suite: notification bell + technology validation.

    python3 tests/notification_tech_test.py     # or: npm run test:bugfix

Reuses the proven harness from `upload_flow_test.py` (scratch `prolib_test`,
scratch STORAGE_PATH, self-managed :3000 dev server). The real database and
the real `storage/uploads/**` tree are never touched.

BUG 1 — the header bell was a hard-coded blue dot. The fix derives it from
        the REAL review-activity rows against the per-user
        `notifications_seen_at` watermark (opened panel = read). Locked down:
  N1  fresh account, zero events      → bell renders, NO indicator
  N2  one genuine event (publish)     → indicator + unread-count API = 1
  N3  opening the panel               → watermark written, count 0, dot gone
  N4  a real moderator decision       → unread again (count 1, dot back)
  N5  switching users never leaks     → other account sees nothing
  N6  anonymous                       → no bell at all; API 401
  N7  POST mark-read (panel contract) → count 0, dot gone

BUG 2 — "Add at least one technology" despite selections. The picker now
        derives chips, checkboxes AND the submitted fields from one
        `selected` state, and the stale error clears as soon as anything is
        selected. The action contract is locked down here:
  T1  one DB option selected          → draft created, exactly 1 link row
  T2  multiple options + custom name  → all persisted (name upserted)
  T3  nothing selected                → real error text, zero new rows
  T4  duplicate ids/names             → deduplicated, one row each
  T5  publish intent                  → persists + genuinely unread event
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import upload_flow_test as base  # noqa: E402  (shared harness, main() is guarded)

base.DEV_LOG = "/tmp/prolib-bugfix-dev.log"

USER_C = {
    "name": "Cara Dolor",
    "username": "carad",
    "email": f"cara.mod@{base.ALLOWED_DOMAIN}",
    "password": "ReviewGate2026",
}

TECH_ROWS = [
    ("11111111-1111-4111-8111-111111111111", "React", "react", "framework"),
    ("22222222-2222-4222-8222-222222222222", "TypeScript", "typescript", "language"),
    ("33333333-3333-4333-8333-333333333333", "PostgreSQL", "postgresql", "database"),
]
REACT_ID, TS_ID, PG_ID = (row[0] for row in TECH_ROWS)


def ok(label, cond=True, extra=""):
    base.ok(label, cond, extra)


def bell(html):
    return 'aria-label="Notifications"' in html or 'aria-label="Notifications (' in html


def dot(html):
    return "data-unread-indicator" in html


def unread_count(session):
    status, payload, _, _, _ = base.api("GET", "/api/notifications/unread-count", cookie=session)
    assert status == 200, (status, payload)
    return payload["count"]


def seed_technologies():
    values = ", ".join(
        f"('{tid}', '{name}', '{slug}', '{kind}', true)" for tid, name, slug, kind in TECH_ROWS
    )
    base.psql(
        "INSERT INTO technologies (id, name, slug, kind, active) VALUES "
        + values
        + " ON CONFLICT (slug) DO NOTHING"
    )


def wizard(session, *, title, tech_entries=(), intent="draft", cover=True):
    """Drives the REAL wizard form the way the browser does (no-JS encoding)."""
    status, _, html = base.get("/dashboard/projects/new", cookie=session)
    assert status == 200, status
    entries = [
        ("title", title),
        ("shortDescription", "Bell and stack validation acceptance fixture."),
        ("projectType", "academic"),
        ("status", "in_progress"),
        ("intent", intent),
    ]
    entries.extend(tech_entries)
    if cover:
        entries.append(("cover", base.png_of(2048), "cover.png", "image/png"))
    return base.post_action(
        "/dashboard/projects/new", html, entries, cookie=session, marker="w-cover"
    )


def project_links(project_id):
    return base.scalar(
        f"select technology_id from project_technologies where project_id = '{project_id}' "
        "order by technology_id"
    )


# ---------------------------------------------------------------- bug 1
def n1_fresh_account_dark(session):
    status, _, html = base.get("/explore", cookie=session)
    ok("N1 explore renders for the signed-in student", status == 200, status)
    ok("N1 bell link present", bell(html))
    ok("N1 fresh account (zero notifications) shows NO indicator", not dot(html))
    ok("N1 unread-count API reports 0", unread_count(session) == 0)


def n2_event_lights_indicator(session):
    status, hdrs, data = wizard(
        session,
        title="Bell fixture project",
        tech_entries=[("technologyNames", "BellStack")],
        intent="publish",
    )
    pid = base.created_id_from(status, hdrs, data)
    ok("N2 publish created the project", bool(pid))
    submitted = base.scalar(
        f"select submitted_at is not null as s from projects where id = '{pid}'"
    )[0]["s"]
    ok("N2 publish produced a real activity event (submitted_at)", submitted)
    ok("N2 unread-count API reports 1", unread_count(session) == 1)
    _, _, html = base.get("/explore", cookie=session)
    ok("N2 indicator appears for the unread event", dot(html))
    return pid


def n3_opening_panel_marks_read(session, project_id):
    status, _, html = base.get("/dashboard/notifications", cookie=session)
    ok("N3 activity panel opens", status == 200, status)
    ok("N3 panel lists the real submission", "Bell fixture project" in html)
    seen = base.scalar(
        f"select notifications_seen_at as seen from users where email = '{base.USER_A['email']}'"
    )[0]["seen"]
    ok("N3 opening the panel wrote the read watermark", seen is not None)
    ok("N3 unread-count API now reports 0", unread_count(session) == 0)
    _, _, html = base.get("/explore", cookie=session)
    ok("N3 read notifications do NOT retrigger the indicator", not dot(html))
    ok(
        "N3 activity row itself is intact (history preserved)",
        base.scalar(
            f"select count(*) as n from projects where id = '{project_id}'"
        )[0]["n"] == 1,
    )


def n4_new_moderation_event_unreads_again(session_owner, admin_session, project_id):
    base.psql(f"UPDATE users SET role = 'admin' WHERE email = '{USER_C['email']}'")
    status, _, html = base.get(f"/admin/projects/{project_id}", cookie=admin_session)
    ok("N4 admin review page renders", status == 200, status)
    status, _, data = base.post_action(
        f"/admin/projects/{project_id}",
        html,
        [("note", "Solid architecture section — nice work.")],
        cookie=admin_session,
        marker="approve-note",
    )
    ok("N4 approve action accepted", status in (200, 302, 303), (status, data[:200]))
    row = base.scalar(
        f"select publication_status as pub, reviewed_at is not null as has_review "
        f"from projects where id = '{project_id}'"
    )[0]
    ok(
        "N4 moderator decision stored (approved + reviewed_at)",
        row["pub"] == "approved" and row["has_review"],
        row,
    )
    ok("N4 the decision is genuinely unread (count 1)", unread_count(session_owner) == 1)
    _, _, html = base.get("/explore", cookie=session_owner)
    ok("N4 indicator returns for the new decision", dot(html))


def n5_no_user_leak(session_a, session_b):
    ok("N5 other account's unread count is 0", unread_count(session_b) == 0)
    _, _, html_b = base.get("/explore", cookie=session_b)
    ok("N5 other account sees NO indicator", not dot(html_b))
    _, _, html_a = base.get("/explore", cookie=session_a)
    label = base.re.search(r'aria-label="Notifications[^"]*"', html_a)
    ok(
        "N5 owner still sees the indicator (no cross-user clearing)",
        dot(html_a),
        f"bell={bell(html_a)} api={unread_count(session_a)} label={label and label.group(0)}",
    )
    ok("N5 owner's count still 1", unread_count(session_a) == 1)


def n6_anonymous():
    status, _, html = base.get("/explore")
    ok("N6 anonymous header has no bell", not bell(html))
    ok("N6 anonymous header has no indicator", not dot(html))
    status, payload, _, _, _ = base.api("GET", "/api/notifications/unread-count")
    ok("N6 unread-count API rejects anonymous callers", status == 401, (status, payload))


def n7_mark_read_endpoint(session):
    status, payload, _, _, _ = base.api(
        "POST", "/api/notifications/unread-count", cookie=session
    )
    ok("N7 POST mark-read succeeds", status == 200 and payload == {"count": 0}, (status, payload))
    ok("N7 unread-count API reports 0 after mark-read", unread_count(session) == 0)
    _, _, html = base.get("/explore", cookie=session)
    ok("N7 indicator cleared after mark-read", not dot(html))


# ---------------------------------------------------------------- bug 2
def t1_single_option(session):
    status, hdrs, data = wizard(
        session,
        title="Single tech draft",
        tech_entries=[("technologyIds", REACT_ID)],
    )
    pid = base.created_id_from(status, hdrs, data)
    links = project_links(pid)
    ok("T1 draft with one DB option created", bool(pid))
    ok("T1 exactly one technology persisted", len(links) == 1, links)
    ok("T1 the picked option is the persisted one", links[0]["technology_id"] == REACT_ID, links)
    ok(
        "T1 a draft is NOT a notification (no false unread)",
        unread_count(session) == 0,
    )
    return pid


def t2_multiple_plus_custom(session):
    status, hdrs, data = wizard(
        session,
        title="Full stack draft",
        tech_entries=[
            ("technologyIds", REACT_ID),
            ("technologyIds", TS_ID),
            ("technologyIds", PG_ID),
            ("technologyNames", "Rust"),
        ],
    )
    pid = base.created_id_from(status, hdrs, data)
    links = project_links(pid)
    ok("T2 multi-option project created", bool(pid))
    ok("T2 three picked options + custom persisted", len(links) == 4, links)
    rust = base.scalar("select id from technologies where slug = 'rust'")
    ok("T2 custom technology upserted", len(rust) == 1)
    linked = {row["technology_id"] for row in links}
    ok(
        "T2 custom technology linked too",
        linked == {REACT_ID, TS_ID, PG_ID, rust[0]["id"]},
        linked,
    )
    return pid


def t3_none_rejected(session):
    before = base.scalar("select count(*) as n from projects")[0]["n"]
    status, _, data = wizard(session, title="No stack project")
    body = data.decode(errors="replace") if isinstance(data, bytes) else data
    after = base.scalar("select count(*) as n from projects")[0]["n"]
    ok("T3 empty stack is rejected (no redirect)", status == 200, status)
    ok("T3 the real validation error is shown", "Add at least one technology." in body)
    ok("T3 failed submission created ZERO rows", before == after, (before, after))


def t4_duplicates_deduped(session):
    status, hdrs, data = wizard(
        session,
        title="Duplicate inputs",
        tech_entries=[
            ("technologyIds", REACT_ID),
            ("technologyIds", REACT_ID),
            ("technologyNames", "Rust"),
            ("technologyNames", "rust"),
        ],
    )
    pid = base.created_id_from(status, hdrs, data)
    links = project_links(pid)
    rust = base.scalar("select id from technologies where slug = 'rust'")
    ok("T4 duplicate submissions accepted", bool(pid))
    ok(
        "T4 duplicate ids/names collapse to one row each",
        len(links) == 2 and len(rust) == 1,
        (links, rust),
    )


def t5_publish_intent(session):
    # Re-open the panel first so the publish below is provably the ONE unread.
    base.get("/dashboard/notifications", cookie=session)
    status, hdrs, data = wizard(
        session,
        title="Published stack project",
        tech_entries=[("technologyIds", TS_ID)],
        intent="publish",
    )
    pid = base.created_id_from(status, hdrs, data)
    row = base.scalar(
        f"select publication_status as s, submitted_at is not null as st "
        f"from projects where id = '{pid}'"
    )[0]
    ok(
        "T5 publish intent persists (submitted for review under moderation)",
        row["s"] == "submitted" and row["st"],
        row,
    )
    ok("T5 publishing produces a genuine unread event", unread_count(session) == 1)
    ok("T5 technologies persisted on the published project", len(project_links(pid)) == 1)


def main():
    print(f"suite db: {base.DB_NAME}   uploads scratch: {base.UPLOADS_DIR}")
    try:
        base.ensure_database()
        base.truncate()
        # Realistic fixture: the moderation queue on, so publish → submitted
        # and the REAL admin approve flow can generate a moderator decision.
        base.psql(
            "INSERT INTO settings (key, value) VALUES ('moderation_enabled', 'true') "
            "ON CONFLICT (key) DO UPDATE SET value = 'true'"
        )
        if os.path.isdir(base.UPLOADS_DIR):
            base.subprocess.run(["rm", "-rf", base.UPLOADS_DIR], check=False)

        base.stop_next_dev()
        print(f"starting next dev on :{base.PORT} (log: {base.DEV_LOG})")
        base.start_server()
        base.sentinel()

        base.signup(base.USER_A)
        base.signup(base.USER_B)
        base.signup(USER_C)
        session_a = base.login(base.USER_A)
        session_b = base.login(base.USER_B)
        session_c = base.login(USER_C)

        # ---- bug 1: the bell tracks REAL unread notifications
        n1_fresh_account_dark(session_a)
        project_id = n2_event_lights_indicator(session_a)
        n3_opening_panel_marks_read(session_a, project_id)
        n4_new_moderation_event_unreads_again(session_a, session_c, project_id)
        n5_no_user_leak(session_a, session_b)
        n6_anonymous()
        n7_mark_read_endpoint(session_a)

        # ---- bug 2: one source of truth for selected technologies
        seed_technologies()
        t1_single_option(session_a)
        t2_multiple_plus_custom(session_a)
        t3_none_rejected(session_a)
        t4_duplicates_deduped(session_a)
        t5_publish_intent(session_a)

        print(f"\nALL {len(base._checks)} CHECKS PASSED")
    finally:
        print("cleaning up scratch DB + servers…")
        try:
            base.truncate()
            # Leave the scratch DB exactly as other suites expect it.
            base.psql("DELETE FROM settings WHERE key = 'moderation_enabled'")
        except Exception as exc:  # best effort — never mask the real failure
            print(f"  cleanup truncate failed: {exc}")
        base.subprocess.run(["rm", "-rf", base.UPLOADS_DIR], check=False)
        base.subprocess.run(["pkill", "-f", "next dev"], cwd=base.CWD)


if __name__ == "__main__":
    main()
