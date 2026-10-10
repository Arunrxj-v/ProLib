#!/usr/bin/env python3
"""ProLib Google Sign-In college-domain acceptance suite.

Self-contained — no pre-running server and no real Google account needed:

    python3 tests/google_signin_test.py

What it does:
  * refuses to run against the real database (defaults to `prolib_test`,
    hard-stops if pointed at `prolib`)
  * boots an in-process fake Google (token + userinfo endpoints) so the
    REAL authorization-code exchange runs end-to-end without google.com
  * starts its own `next dev` on :3000 with the scratch DB and the
    dev-only endpoint overrides (ignored in production builds)
  * proves the six brief scenarios plus CSRF / unverified / spoof bonuses
  * truncates the scratch DB on exit (the four seeded departments survive)

Scenarios:
  T0  forged OAuth state           → rejected, no user/session
  T1  allowed college email        → session + verified user created
  T2  non-college Gmail            → rejected, exact error copy, no row
  T3  non-college domain/outlook   → rejected, no row
  T3b Google-unverified address    → rejected even on the college domain
  T4  existing password user       → Google links to the same user, no duplicate
  T5  repeated Google login        → same ProLib user, counts unchanged
  T6  logout                       → that session removed server-side
"""
import http.client
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
import uuid
from html import unescape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlencode, urlsplit
from urllib.request import Request, urlopen

HOST, PORT = "localhost", 3000
CWD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- isolation
DB_NAME = os.environ.get("PROLIB_TEST_DB", "prolib_test")
UPLOADS_DIR = os.environ.get("PROLIB_TEST_UPLOADS", "/tmp/prolib-google-uploads")
DB_URL = f"postgres://prolib:prolib@127.0.0.1:5432/{DB_NAME}"
DEV_LOG = "/tmp/prolib-google-dev.log"

if DB_NAME == "prolib":
    sys.exit("refusing to run against the real database `prolib` — set PROLIB_TEST_DB")

# The instance's college domain (the address style the real production user
# uses). Overridable for experiments; the suite passes the same value on to
# the server so expectations always match the configured policy.
ALLOWED_DOMAIN = (
    os.environ.get("ALLOWED_COLLEGE_EMAIL_DOMAINS", "ceconline.edu")
    .split(",")[0]
    .strip()
    .lstrip("@")
    .lower()
)

# Google profiles the fake provider answers with, keyed by OAuth `code`.
# Mixed case on the allowed address proves normalisation happens server-side.
PROFILES = {
    "college-mixed-case": {
        "sub": "g-oauth-1001",
        "email": "New.Student@CECONLINE.EDU",
        "verified": True,
        "name": "New Student",
        "hd": ALLOWED_DOMAIN,
    },
    "gmail-code": {
        "sub": "g-oauth-1002",
        "email": "random.dev@gmail.com",
        "verified": True,
        "name": "Dev Random",
    },
    "outlook-code": {
        "sub": "g-oauth-1003",
        "email": "contractor@outlook.com",
        "verified": True,
        "name": "Outlook User",
    },
    "unverified-code": {
        "sub": "g-oauth-1004",
        "email": f"unverified.student@{ALLOWED_DOMAIN}",
        "verified": False,
        "name": "Unverified Student",
        "hd": ALLOWED_DOMAIN,
    },
    # "existing-code" is registered at runtime in T4 — its address belongs to
    # the user the suite creates through the real password sign-up flow.
}

EXISTING = {
    "name": "Riya Sharma",
    "username": "riyash",
    "email": f"riya.student@{ALLOWED_DOMAIN}",
    "password": "CampusGate2026",
}

_checks = []


def ok(label, cond=True, extra=""):
    if not cond:
        raise AssertionError(f"{label} — {extra}")
    _checks.append(label)
    print(f"  ok  {label}")


# ------------------------------------------------------------- fake Google
# Serves the two endpoints exchangeGoogleCode() calls (dev-only overrides):
#   POST /token    → echoes an access token for known codes (400 otherwise)
#   GET  /userinfo → profile for the code embedded in the bearer token
# The authorization page itself is never followed — only its `state` matters.

class FakeGoogle(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, status, obj):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if urlsplit(self.path).path != "/token":
            return self._json(404, {"error": "not_found"})
        length = int(self.headers.get("Content-Length") or 0)
        form = parse_qs(self.rfile.read(length).decode(errors="replace"))
        code = (form.get("code") or [""])[0]
        if code not in PROFILES:
            return self._json(400, {"error": "invalid_grant"})
        self._json(
            200,
            {
                "access_token": f"tok:{code}",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
        )

    def do_GET(self):
        if urlsplit(self.path).path != "/userinfo":
            return self._json(404, {"error": "not_found"})
        auth = self.headers.get("Authorization") or ""
        token = auth[len("Bearer ") :] if auth.startswith("Bearer ") else ""
        if not token.startswith("tok:"):
            return self._json(401, {"error": "unauthorized"})
        profile = PROFILES.get(token[len("tok:") :])
        if not profile:
            return self._json(401, {"error": "unauthorized"})
        body = {
            "sub": profile["sub"],
            "email": profile["email"],
            "email_verified": profile["verified"],
            "name": profile["name"],
        }
        if profile.get("hd"):
            body["hd"] = profile["hd"]
        self._json(200, body)


def boot_fake_google():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), FakeGoogle)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"

    # Self-check: a broken double would otherwise surface as a confusing
    # auth failure ten tests later.
    token_req = Request(
        f"{base}/token",
        data=urlencode({"code": "college-mixed-case"}).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urlopen(token_req) as res:
        tokens = json.load(res)
    assert "access_token" in tokens, tokens
    info_req = Request(
        f"{base}/userinfo", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    with urlopen(info_req) as res:
        profile = json.load(res)
    assert profile["email"] == PROFILES["college-mixed-case"]["email"], profile
    return httpd, base


# ---------------------------------------------------------------- HTTP utils
# Mirrors /tmp/prolib-backend-test.py so all suites speak the same dialect.

def request(method, path, body=None, headers=None, cookie=None, timeout=60):
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
    conn.close()
    return res.status, hdrs, data


def get(path, cookie=None):
    status, hdrs, data = request("GET", path, cookie=cookie)
    return status, hdrs, data.decode(errors="replace")


def api(method, path, cookie=None, json_body=None):
    body = None
    headers = {}
    if json_body is not None:
        body = json.dumps(json_body).encode()
        headers["Content-Type"] = "application/json"
    status, hdrs, data = request(method, path, body=body, headers=headers, cookie=cookie)
    content_type = (hdrs.get("Content-Type") or hdrs.get("content-type") or "").lower()
    text = data.decode(errors="replace")
    payload = None
    if "application/json" in content_type:
        payload = json.loads(text) if text else None
    if status >= 400 and "application/json" not in content_type:
        raise AssertionError(
            f"{method} {path} → {status} non-JSON: {content_type} {text[:200]}"
        )
    return status, payload, hdrs, text


def location(hdrs):
    loc = hdrs.get("Location") or hdrs.get("location")
    if loc and loc.startswith("http://localhost:3000"):
        loc = loc[len("http://localhost:3000") :]
    return loc


def cookie_map(hdrs):
    """prolib_* cookies from a joined Set-Cookie header (value → name)."""
    raw = hdrs.get("Set-Cookie") or ""
    out = {}
    for m in re.finditer(r"(prolib_[a-z_]+)=([^;]*)", raw):
        out.setdefault(m.group(1), m.group(2))
    return out


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
    """One <form> only — merging $ACTION fields from several forms breaks the POST."""
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


def multipart(fields):
    boundary = uuid.uuid4().hex
    raw = b""
    for k, v in fields.items():
        raw += (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n"
        ).encode()
    raw += f"--{boundary}--\r\n".encode()
    return raw, f"multipart/form-data; boundary={boundary}"


def post_action(path, html_text, values, cookie=None, marker=None):
    fields = hidden_fields(form_block(html_text, marker))
    if not any(k.startswith("$ACTION") for k in fields):
        raise AssertionError(f"no $ACTION fields on {path}")
    fields.update({k: str(v) for k, v in values.items()})
    body, ctype = multipart(fields)
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
    uploads = UPLOADS_DIR
    if os.path.isdir(uploads):
        subprocess.run(["rm", "-rf", uploads], check=False)


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
    """Create + migrate the scratch DB when missing (explicit step, never at boot)."""
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


def server_env(fake_base):
    env = dict(os.environ)
    # Absolute-URL origin must stay http://localhost:3000 (Location asserts).
    for key in ("NEXT_PUBLIC_APP_URL", "APP_URL", "API_URL", "FRONTEND_URL"):
        env.pop(key, None)
    env.update(
        {
            "PROLIB_TEST_DB": DB_NAME,
            "PROLIB_TEST_UPLOADS": UPLOADS_DIR,
            "DATABASE_URL": DB_URL,
            "STORAGE_PATH": UPLOADS_DIR,
            # GitHub off (recipe invariant) — not under test here.
            "GITHUB_CLIENT_ID": "",
            "GITHUB_CLIENT_SECRET": "",
            "GITHUB_CALLBACK_URL": "",
            # Google on, pointed at the local double. Endpoint overrides are
            # ignored in production builds (dev-only test seam).
            "GOOGLE_CLIENT_ID": "prolib-test-client",
            "GOOGLE_CLIENT_SECRET": "prolib-test-secret",
            "GOOGLE_AUTH_ENDPOINT": f"{fake_base}/auth",
            "GOOGLE_TOKEN_ENDPOINT": f"{fake_base}/token",
            "GOOGLE_USERINFO_ENDPOINT": f"{fake_base}/userinfo",
            "ALLOWED_COLLEGE_EMAIL_DOMAINS": ALLOWED_DOMAIN,
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


def start_server(fake_base):
    with open(DEV_LOG, "w") as log:
        proc = subprocess.Popen(
            ["npm", "run", "dev"], cwd=CWD, env=server_env(fake_base),
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
    """Prove :3000 is *our* scratch server before trusting any result.

    A foreign occupant (the docker app, someone else's dev server) would
    silently answer with the wrong Google policy and the wrong database.
    """
    status, payload, _, _ = api("GET", "/api/auth/login")
    ids = {p["id"]: p["enabled"] for p in payload["providers"]}
    ok(
        "sentinel: own server (Google enabled by suite env)",
        ids.get("google") is True,
        payload,
    )
    ok("sentinel: password provider present", ids.get("password") is True, payload)
    status, payload, _, _ = api("GET", "/api/projects?page=1&limit=10")
    ok("sentinel: scratch DB (0 projects)", payload.get("total") == 0, payload)


# ----------------------------------------------------------- OAuth round trip

def google_start(next_path=None):
    path = "/api/auth/google"
    if next_path:
        path += "?next=" + quote(next_path, safe="")
    status, hdrs, _ = request("GET", path)
    if status not in (301, 302, 303, 307, 308):
        raise AssertionError(f"google start → {status}: {hdrs}")
    loc = location(hdrs) or ""
    state = (parse_qs(urlsplit(loc).query).get("state") or [""])[0]
    if not state:
        raise AssertionError(f"no OAuth state in {loc}")
    if not loc.startswith(GOOGLE_BASE):
        raise AssertionError(f"authorize URL is not the local double: {loc}")
    cookies = cookie_map(hdrs)
    if "prolib_oauth_state" not in cookies:
        raise AssertionError(f"no state cookie issued: {hdrs}")
    return state, cookies


def google_callback(code, state, cookies, extra_query=""):
    path = (
        "/api/auth/callback/google?"
        + urlencode({"code": code, "state": state})
        + extra_query
    )
    header = "; ".join(f"{k}={v}" for k, v in cookies.items() if v)
    status, hdrs, data = request("GET", path, headers={"Cookie": header})
    return status, hdrs, data.decode(errors="replace")


# ------------------------------------------------------- password sign-up (T4)

def signup(user):
    status, _, html = get("/signup")
    assert status == 200, status
    # Migration 0004 seeds the four real departments — every selector shows them.
    for dept in ("CSE", "EEE", "ECE", "CS-AI"):
        assert f">{dept}</option>" in html, f"signup department missing: {dept}"
    status, hdrs, data = post_action(
        "/signup", html,
        {
            "name": user["name"],
            "username": user["username"],
            "email": user["email"],
            "password": user["password"],
            "confirm": user["password"],
            "terms": "on",
        },
    )
    loc = location(hdrs)
    assert status in (302, 303) and loc, (status, loc, data[:400])
    assert loc.startswith("/verify-email?email="), loc
    # Account starts UNVERIFIED — the emailed link is the only way through.
    row = scalar(
        "select email_verified_at as v from users where email = '%s'" % user["email"]
    )
    assert row and row[0]["v"] is None, f"emailVerified must start null: {row}"
    m = re.search(r"devToken=([^&]+)", loc)
    assert m, f"no development verification link on {loc}"
    vstatus, vhdrs, _ = request(
        "GET", f"/api/auth/verify-email?token={m.group(1)}"
    )
    assert vstatus in (302, 303), vstatus
    vloc = location(vhdrs)
    assert "status=verified" in vloc, vloc
    print(f"  signup+verify {user['username']} ok")


# ---------------------------------------------------------------- scenarios

def t0_state_csrf():
    print("== T0 forged OAuth state is rejected")
    state, cookies = google_start()
    status, hdrs, _ = google_callback("college-mixed-case", state + "-forged", cookies)
    loc = location(hdrs)
    ok("T0 forged state → /login?error=state", loc == "/login?error=state", (status, loc))
    ok("T0 no session cookie", session_of(hdrs) is None, hdrs)
    ok("T0 no user created", scalar("select count(*) as n from users")[0]["n"] == 0)
    ok("T0 no session row", scalar("select count(*) as n from sessions")[0]["n"] == 0)


def t1_allowed_college_email():
    print("== T1 allowed college email succeeds")
    state, cookies = google_start()
    status, hdrs, _ = google_callback("college-mixed-case", state, cookies)
    loc = location(hdrs)
    ok("T1 redirect to /dashboard", loc == "/dashboard", (status, loc))
    ok("T1 3xx status", status in (301, 302, 303, 307, 308), status)
    session = session_of(hdrs)
    ok("T1 session cookie set", bool(session), hdrs)

    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session)
    ok("T1 me authenticated", payload.get("authenticated") is True, payload)
    ok(
        "T1 mixed-case address normalised to the college domain",
        payload["user"]["email"] == f"new.student@{ALLOWED_DOMAIN}",
        payload,
    )

    rows = scalar(
        "select id, email_verified_at as v from users "
        "where email = 'new.student@%s'" % ALLOWED_DOMAIN
    )
    ok("T1 exactly one user row", len(rows) == 1, rows)
    ok("T1 verified immediately (Google proof)", rows[0]["v"] is not None, rows)
    ok("T1 one session row", scalar("select count(*) as n from sessions")[0]["n"] == 1)
    return session, rows[0]["id"]


def t2_gmail_rejected():
    print("== T2 non-college Gmail rejected (frontend email spoof ignored)")
    users_before = scalar("select count(*) as n from users")[0]["n"]
    sessions_before = scalar("select count(*) as n from sessions")[0]["n"]

    state, cookies = google_start()
    # A hostile client appends its own `email=` — the server must use only
    # what Google reported.
    status, hdrs, _ = google_callback(
        "gmail-code", state, cookies, extra_query="&email=spoof%40ceconline.edu"
    )
    loc = location(hdrs)
    ok("T2 → /login?error=domain", loc == "/login?error=domain", (status, loc))
    ok("T2 no session cookie", session_of(hdrs) is None, hdrs)
    ok(
        "T2 no gmail user row",
        scalar("select count(*) as n from users where email like '%@gmail.com'")[0]["n"]
        == 0,
    )
    ok(
        "T2 spoofed college address did not create a user",
        scalar(
            "select count(*) as n from users where email = 'spoof@%s'" % ALLOWED_DOMAIN
        )[0]["n"]
        == 0,
    )
    ok(
        "T2 user count unchanged",
        scalar("select count(*) as n from users")[0]["n"] == users_before,
    )
    ok(
        "T2 session count unchanged",
        scalar("select count(*) as n from sessions")[0]["n"] == sessions_before,
    )

    status, _, html = get("/login?error=domain")
    ok("T2 login page renders", status == 200, status)
    ok(
        "T2 exact error copy",
        "Only college Google accounts can be used with ProLib." in html,
        "error banner missing"
        if "not allowed" not in html
        else "banner present but body copy differs",
    )
    status, payload, _, _ = api("GET", "/api/auth/me")
    ok("T2 anonymous me", payload == {"authenticated": False}, payload)


def t3_non_college_domain_rejected():
    print("== T3 non-college domain (outlook.com) rejected")
    users_before = scalar("select count(*) as n from users")[0]["n"]
    sessions_before = scalar("select count(*) as n from sessions")[0]["n"]

    state, cookies = google_start()
    status, hdrs, _ = google_callback("outlook-code", state, cookies)
    loc = location(hdrs)
    ok("T3 → /login?error=domain", loc == "/login?error=domain", (status, loc))
    ok("T3 no session cookie", session_of(hdrs) is None, hdrs)
    ok(
        "T3 no outlook user row",
        scalar(
            "select count(*) as n from users where email like '%@outlook.com'"
        )[0]["n"]
        == 0,
    )
    ok(
        "T3 counts unchanged",
        scalar("select count(*) as n from users")[0]["n"] == users_before
        and scalar("select count(*) as n from sessions")[0]["n"] == sessions_before,
    )


def t3b_unverified_google_account_rejected():
    print("== T3b Google-unverified address rejected even on the college domain")
    users_before = scalar("select count(*) as n from users")[0]["n"]

    state, cookies = google_start()
    status, hdrs, _ = google_callback("unverified-code", state, cookies)
    loc = location(hdrs)
    ok(
        "T3b → /login?error=unverified_google",
        loc == "/login?error=unverified_google",
        (status, loc),
    )
    ok("T3b no session cookie", session_of(hdrs) is None, hdrs)
    ok(
        "T3b no user row for the unverified address",
        scalar(
            "select count(*) as n from users where email = 'unverified.student@%s'"
            % ALLOWED_DOMAIN
        )[0]["n"]
        == 0,
    )
    ok(
        "T3b user count unchanged",
        scalar("select count(*) as n from users")[0]["n"] == users_before,
    )


def t4_existing_user_linked():
    print("== T4 existing college user → Google login links, no duplicate")
    PROFILES["existing-code"] = {
        "sub": "g-oauth-1005",
        "email": EXISTING["email"],
        "verified": True,
        "name": EXISTING["name"],
        "hd": ALLOWED_DOMAIN,
    }
    signup(EXISTING)
    rows = scalar("select id from users where email = '%s'" % EXISTING["email"])
    ok("T4 password account exists", len(rows) == 1, rows)
    user_b = rows[0]["id"]
    users_before = scalar("select count(*) as n from users")[0]["n"]
    sessions_before = scalar("select count(*) as n from sessions")[0]["n"]

    state, cookies = google_start()
    status, hdrs, _ = google_callback("existing-code", state, cookies)
    loc = location(hdrs)
    ok("T4 → /dashboard", loc == "/dashboard", (status, loc))
    session_b = session_of(hdrs)
    ok("T4 session cookie set", bool(session_b), hdrs)

    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session_b)
    ok("T4 authenticated as the same person", payload.get("authenticated") is True, payload)
    ok(
        "T4 same user id (linked, not re-registered)",
        payload["user"]["id"] == user_b,
        payload,
    )
    ok(
        "T4 exactly one row for the college email",
        scalar(
            "select count(*) as n from users where email = '%s'" % EXISTING["email"]
        )[0]["n"]
        == 1,
    )
    ok(
        "T4 no duplicate user created",
        scalar("select count(*) as n from users")[0]["n"] == users_before,
    )
    ok(
        "T4 one new session row",
        scalar("select count(*) as n from sessions")[0]["n"] == sessions_before + 1,
    )
    return session_b, users_before


def t5_repeated_login_same_user(session_a, user_a, users_before):
    print("== T5 repeated Google login → same ProLib user")
    state, cookies = google_start()
    status, hdrs, _ = google_callback("college-mixed-case", state, cookies)
    loc = location(hdrs)
    ok("T5 → /dashboard", loc == "/dashboard", (status, loc))
    session_a2 = session_of(hdrs)
    ok("T5 session cookie set", bool(session_a2), hdrs)

    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session_a2)
    ok("T5 authenticated", payload.get("authenticated") is True, payload)
    ok("T5 same user id as T1", payload["user"]["id"] == user_a, payload)
    ok(
        "T5 still exactly the same user rows",
        scalar("select count(*) as n from users")[0]["n"] == users_before,
    )
    return session_a2


def t6_logout_removes_session(session_a, session_a2):
    print("== T6 logout removes the session server-side")
    sessions_before = scalar("select count(*) as n from sessions")[0]["n"]
    ok("T6 pre: both sessions live", sessions_before >= 2, sessions_before)

    status, payload, _, _ = api("POST", "/api/auth/logout", cookie=session_a2)
    ok("T6 logout 200", status == 200, status)
    ok("T6 logout answers unauthenticated", payload == {"authenticated": False}, payload)

    # The browser would drop the cookie — we keep sending it manually so the
    # assertion proves the SESSION ROW is gone, not just the cookie.
    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session_a2)
    ok("T6 old cookie rejected", payload == {"authenticated": False}, payload)
    ok(
        "T6 session row count dropped by one",
        scalar("select count(*) as n from sessions")[0]["n"] == sessions_before - 1,
    )
    # The user's OTHER session must survive — logout is per-session.
    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session_a)
    ok("T6 other session unaffected", payload.get("authenticated") is True, payload)


def final_checks():
    print("== final state")
    ok("final: 2 users (Google + password)", scalar("select count(*) as n from users")[0]["n"] == 2)
    ok(
        "final: 2 sessions (T1 + T4; T5's logged out)",
        scalar("select count(*) as n from sessions")[0]["n"] == 2,
    )
    ok(
        "final: 4 seeded departments intact",
        scalar("select count(*) as n from departments")[0]["n"] == 4,
    )
    ok(
        "final: 0 projects (nothing invented)",
        scalar("select count(*) as n from projects")[0]["n"] == 0,
    )


# ------------------------------------------------------------------- main

def main():
    global GOOGLE_BASE, DEV_PROC
    DEV_PROC = None

    print(f"suite db: {DB_NAME}   college domain: {ALLOWED_DOMAIN}")
    httpd, GOOGLE_BASE = boot_fake_google()
    print(f"fake Google: {GOOGLE_BASE}")

    try:
        ensure_database()
        truncate()

        # Preconditions: scratch DB genuinely empty + defaults untouched.
        ok(
            "precondition: 4 seeded departments",
            sorted(r["name"] for r in scalar("select name from departments"))
            == ["CS-AI", "CSE", "ECE", "EEE"],
            scalar("select name from departments"),
        )
        ok("precondition: 0 users", scalar("select count(*) as n from users")[0]["n"] == 0)
        ok(
            "precondition: settings untouched (default policies)",
            scalar("select count(*) as n from settings")[0]["n"] == 0,
        )

        stop_next_dev()
        print(f"starting next dev on :{PORT} (log: {DEV_LOG})")
        DEV_PROC = start_server(GOOGLE_BASE)
        sentinel()

        t0_state_csrf()
        session_a, user_a = t1_allowed_college_email()
        t2_gmail_rejected()
        t3_non_college_domain_rejected()
        t3b_unverified_google_account_rejected()
        _, users_before = t4_existing_user_linked()
        session_a2 = t5_repeated_login_same_user(session_a, user_a, users_before)
        t6_logout_removes_session(session_a, session_a2)
        final_checks()

        print(f"\nALL {len(_checks)} CHECKS PASSED")
    finally:
        print("cleaning up scratch DB + servers…")
        try:
            truncate()
        except Exception as exc:  # best effort — never mask the real failure
            print(f"  cleanup truncate failed: {exc}")
        if DEV_PROC is not None:
            DEV_PROC.terminate()
        subprocess.run(["pkill", "-f", "next dev"], cwd=CWD)
        httpd.shutdown()


if __name__ == "__main__":
    main()
