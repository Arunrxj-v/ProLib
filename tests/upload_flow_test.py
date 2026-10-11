#!/usr/bin/env python3
"""ProLib Add-Project upload architecture acceptance suite.

    python3 tests/upload_flow_test.py     # or: npm run test:uploads

Self-contained — no pre-running server needed. Refuses to run against the
real database (defaults to `prolib_test`) and points STORAGE_PATH at a
scratch directory so the real `storage/uploads/**` assets are never read,
written or deleted.

What it exercises (the REAL code paths end-to-end):
  * the wizard Server Action via progressive-enhancement POST — the same
    multipart/$ACTION encoding React uses for the no-JS fallback
  * the dedicated authenticated upload endpoint
    `POST /api/projects/:id/images` (owner-gated; type/size/count
    validation in the shared storage/service layer)

Root causes locked down:
  ERROR 1 — `<form action={fn} encType="multipart/form-data">` is rejected
            by React (it supplies the encoding itself, including for the
            no-JS fallback). The wizard form must carry neither encType
            nor method.
  ERROR 2 — Next caps Server Action bodies at 1 MB by default, but the
            wizard's action legitimately carries the required cover image
            (up to UPLOAD_RULES.maxBytes = 4 MB). The config raises the
            ceiling to a documented 6 MB; screenshots never ride action
            bodies — they go to the dedicated endpoint.

Scenarios:
  S0  static guards        — wizard form has no encType; bodySizeLimit set
  T1  new-project page     — renders for the owner; anon → /login
  T2  create w/o cover     — rejected with the real cover error, ZERO rows
                             (failed submissions create nothing)
  T3  create draft, 2 MB   — 303 + draft row + cover file >1 MB on disk
      cover                   (the exact "Body exceeded 1 MB limit" repro)
  T4  create + publish     — intent=publish → published/submitted, 303
  T5  gallery upload       — 2 valid PNGs via the endpoint → 201, 2 rows,
                             2 files; list persists on a fresh page load
  T6  invalid file type    — .txt rejected → 400, nothing stored
  T7  oversized file       — 5 MB rejected → 400, nothing stored
  T8  file count           — 11 files rejected → 400 (server-side cap)
  T9  anonymous upload     — 401, nothing stored
  T10 other-user isolation — user B cannot attach to or delete from A's
                             project → 403, nothing stored, rows intact
  T11 persistence          — fresh GETs show cover + screenshots; a
                             second failed create adds no duplicate row
"""
import base64
import http.client
import json
import os
import re
import socket
import subprocess
import sys
import time
import uuid
from html import unescape

HOST, PORT = "localhost", 3000
CWD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- isolation
DB_NAME = os.environ.get("PROLIB_TEST_DB", "prolib_test")
UPLOADS_DIR = os.environ.get(
    "PROLIB_TEST_UPLOADS", "/tmp/prolib-upload-test-uploads"
)
DB_URL = f"postgres://prolib:prolib@127.0.0.1:5432/{DB_NAME}"
DEV_LOG = "/tmp/prolib-upload-dev.log"

if DB_NAME == "prolib":
    sys.exit("refusing to run against the real database `prolib` — set PROLIB_TEST_DB")

ALLOWED_DOMAIN = (
    os.environ.get("ALLOWED_COLLEGE_EMAIL_DOMAINS", "ceconline.edu")
    .split(",")[0]
    .strip()
    .lstrip("@")
    .lower()
)

# A real 1×1 PNG. saveUpload only validates the declared MIME + size, but a
# genuine header keeps the bytes honest; decoders ignore data after IEND, so
# padding with zeros reaches any size.
PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
    "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def png_of(size):
    if size <= len(PNG_1X1):
        return PNG_1X1
    return PNG_1X1 + b"\x00" * (size - len(PNG_1X1))


USER_A = {
    "name": "Aisha Rahman",
    "username": "aishar",
    "email": f"aisha.student@{ALLOWED_DOMAIN}",
    "password": "BridgeHall2026",
}
USER_B = {
    "name": "Ben Joseph",
    "username": "benjoe",
    "email": f"ben.student@{ALLOWED_DOMAIN}",
    "password": "SignalBlock2026",
}

_checks = []


def ok(label, cond=True, extra=""):
    if not cond:
        raise AssertionError(f"{label} — {extra}")
    _checks.append(label)
    print(f"  ok  {label}")


# ---------------------------------------------------------------- HTTP utils
def request(method, path, body=None, headers=None, cookie=None, timeout=120):
    h = dict(headers or {})
    if cookie:
        h["Cookie"] = f"prolib_session={cookie}"
    conn = http.client.HTTPConnection(HOST, PORT, timeout=timeout)
    conn.request(method, path, body=body, headers=h)
    res = conn.getresponse()
    data = res.read()
    hdrs, cookies = {}, []
    for k, v in res.getheaders():
        lk = k.lower()
        if lk == "set-cookie":
            cookies.append(v)
        else:
            hdrs.setdefault(k, v)
    if cookies:
        hdrs["Set-Cookie"] = "; ".join(cookies)
        hdrs["_set_cookies"] = cookies
    conn.close()
    return res.status, hdrs, data


def get(path, cookie=None):
    status, hdrs, data = request("GET", path, cookie=cookie)
    return status, hdrs, data.decode(errors="replace")


def api(method, path, cookie=None, json_body=None, body=None, headers=None):
    send_body = body
    send_headers = dict(headers or {})
    if json_body is not None:
        send_body = json.dumps(json_body).encode()
        send_headers["Content-Type"] = "application/json"
    status, hdrs, data = request(
        method, path, body=send_body, headers=send_headers, cookie=cookie
    )
    content_type = (hdrs.get("Content-Type") or hdrs.get("content-type") or "").lower()
    text = data.decode(errors="replace")
    payload = None
    if "application/json" in content_type:
        payload = json.loads(text) if text else None
    if status >= 400 and "application/json" not in content_type:
        raise AssertionError(
            f"{method} {path} → {status} non-JSON: {content_type} {text[:200]}"
        )
    return status, payload, hdrs, text, data


def location(hdrs):
    loc = hdrs.get("Location") or hdrs.get("location")
    if loc and loc.startswith("http://localhost:3000"):
        loc = loc[len("http://localhost:3000"):]
    return loc


def session_of(hdrs):
    m = re.search(r"prolib_session=([^;]+)", hdrs.get("Set-Cookie") or "")
    return m.group(1) if m else None


def hidden_fields(html_text):
    fields = {}
    for tag in re.findall(r"<input\b[^>]*>", html_text):
        name = re.search(r'\bname="([^"]+)"', tag)
        if not name or "hidden" not in tag:
            continue
        value = re.search(r'\bvalue="([^"]*)"', tag)
        fields[name.group(1)] = unescape(value.group(1)) if value else ""
    return fields


def form_block(html_text, marker=None):
    for m in re.finditer(r"<form\b.*?</form>", html_text, re.S):
        block = m.group(0)
        if marker is not None:
            if marker in block:
                return block
        elif "$ACTION" in block:
            return block
    if marker is not None:
        raise AssertionError(f"form containing {marker!r} not found")
    return html_text


def multipart_parts(entries):
    """entries: (name, str) or (name, bytes, filename, content_type).

    File parts carry a real Content-Type so the server-side File.type is
    the declared MIME — exactly what a browser's FormData produces.
    """
    boundary = uuid.uuid4().hex
    raw = b""
    for entry in entries:
        name, value = entry[0], entry[1]
        if isinstance(value, bytes):
            filename, ctype = entry[2], entry[3]
            raw += (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                f"Content-Type: {ctype}\r\n\r\n"
            ).encode() + value + b"\r\n"
        else:
            raw += (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                f"{value}\r\n"
            ).encode()
    raw += f"--{boundary}--\r\n".encode()
    return raw, f"multipart/form-data; boundary={boundary}"


def post_action(path, html_text, entries, cookie=None, marker=None):
    """Progressive-enhancement POST: $ACTION hidden fields + the given parts."""
    fields = hidden_fields(form_block(html_text, marker))
    action_entries = [(k, v) for k, v in fields.items()]
    if not any(k.startswith("$ACTION") for k, _ in action_entries):
        raise AssertionError(f"no $ACTION fields on {path}")
    body, ctype = multipart_parts(action_entries + list(entries))
    return request(
        "POST", path, body=body, headers={"Content-Type": ctype}, cookie=cookie
    )


# --------------------------------------------------------------- postgres utils
def psql(sql):
    out = subprocess.run(
        [
            "docker", "exec", "prolib-postgres",
            "psql", "-U", "prolib", "-d", DB_NAME, "-Atc", sql,
        ],
        capture_output=True, text=True, cwd=CWD,
    )
    if out.returncode != 0:
        raise AssertionError(out.stderr)
    return out.stdout.strip()


def scalar(sql):
    return json.loads(psql(f"select coalesce(json_agg(r),'[]') from ({sql}) r"))


def truncate():
    """Clean slate for the scratch DB — departments (migration seed) survive."""
    psql(
        "TRUNCATE project_members, project_likes, project_sections, project_images, "
        "project_technologies, reports, audit_logs, sessions, social_links, "
        "github_accounts, github_repositories, verification_tokens, projects, "
        "technologies, users RESTART IDENTITY CASCADE"
    )


def stored_files():
    """Every file in the SCRATCH uploads tree (never the real storage/)."""
    if not os.path.isdir(UPLOADS_DIR):
        return []
    out = subprocess.run(
        ["find", UPLOADS_DIR, "-type", "f"], capture_output=True, text=True
    )
    return sorted(line for line in out.stdout.splitlines() if line)


# ----------------------------------------------------------- server management
def port_open():
    s = socket.socket()
    s.settimeout(2)
    try:
        s.connect((HOST, PORT))
        return True
    except OSError:
        return False
    finally:
        s.close()


def ensure_database():
    out = subprocess.run(
        [
            "docker", "exec", "prolib-postgres",
            "psql", "-U", "prolib", "-d", "postgres", "-Atc",
            f"select 1 from pg_database where datname='{DB_NAME}'",
        ],
        capture_output=True, text=True, cwd=CWD,
    )
    if out.returncode != 0:
        raise AssertionError(out.stderr)
    if out.stdout.strip() != "1":
        subprocess.run(
            [
                "docker", "exec", "prolib-postgres",
                "psql", "-U", "prolib", "-d", "postgres", "-Atc",
                f'create database "{DB_NAME}"',
            ],
            check=True, capture_output=True, text=True, cwd=CWD,
        )
        print(f"  created database {DB_NAME}")
    env = dict(os.environ, DATABASE_URL=DB_URL)
    proc = subprocess.run(
        ["npm", "run", "db:migrate"], cwd=CWD, env=env,
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise AssertionError(f"db:migrate failed:\n{proc.stdout}\n{proc.stderr}")


def server_env():
    env = dict(os.environ)
    for key in ("NEXT_PUBLIC_APP_URL", "APP_URL", "API_URL", "FRONTEND_URL"):
        env.pop(key, None)
    env.update(
        {
            "PROLIB_TEST_DB": DB_NAME,
            "PROLIB_TEST_UPLOADS": UPLOADS_DIR,
            "DATABASE_URL": DB_URL,
            # Scratch uploads tree — the real storage/uploads/** is never
            # read, written or deleted by this suite.
            "STORAGE_PATH": UPLOADS_DIR,
        }
    )
    return env


def stop_next_dev():
    subprocess.run(["pkill", "-f", "next dev"], cwd=CWD)
    for _ in range(10):
        if not port_open():
            return
        time.sleep(1)
    if port_open():
        raise AssertionError(
            "port 3000 still in use after stopping `next dev` — run "
            "`docker compose stop app` (a foreign container binds it) and retry"
        )


def start_server():
    with open(DEV_LOG, "w") as log:
        proc = subprocess.Popen(
            ["npm", "run", "dev"], cwd=CWD, env=server_env(),
            stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
        )
    for _ in range(60):
        time.sleep(1.5)
        try:
            status, _, _ = request("GET", "/")
            if status == 200:
                return proc
        except Exception:
            continue
    raise AssertionError(f"server did not come up — see {DEV_LOG}")


def sentinel():
    """Prove :3000 is *our* scratch server before trusting any result."""
    status, payload, _, _, _ = api("GET", "/api/auth/login")
    ids = {p["id"]: p["enabled"] for p in payload["providers"]}
    ok("sentinel: password provider present", ids.get("password") is True, payload)
    status, payload, _, _, _ = api("GET", "/api/projects?page=1&limit=10")
    ok("sentinel: scratch DB (0 projects)", payload.get("total") == 0, payload)
    status, payload, _, _, _ = api("GET", "/api/auth/me")
    ok("sentinel: scratch DB (no session)", payload.get("authenticated") is False, payload)


# ---------------------------------------------------------------- accounts
def signup(user):
    status, _, html = get("/signup")
    assert status == 200, status
    status, hdrs, data = post_action(
        "/signup", html,
        [
            ("name", user["name"]),
            ("username", user["username"]),
            ("email", user["email"]),
            ("password", user["password"]),
            ("confirm", user["password"]),
            ("terms", "on"),
        ],
    )
    loc = location(hdrs)
    assert status in (302, 303) and loc and loc.startswith("/verify-email?email="), (
        status, loc, data[:300]
    )
    m = re.search(r"devToken=([^&]+)", loc)
    assert m, f"no development verification link on {loc}"
    vstatus, _, _ = request("GET", f"/api/auth/verify-email?token={m.group(1)}")
    assert vstatus in (302, 303), vstatus


def login(user):
    status, _, html = get("/login")
    assert status == 200, status
    status, hdrs, data = post_action(
        "/login", html,
        [("email", user["email"]), ("password", user["password"])],
        marker="login-email",
    )
    loc = location(hdrs)
    assert status in (302, 303) and loc == "/dashboard", (status, loc, data[:300])
    session = session_of(hdrs)
    assert session, hdrs
    return session


# ------------------------------------------------------------ wizard actions
def create_project(session, *, title, cover=None, intent="draft"):
    """Drives the REAL wizard form the way React does (no-JS encoding)."""
    status, _, html = get("/dashboard/projects/new", cookie=session)
    assert status == 200, status
    entries = [
        ("title", title),
        ("shortDescription", "A bridge hall kiosk for the campus project archive."),
        ("projectType", "academic"),
        ("status", "in_progress"),
        ("intent", intent),
        ("technologyNames", "TestStack"),
    ]
    if cover is not None:
        entries.append(("cover", cover, "cover.png", "image/png"))
    return post_action(
        "/dashboard/projects/new", html, entries, cookie=session, marker="w-cover"
    )


def created_id_from(status, hdrs, data):
    loc = location(hdrs)
    if status not in (301, 302, 303, 307, 308):
        raise AssertionError(f"create did not redirect: {status} {data[:400]}")
    m = re.match(r"/dashboard/projects/([0-9a-f-]+)/edit\?", loc or "")
    assert m, f"unexpected post-create location: {loc}"
    return m.group(1)


# ---------------------------------------------------------------- scenarios
def t1_new_page(session_a):
    print("== T1 /dashboard/projects/new renders without errors")
    status, _, html = get("/dashboard/projects/new")
    ok("T1 anonymous → login redirect", status in (301, 302, 303, 307, 308), status)

    status, _, html = get("/dashboard/projects/new", cookie=session_a)
    ok("T1 page renders 200", status == 200, status)
    ok("T1 wizard form present", 'name="cover"' in html and "w-cover" in html)
    ok(
        "T1 Server Action bound (progressive enhancement)",
        "$ACTION" in html,
        "no $ACTION hidden fields — the form cannot POST",
    )


def t2_create_without_cover(session_a):
    print("== T2 create without cover → rejected, nothing created")
    before = scalar("select count(*) as n from projects")[0]["n"]
    status, hdrs, data = create_project(
        session_a, title="Kiosk No Cover", cover=None
    )
    ok("T2 no redirect (action returned fieldErrors)", status == 200, status)
    ok(
        "T2 real cover error surfaced",
        b"Add a cover image" in data if isinstance(data, bytes) else False,
        data[:200],
    )
    ok(
        "T2 zero project rows created",
        scalar("select count(*) as n from projects")[0]["n"] == before,
    )
    ok("T2 no file written to disk", len(stored_files()) == 0, stored_files())


def t3_draft_with_large_cover(session_a):
    print("== T3 draft with a 2 MB cover (the 1 MB limit repro)")
    big_cover = png_of(2 * 1024 * 1024)
    status, hdrs, data = create_project(
        session_a, title="Bridge Hall Kiosk", cover=big_cover
    )
    project_id = created_id_from(status, hdrs, data)
    ok("T3 create redirected to the edit page", bool(project_id), location(hdrs))

    rows = scalar(
        "select publication_status as pub, cover_image as cover from projects where id = '%s'"
        % project_id
    )
    ok("T3 draft row written", rows and rows[0]["pub"] == "draft", rows)
    cover_path = rows[0]["cover"] if rows else ""
    ok(
        "T3 cover stored under /uploads/projects/",
        bool(cover_path) and cover_path.startswith("/uploads/projects/"),
        cover_path,
    )

    # Disk layout: STORAGE_ROOT/<cover_path> — cover_path already starts
    # with /uploads/, so it is relative to the scratch STORAGE_PATH root.
    absolute = os.path.join(UPLOADS_DIR, cover_path.lstrip("/"))
    on_disk = os.path.isfile(absolute)
    ok("T3 cover file exists on disk", on_disk, absolute)
    if on_disk:
        size = os.path.getsize(absolute)
        ok(
            "T3 file is >1 MB (old limit would have rejected this)",
            size > 1024 * 1024,
            size,
        )

    status, _, html = get(f"/dashboard/projects/{project_id}/edit", cookie=session_a)
    ok("T3 edit page renders", status == 200, status)
    return project_id, cover_path


def t4_publish_with_cover(session_a):
    print("== T4 create with intent=publish")
    status, hdrs, data = create_project(
        session_a,
        title="Signal Block Analyzer",
        cover=png_of(128 * 1024),
        intent="publish",
    )
    project_id = created_id_from(status, hdrs, data)
    loc = location(hdrs)
    ok("T4 redirect announces publication", "published=" in (loc or ""), loc)

    rows = scalar(
        "select publication_status as pub from projects where id = '%s'" % project_id
    )
    ok(
        "T4 published (or submitted under moderation)",
        rows and rows[0]["pub"] in ("published", "submitted"),
        rows,
    )
    return project_id


def gallery_post(session, project_id, files):
    """files: list of (filename, bytes, content_type)."""
    entries = [
        ("images", content, name, ctype) for (name, content, ctype) in files
    ]
    raw, ctype = multipart_parts(entries)
    return api(
        "POST",
        f"/api/projects/{project_id}/images",
        cookie=session,
        body=raw,
        headers={"Content-Type": ctype},
    )


def t5_gallery_upload(session_a, project_id, published_id):
    print("== T5 screenshots via the dedicated upload endpoint")
    files_before = len(stored_files())
    rows_before = scalar("select count(*) as n from project_images")[0]["n"]

    status, payload, _, _, _ = gallery_post(
        session_a,
        project_id,
        [
            ("kiosk-1.png", png_of(4096), "image/png"),
            ("kiosk-2.png", png_of(8192), "image/png"),
        ],
    )
    ok("T5 upload 201", status == 201, (status, payload))
    ok(
        "T5 honest success message",
        (payload or {}).get("info") == "2 images added to the gallery.",
        payload,
    )
    images = (payload or {}).get("images") or []
    ok("T5 image references returned", len(images) == 2, payload)
    ok(
        "T5 references are /uploads/galleries/ paths",
        all(img["path"].startswith("/uploads/galleries/") for img in images),
        images,
    )
    ok(
        "T5 2 rows in project_images",
        scalar("select count(*) as n from project_images")[0]["n"] == rows_before + 2,
    )
    ok(
        "T5 2 files written to the scratch tree",
        len(stored_files()) == files_before + 2,
        stored_files(),
    )
    ok(
        "T5 no token/path leaked beyond the reference",
        "absolutePath" not in json.dumps(payload),
        payload,
    )

    # Refresh = a fresh server render; the list must come from the database.
    status, _, html = get(f"/dashboard/projects/{project_id}/edit", cookie=session_a)
    ok("T5 edit page renders after refresh", status == 200, status)
    ok(
        "T5 gallery persists on the reloaded page",
        "/uploads/galleries/" in html,
    )

    # The published project gets a screenshot too — the public page must
    # render cover + gallery from the database (asserted in T11).
    status, payload, _, _, _ = gallery_post(
        session_a, published_id, [("live-demo.png", png_of(4096), "image/png")]
    )
    ok("T5 screenshot on the published project 201", status == 201, (status, payload))
    return images


def t6_invalid_type_rejected(session_a, project_id):
    print("== T6 invalid file type rejected")
    rows_before = scalar("select count(*) as n from project_images")[0]["n"]
    files_before = len(stored_files())

    status, payload, _, _, _ = gallery_post(
        session_a, project_id, [("notes.txt", b"plain text", "text/plain")]
    )
    ok("T6 rejected with 400", status == 400, (status, payload))
    ok(
        "T6 honest type error",
        "Unsupported file type" in (payload or {}).get("message", ""),
        payload,
    )
    ok(
        "T6 no row added",
        scalar("select count(*) as n from project_images")[0]["n"] == rows_before,
    )
    ok("T6 nothing stored", len(stored_files()) == files_before, stored_files())


def t7_oversized_rejected(session_a, project_id):
    print("== T7 oversized file rejected")
    rows_before = scalar("select count(*) as n from project_images")[0]["n"]
    files_before = len(stored_files())

    status, payload, _, _, _ = gallery_post(
        session_a, project_id, [("huge.png", png_of(5 * 1024 * 1024), "image/png")]
    )
    ok("T7 rejected with 400", status == 400, (status, payload))
    ok(
        "T7 honest size error",
        "File is too large" in (payload or {}).get("message", ""),
        payload,
    )
    ok(
        "T7 no row added",
        scalar("select count(*) as n from project_images")[0]["n"] == rows_before,
    )
    ok(
        "T7 the oversized file was never written",
        len(stored_files()) == files_before,
        stored_files(),
    )


def t8_file_count_capped(session_a, project_id):
    print("== T8 batch file count validated server-side")
    rows_before = scalar("select count(*) as n from project_images")[0]["n"]
    files_before = len(stored_files())

    files = [
        (f"batch-{i}.png", png_of(256), "image/png") for i in range(11)
    ]
    status, payload, _, _, _ = gallery_post(session_a, project_id, files)
    ok("T8 rejected with 400", status == 400, (status, payload))
    ok(
        "T8 honest count error",
        "Upload at most 10" in (payload or {}).get("message", ""),
        payload,
    )
    ok(
        "T8 whole batch refused — nothing stored",
        scalar("select count(*) as n from project_images")[0]["n"] == rows_before
        and len(stored_files()) == files_before,
        (scalar("select count(*) as n from project_images"), stored_files()),
    )


def t9_anonymous_upload_rejected(project_id):
    print("== T9 anonymous upload rejected")
    files_before = len(stored_files())
    status, payload, _, _, _ = gallery_post(
        None, project_id, [("anon.png", png_of(512), "image/png")]
    )
    ok("T9 rejected with 401", status == 401, (status, payload))
    ok("T9 nothing stored", len(stored_files()) == files_before, stored_files())


def t10_other_user_isolated(session_b, published_id, draft_id, draft_cover):
    print("== T10 another user cannot attach to or delete from A's projects")
    rows_before = scalar("select count(*) as n from project_images")[0]["n"]
    files_before = len(stored_files())

    # Attach: the published project is visible to B, so the OWNER check must
    # answer 403 (the private draft answers 404 — existence is never leaked).
    status, payload, _, _, _ = gallery_post(
        session_b, published_id, [("ben.png", png_of(512), "image/png")]
    )
    ok("T10 attach to published → 403", status == 403, (status, payload))

    status, payload, _, _, _ = gallery_post(
        session_b, draft_id, [("ben.png", png_of(512), "image/png")]
    )
    ok("T10 attach to private draft → 404", status == 404, (status, payload))

    ok(
        "T10 nothing was attached",
        scalar("select count(*) as n from project_images")[0]["n"] == rows_before
        and len(stored_files()) == files_before,
    )

    # Delete: B cannot remove A's screenshot either.
    victim = scalar(
        "select id from project_images where project_id = '%s' limit 1" % draft_id
    )[0]["id"]
    status, payload, _, _, _ = api(
        "DELETE", f"/api/projects/{draft_id}/images/{victim}", cookie=session_b
    )
    ok("T10 delete on private draft → 404", status == 404, (status, payload))
    ok(
        "T10 image row intact",
        scalar(
            "select count(*) as n from project_images where id = '%s'" % victim
        )[0]["n"]
        == 1,
    )

    # And the owner can still use both endpoints.
    status, _, _, _, _ = api(
        "DELETE", f"/api/projects/{draft_id}/images/{victim}", cookie=SESSION_A
    )
    ok("T10 owner delete works", status == 200, status)

    # The draft's cover belongs to A and survives every other-user attempt.
    ok(
        "T10 A's cover untouched",
        scalar("select cover_image as c from projects where id = '%s'" % draft_id)[0]["c"]
        == draft_cover,
    )


def t11_persistence(session_a, draft_id, draft_cover, published_id):
    print("== T11 metadata + screenshots persist; failures duplicate nothing")
    status, _, html = get(f"/dashboard/projects/{draft_id}/edit", cookie=session_a)
    ok("T11 edit page 200 on a fresh GET", status == 200, status)
    ok("T11 cover reference present", draft_cover in html, draft_cover)

    # The public page of the PUBLISHED project — a private draft correctly
    # answers 404 for anonymous visitors, so only the published one counts.
    pub_slug = scalar("select slug from projects where id = '%s'" % published_id)[0]["slug"]
    status, _, html = get(f"/projects/{pub_slug}")
    ok("T11 public project page 200", status == 200, status)
    ok("T11 public page carries the cover", "/uploads/projects/" in html)
    ok("T11 public page carries the gallery", "/uploads/galleries/" in html)

    before = scalar("select count(*) as n from projects")[0]["n"]
    status, _, _ = create_project(session_a, title="", cover=png_of(512))
    ok("T11 second failed create → no redirect", status == 200, status)
    ok(
        "T11 no duplicate/partial project row",
        scalar("select count(*) as n from projects")[0]["n"] == before,
    )


SESSION_A = None


# ------------------------------------------------------------------- main
def static_guards():
    print("== S0 static guards")
    wizard = open(os.path.join(CWD, "src/components/dashboard/ProjectWizard.tsx")).read()
    ok(
        "S0 wizard form carries no encType attribute (React owns the encoding)",
        'encType="' not in wizard and "encType={" not in wizard,
    )
    config = open(os.path.join(CWD, "next.config.ts")).read()
    ok("S0 bodySizeLimit configured for cover uploads", "bodySizeLimit" in config)


def main():
    global SESSION_A

    print(f"suite db: {DB_NAME}   uploads scratch: {UPLOADS_DIR}")
    static_guards()

    try:
        ensure_database()
        truncate()
        if os.path.isdir(UPLOADS_DIR):
            subprocess.run(["rm", "-rf", UPLOADS_DIR], check=False)

        ok(
            "precondition: 0 projects",
            scalar("select count(*) as n from projects")[0]["n"] == 0,
        )

        stop_next_dev()
        print(f"starting next dev on :{PORT} (log: {DEV_LOG})")
        start_server()
        sentinel()

        signup(USER_A)
        signup(USER_B)
        SESSION_A = login(USER_A)
        session_b = login(USER_B)

        t1_new_page(SESSION_A)
        t2_create_without_cover(SESSION_A)
        draft_id, draft_cover = t3_draft_with_large_cover(SESSION_A)
        published_id = t4_publish_with_cover(SESSION_A)
        t5_gallery_upload(SESSION_A, draft_id, published_id)
        t6_invalid_type_rejected(SESSION_A, draft_id)
        t7_oversized_rejected(SESSION_A, draft_id)
        t8_file_count_capped(SESSION_A, draft_id)
        t9_anonymous_upload_rejected(draft_id)
        t10_other_user_isolated(session_b, published_id, draft_id, draft_cover)
        t11_persistence(SESSION_A, draft_id, draft_cover, published_id)

        print(f"\nALL {len(_checks)} CHECKS PASSED")
    finally:
        print("cleaning up scratch DB + servers…")
        try:
            truncate()
        except Exception as exc:  # best effort — never mask the real failure
            print(f"  cleanup truncate failed: {exc}")
        subprocess.run(["rm", "-rf", UPLOADS_DIR], check=False)
        subprocess.run(["pkill", "-f", "next dev"], cwd=CWD)


if __name__ == "__main__":
    main()
