#!/usr/bin/env python3
"""ProLib account-management acceptance suite: GitHub connect/disconnect + logout.

Self-contained — no pre-running server, no real GitHub or Google account:

    python3 tests/account_management_test.py        # or: npm run test:account

What it does:
  * refuses to run against the real database (defaults to `prolib_test`,
    hard-stops if pointed at `prolib`)
  * boots an in-process fake provider that answers BOTH the GitHub OAuth
    + API endpoints and the Google token + userinfo endpoints, so the REAL
    code paths run end-to-end (state checks, code exchange, repository
    lists, domain gate) without github.com or google.com
  * starts its own `next dev` on :3000 with the scratch DB and the
    dev-only endpoint overrides (ignored in production builds)
  * truncates the scratch DB on exit (the four seeded departments survive)

Scenarios:
  T0  sentinel                    — own server, GitHub configured, scratch DB
  T1  profile UI before connect   — no manual GitHub username input; honest
                                    "Not connected" + Connect GitHub
  T2  connect round trip          — username sourced from the OAuth identity
  T3  repository listing works    — real /user/repos list through the fake
  T4  other-user isolation        — user B cannot disconnect user A
  T5  disconnect                  — row+token gone, ProLib session intact,
                                    projects/repository URLs/legacy handle
                                    preserved, profile shows Not connected
  T6  disconnect idempotent       — repeated requests stay 200
  T7  repos blocked               — listing fails appropriately when off
  T8  reconnect restores          — connect again → repos work again
  T9  legacy handle preserved     — profile save never deletes the old
                                    manually-entered users.github_username
  T10 logout (password user)      — session row deleted server-side, cookie
                                    cleared, old cookie useless, header flips
  T11 logout (Google user)        — same, and ProLib never touches google.com
  T12 final state                 — nothing invented, nothing unrelated lost
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
from urllib.parse import parse_qs, quote, unquote, urlencode, urlsplit
from urllib.request import Request, urlopen

HOST, PORT = "localhost", 3000
CWD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- isolation
DB_NAME = os.environ.get("PROLIB_TEST_DB", "prolib_test")
UPLOADS_DIR = os.environ.get("PROLIB_TEST_UPLOADS", "/tmp/prolib-account-uploads")
DB_URL = f"postgres://prolib:prolib@127.0.0.1:5432/{DB_NAME}"
DEV_LOG = "/tmp/prolib-account-dev.log"

if DB_NAME == "prolib":
    sys.exit("refusing to run against the real database `prolib` — set PROLIB_TEST_DB")

ALLOWED_DOMAIN = (
    os.environ.get("ALLOWED_COLLEGE_EMAIL_DOMAINS", "ceconline.edu")
    .split(",")[0]
    .strip()
    .lstrip("@")
    .lower()
)

# GitHub identities the fake provider answers with, keyed by OAuth `code`.
GITHUB_PROFILES = {
    "gh-connect-code": {
        "id": 55661,
        "login": "cec-archivist",
        "name": "CEC Archivist",
        "avatar_url": "https://avatars.githubusercontent.com/u/55661?v=4",
        "html_url": "https://github.com/cec-archivist",
    },
    # Reconnect uses the SAME GitHub identity (same id/login) — a student
    # reconnecting their own account must not trip the unique constraint.
    "gh-reconnect-code": {
        "id": 55661,
        "login": "cec-archivist",
        "name": "CEC Archivist",
        "avatar_url": "https://avatars.githubusercontent.com/u/55661?v=4",
        "html_url": "https://github.com/cec-archivist",
    },
}

GITHUB_REPOS = [
    {
        "id": 900001,
        "full_name": "cec-archivist/cec-archive",
        "html_url": "https://github.com/cec-archivist/cec-archive",
        "description": "The CEC project archive",
        "language": "TypeScript",
        "stargazers_count": 3,
        "fork": False,
        "private": False,
        "updated_at": "2026-10-01T10:00:00Z",
    },
    {
        "id": 900002,
        "full_name": "cec-archivist/lab-automation",
        "html_url": "https://github.com/cec-archivist/lab-automation",
        "description": None,
        "language": "Python",
        "stargazers_count": 0,
        "fork": True,
        "private": True,
        "updated_at": "2026-09-12T08:30:00Z",
    },
]

# Google profiles, keyed by OAuth code — one verified college address, used
# for the Google-user logout scenario.
GOOGLE_PROFILES = {
    "google-account-code": {
        "sub": "g-acct-2001",
        "email": f"meera23ece018@{ALLOWED_DOMAIN}",
        "verified": True,
        "name": "Meera P",
        "hd": ALLOWED_DOMAIN,
    },
}

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


# ----------------------------------------------------------- fake provider
# One server, two roles (paths never collide):
#   GitHub web origin : POST /login/oauth/access_token
#   GitHub API origin : GET  /user, GET /user/repos
#   Google            : POST /token, GET /userinfo
# The authorize/consent pages themselves are never followed — only the
# `state` they would have carried back matters.


class FakeProvider(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, status, obj):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _bearer(self):
        auth = self.headers.get("Authorization") or ""
        return auth[len("Bearer "):] if auth.startswith("Bearer ") else ""

    def do_POST(self):
        path = urlsplit(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        form = parse_qs(self.rfile.read(length).decode(errors="replace"))
        code = (form.get("code") or [""])[0]

        if path == "/login/oauth/access_token":
            if code not in GITHUB_PROFILES:
                return self._json(400, {"error": "bad_verification_code"})
            return self._json(
                200,
                {
                    "access_token": f"tok:{code}",
                    "token_type": "bearer",
                    "scope": "read:user,repo",
                },
            )

        if path == "/token":
            if code not in GOOGLE_PROFILES:
                return self._json(400, {"error": "invalid_grant"})
            return self._json(
                200,
                {
                    "access_token": f"gtok:{code}",
                    "token_type": "Bearer",
                    "expires_in": 3600,
                },
            )

        return self._json(404, {"error": "not_found"})

    def do_GET(self):
        path = urlsplit(self.path).path
        token = self._bearer()

        if path == "/user":
            if not token.startswith("tok:"):
                return self._json(401, {"message": "Bad credentials"})
            profile = GITHUB_PROFILES.get(token[len("tok:"):])
            if not profile:
                return self._json(401, {"message": "Bad credentials"})
            return self._json(200, profile)

        if path == "/user/repos":
            if not token.startswith("tok:") or token[len("tok:"):] not in GITHUB_PROFILES:
                return self._json(401, {"message": "Bad credentials"})
            return self._json(200, GITHUB_REPOS)

        if path == "/userinfo":
            if not token.startswith("gtok:"):
                return self._json(401, {"error": "unauthorized"})
            profile = GOOGLE_PROFILES.get(token[len("gtok:"):])
            if not profile:
                return self._json(401, {"error": "unauthorized"})
            return self._json(
                200,
                {
                    "sub": profile["sub"],
                    "email": profile["email"],
                    "email_verified": profile["verified"],
                    "name": profile["name"],
                    "picture": (
                        "https://lh3.googleusercontent.com/a/verify-acct=s96-c"
                    ),
                    "hd": profile.get("hd"),
                },
            )

        return self._json(404, {"error": "not_found"})


def boot_fake_provider():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), FakeProvider)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"

    # Self-check: a broken double would otherwise surface as a confusing
    # auth failure many tests later.
    token_req = Request(
        f"{base}/login/oauth/access_token",
        data=urlencode({"code": "gh-connect-code"}).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urlopen(token_req) as res:
        tokens = json.load(res)
    assert "access_token" in tokens, tokens
    info_req = Request(f"{base}/user", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    with urlopen(info_req) as res:
        profile = json.load(res)
    assert profile["login"] == "cec-archivist", profile
    return httpd, base


# ---------------------------------------------------------------- HTTP utils

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
        # Raw per-cookie list too — a joined string cannot be re-split
        # reliably (cookie values may contain "; " after encoding).
        hdrs["_set_cookies"] = cookies
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
        loc = loc[len("http://localhost:3000"):]
    return loc


def cookie_map(hdrs):
    """prolib_* cookies from a joined Set-Cookie header (value → name)."""
    raw = hdrs.get("Set-Cookie") or ""
    out = {}
    for m in re.finditer(r"(prolib_[a-z_]+)=([^;]*)", raw):
        out.setdefault(m.group(1), unquote(m.group(2)))
    return out


def session_of(hdrs):
    m = re.search(r"prolib_session=([^;]+)", hdrs.get("Set-Cookie") or "")
    return m.group(1) if m else None


def cookie_names_set(hdrs):
    """Names of the individual cookies in this response's Set-Cookie list."""
    names = []
    for entry in hdrs.get("_set_cookies", []):
        first = entry.split(";")[0]
        name = first.split("=")[0].strip()
        if name:
            names.append(name)
    return names


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
            # GitHub ON, pointed at the local double. The origin overrides
            # are dev-only seams (ignored in production builds).
            "GITHUB_CLIENT_ID": "prolib-test-gh-client",
            "GITHUB_CLIENT_SECRET": "prolib-test-gh-secret",
            "GITHUB_CALLBACK_URL": "http://localhost:3000/api/github/callback",
            "GITHUB_WEB_ORIGIN": fake_base,
            "GITHUB_API_ORIGIN": fake_base,
            # Google ON (the Google-user logout scenario) — same double.
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
    """Prove :3000 is *our* scratch server before trusting any result."""
    status, payload, _, _ = api("GET", "/api/github/status")
    ok(
        "sentinel: own server (GitHub configured by suite env)",
        payload.get("configured") is True and payload.get("signedIn") is False,
        payload,
    )
    status, payload, _, _ = api("GET", "/api/auth/login")
    ids = {p["id"]: p["enabled"] for p in payload["providers"]}
    ok("sentinel: Google enabled by suite env", ids.get("google") is True, payload)
    status, payload, _, _ = api("GET", "/api/projects?page=1&limit=10")
    ok("sentinel: scratch DB (0 projects)", payload.get("total") == 0, payload)


# ------------------------------------------------------- accounts + OAuth glue

def signup(user):
    status, _, html = get("/signup")
    assert status == 200, status
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
    assert status in (302, 303) and loc and loc.startswith("/verify-email?email="), (
        status, loc, data[:300]
    )
    m = re.search(r"devToken=([^&]+)", loc)
    assert m, f"no development verification link on {loc}"
    vstatus, vhdrs, _ = request("GET", f"/api/auth/verify-email?token={m.group(1)}")
    assert vstatus in (302, 303), vstatus
    print(f"  signup+verify {user['username']} ok")


def login(user):
    status, _, html = get("/login")
    assert status == 200, status
    status, hdrs, data = post_action(
        "/login", html,
        {"email": user["email"], "password": user["password"]},
        marker="login-email",
    )
    loc = location(hdrs)
    assert status in (302, 303) and loc == "/dashboard", (status, loc, data[:300])
    session = session_of(hdrs)
    assert session, hdrs
    return session


def google_start():
    status, hdrs, _ = request("GET", "/api/auth/google")
    assert status in (301, 302, 303, 307, 308), (status, hdrs)
    loc = location(hdrs) or ""
    state = (parse_qs(urlsplit(loc).query).get("state") or [""])[0]
    assert state, loc
    cookies = cookie_map(hdrs)
    assert "prolib_oauth_state" in cookies, hdrs
    return state, cookies


def google_callback(code, state, cookies):
    path = "/api/auth/callback/google?" + urlencode({"code": code, "state": state})
    header = "; ".join(f"{k}={v}" for k, v in cookies.items() if v)
    status, hdrs, data = request("GET", path, headers={"Cookie": header})
    return status, hdrs, data.decode(errors="replace")


def github_connect(session):
    """Starts the flow: returns (state, gh_state_cookie) from the 302."""
    status, hdrs, _ = request("GET", "/api/github/connect", cookie=session)
    assert status in (301, 302, 303, 307, 308), (status, hdrs)
    loc = location(hdrs) or ""
    assert loc.startswith(FAKE_BASE), f"authorize URL is not the local double: {loc}"
    query = parse_qs(urlsplit(loc).query)
    state = (query.get("state") or [""])[0]
    redirect = (query.get("redirect_uri") or [""])[0]
    assert state, loc
    assert redirect.endswith("/api/github/callback"), redirect
    cookies = cookie_map(hdrs)
    assert "prolib_gh_state" in cookies, hdrs
    return state, cookies["prolib_gh_state"]


def github_callback(session, code, state, gh_state):
    header = f"prolib_session={session}; prolib_gh_state={gh_state}"
    status, hdrs, _ = request(
        "GET",
        "/api/github/callback?" + urlencode({"code": code, "state": state}),
        headers={"Cookie": header},
    )
    return status, hdrs


# ---------------------------------------------------------------- scenarios

def t1_profile_ui_before_connect(session_a):
    print("== T1 profile UI before connect: no manual GitHub username field")
    status, _, html = get("/dashboard/profile", cookie=session_a)
    ok("T1 profile page renders", status == 200, status)
    ok(
        "T1 no editable GitHub username input",
        'name="githubUsername"' not in html,
        "manual GitHub field still present",
    )
    ok("T1 honest 'Not connected' shown", "Not connected" in html)
    ok("T1 Connect GitHub offered", "Connect GitHub" in html)
    ok("T1 no Disconnect while unconnected", "Disconnect" not in html)


def t2_connect_round_trip(session_a, user_a):
    print("== T2 connect round trip: username comes from the OAuth identity")
    state, gh_state = github_connect(session_a)
    status, hdrs = github_callback(session_a, "gh-connect-code", state, gh_state)
    loc = location(hdrs)
    ok(
        "T2 callback → profile?github=connected",
        status in (301, 302, 303, 307, 308)
        and loc == "/dashboard/profile?github=connected",
        (status, loc),
    )
    ok(
        "T2 state cookie cleared (empty value)",
        bool(re.search(r"prolib_gh_state=;", hdrs.get("Set-Cookie") or "")),
        hdrs.get("Set-Cookie"),
    )

    rows = scalar(
        "select login, access_token as token from github_accounts where user_id = '%s'"
        % user_a
    )
    ok("T2 github_accounts row exists", len(rows) == 1, rows)
    ok(
        "T2 login stored from GitHub /user (never typed)",
        rows and rows[0]["login"] == "cec-archivist",
        rows,
    )
    ok("T2 token stored server-side", rows and bool(rows[0]["token"]), rows)

    status, payload, _, _ = api("GET", "/api/github/status", cookie=session_a)
    ok("T2 status connected", payload.get("connected") is True, payload)
    ok(
        "T2 status identity is the OAuth login",
        (payload.get("identity") or {}).get("login") == "cec-archivist",
        payload,
    )
    ok(
        "T2 status never exposes the token",
        "token" not in json.dumps(payload).lower(),
        payload,
    )

    status, _, html = get("/dashboard/profile", cookie=session_a)
    ok("T2 UI shows Connected as @cec-archivist", "Connected as @cec-archivist" in html)
    ok("T2 UI shows Disconnect action", "Disconnect" in html)
    ok("T2 UI still has no username input", 'name="githubUsername"' not in html)


def t3_repository_listing_works(session_a):
    print("== T3 repository listing works while connected")
    status, payload, _, _ = api("GET", "/api/github/repos", cookie=session_a)
    ok("T3 repos 200", status == 200, (status, payload))
    ok("T3 connected true", payload.get("connected") is True, payload)
    ok("T3 login echoed", payload.get("login") == "cec-archivist", payload)
    names = [item["full_name"] for item in payload.get("items", [])]
    ok(
        "T3 real repo list from the provider",
        "cec-archivist/cec-archive" in names,
        names,
    )
    ok(
        "T3 no token in the response body",
        "tok:" not in json.dumps(payload),
        payload,
    )


def seed_project_data(user_a):
    """A project + repository association + a legacy manual handle for A."""
    psql(
        "insert into github_repositories "
        "(id, linked_by_user_id, owner, name, full_name, html_url, description, "
        " stargazers_count, forks_count, language, github_id, default_branch, fetched_at) "
        "values ('repo-seed-1', '%s', 'cec-archivist', 'cec-archive', "
        "'cec-archivist/cec-archive', 'https://github.com/cec-archivist/cec-archive', "
        "'seed', 3, 1, 'TypeScript', 900001, 'main', now()) "
        "on conflict (full_name) do nothing" % user_a
    )
    psql(
        "insert into projects (id, slug, owner_id, title, short_description, "
        "github_url, github_repository_id, project_type, status, publication_status, "
        "view_count, like_count, featured, created_at, updated_at) "
        "values ('proj-seed-1', 'seed-repo-project', '%s', 'Seed Repo Project', "
        "'repository URL preservation check', "
        "'https://github.com/cec-archivist/cec-archive', 'repo-seed-1', "
        "'web', 'completed', 'published', 0, 0, false, now(), now()) "
        "on conflict (id) do nothing" % user_a
    )
    # A legacy manually-entered handle, exactly like real pre-OAuth accounts.
    psql(
        "update users set github_username = 'legacyhandle' where id = '%s'" % user_a
    )


def t4_other_user_cannot_disconnect(session_b, user_a):
    print("== T4 another user cannot disconnect user A")
    status, payload, _, _ = api("POST", "/api/github/disconnect", cookie=session_b)
    ok("T4 B disconnect → 200 (no-op)", status == 200, (status, payload))
    ok("T4 B response connected false", payload.get("connected") is False, payload)
    rows = scalar(
        "select login from github_accounts where user_id = '%s'" % user_a
    )
    ok(
        "T4 A's connection untouched by B",
        len(rows) == 1 and rows[0]["login"] == "cec-archivist",
        rows,
    )
    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session_b)
    ok("T4 B session unaffected", payload.get("authenticated") is True, payload)


def t5_disconnect(session_a, user_a):
    print("== T5 disconnect: token gone, session + project data preserved")
    status, payload, _, _ = api("POST", "/api/github/disconnect", cookie=session_a)
    ok("T5 disconnect 200", status == 200, (status, payload))
    ok("T5 response connected false", payload.get("connected") is False, payload)

    ok(
        "T5 github_accounts row deleted (token with it)",
        scalar("select count(*) as n from github_accounts")[0]["n"] == 0,
        scalar("select user_id from github_accounts"),
    )

    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session_a)
    ok("T5 ProLib session still authenticated", payload.get("authenticated") is True, payload)
    ok(
        "T5 same ProLib user",
        payload.get("user", {}).get("id") == user_a,
        payload,
    )
    ok(
        "T5 session rows untouched (A, B and the Google user)",
        scalar("select count(*) as n from sessions")[0]["n"] == 3,
        scalar("select user_id from sessions"),
    )

    ok(
        "T5 project row preserved",
        scalar("select count(*) as n from projects where id = 'proj-seed-1'")[0]["n"] == 1,
    )
    ok(
        "T5 project repository URL preserved",
        scalar("select github_url from projects where id = 'proj-seed-1'")[0]["github_url"]
        == "https://github.com/cec-archivist/cec-archive",
    )
    ok(
        "T5 repository association row preserved",
        scalar(
            "select count(*) as n from github_repositories where full_name = 'cec-archivist/cec-archive'"
        )[0]["n"]
        == 1,
    )
    ok(
        "T5 legacy manual handle preserved in users",
        scalar("select github_username from users where id = '%s'" % user_a)[0]["github_username"]
        == "legacyhandle",
    )
    ok(
        "T5 no user deleted",
        scalar("select count(*) as n from users")[0]["n"] == 3,
        scalar("select email from users"),
    )

    status, _, html = get("/dashboard/profile", cookie=session_a)
    ok("T5 profile renders", status == 200, status)
    ok("T5 UI shows Not connected", "Not connected" in html)
    ok("T5 UI shows Connect GitHub", "Connect GitHub" in html)
    ok("T5 UI shows no Disconnect when off", "Disconnect" not in html)
    ok("T5 UI shows no fake connected state", "Connected as @" not in html)
    ok("T5 UI has no username input", 'name="githubUsername"' not in html)

    # Unrelated OAuth state is never revoked: the Google user's session lives.
    status, payload, _, _ = api("GET", "/api/auth/me", cookie=SESSION_G)
    ok("T5 Google user's session untouched", payload.get("authenticated") is True, payload)


def t6_disconnect_idempotent(session_a):
    print("== T6 disconnect is idempotent")
    status, payload, _, _ = api("POST", "/api/github/disconnect", cookie=session_a)
    ok("T6 second disconnect 200", status == 200, (status, payload))
    ok("T6 connected false", payload.get("connected") is False, payload)
    ok(
        "T6 still zero github_accounts",
        scalar("select count(*) as n from github_accounts")[0]["n"] == 0,
    )


def t7_repository_listing_blocked(session_a):
    print("== T7 repository listing is unavailable while disconnected")
    status, payload, _, _ = api("GET", "/api/github/repos", cookie=session_a)
    ok("T7 repos 401", status == 401, (status, payload))
    ok("T7 connected false", payload.get("connected") is False, payload)
    ok("T7 empty items (no fake list)", payload.get("items") in (None, []), payload)


def t8_reconnect_restores(session_a):
    print("== T8 reconnect restores repository browsing")
    state, gh_state = github_connect(session_a)
    status, hdrs = github_callback(session_a, "gh-reconnect-code", state, gh_state)
    loc = location(hdrs)
    ok(
        "T8 callback → profile?github=connected",
        status in (301, 302, 303, 307, 308)
        and loc == "/dashboard/profile?github=connected",
        (status, loc),
    )
    status, payload, _, _ = api("GET", "/api/github/status", cookie=session_a)
    ok("T8 status connected again", payload.get("connected") is True, payload)
    status, payload, _, _ = api("GET", "/api/github/repos", cookie=session_a)
    ok("T8 repos 200 again", status == 200, (status, payload))
    names = [item["full_name"] for item in payload.get("items", [])]
    ok("T8 repo list restored", "cec-archivist/cec-archive" in names, names)
    status, _, html = get("/dashboard/profile", cookie=session_a)
    ok("T8 UI Connected as @cec-archivist again", "Connected as @cec-archivist" in html)


def t9_legacy_handle_preserved_on_save(session_a, user_a):
    print("== T9 profile saves never delete a legacy manual handle")
    # The API validates the merged record, so the PATCH carries the fields
    # this fresh account is still missing (batch + department).
    department_id = scalar("select id from departments order by name limit 1")[0]["id"]
    status, payload, _, _ = api(
        "PATCH",
        "/api/users/me",
        cookie=session_a,
        json_body={
            "headline": "Campus builder",
            "batch": 2027,
            "departmentId": department_id,
        },
    )
    ok("T9 PATCH 200", status == 200, (status, payload))
    ok(
        "T9 legacy github_username still stored",
        scalar("select github_username from users where id = '%s'" % user_a)[0]["github_username"]
        == "legacyhandle",
    )
    ok(
        "T9 headline applied (save really ran)",
        scalar("select headline from users where id = '%s'" % user_a)[0]["headline"]
        == "Campus builder",
    )
    status, _, html = get("/dashboard/profile", cookie=session_a)
    ok(
        "T9 legacy handle does NOT fake a connected state",
        "Connected as @legacyhandle" not in html,
        "legacy handle rendered as connected",
    )


def t10_logout_password_user(session_a):
    print("== T10 logout (password user): server-side invalidation")
    before = scalar("select count(*) as n from sessions")[0]["n"]
    status, payload, hdrs, _ = api("POST", "/api/auth/logout", cookie=session_a)
    ok("T10 logout 200", status == 200, (status, payload))
    ok("T10 JSON says unauthenticated", payload.get("authenticated") is False, payload)
    ok("T10 no redirect anywhere", "Location" not in hdrs and "location" not in hdrs, hdrs)

    set_cookie = hdrs.get("Set-Cookie") or ""
    ok(
        "T10 only the ProLib session cookie is cleared",
        cookie_names_set(hdrs) == ["prolib_session"],
        (cookie_names_set(hdrs), set_cookie),
    )
    ok(
        "T10 cookie expiry forced (Max-Age/Expires)",
        "max-age=0" in set_cookie.lower() or "expires" in set_cookie.lower(),
        set_cookie,
    )

    ok(
        "T10 session row deleted server-side",
        scalar("select count(*) as n from sessions")[0]["n"] == before - 1,
        scalar("select user_id from sessions"),
    )

    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session_a)
    ok("T10 old cookie is now worthless", payload.get("authenticated") is False, payload)

    status, hdrs, _ = request("GET", "/dashboard", cookie=session_a)
    loc = location(hdrs)
    ok(
        "T10 protected page redirects to login",
        status in (301, 302, 303, 307, 308) and loc and loc.startswith("/login"),
        (status, loc),
    )

    status, _, html = get("/")
    ok("T10 header shows Sign in when signed out", "Sign in" in html)
    ok(
        "T10 header shows no account menu when signed out",
        "Open account menu" not in html,
    )
    ok(
        "T10 Google was never contacted",
        "accounts.google.com" not in json.dumps(hdrs) and "google.com" not in set_cookie,
        (hdrs, set_cookie),
    )


def t11_logout_google_user(session_g):
    print("== T11 logout (Google user): same contract, ProLib-only")
    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session_g)
    ok("T11 authenticated", payload.get("authenticated") is True, payload)

    status, _, html = get("/", cookie=session_g)
    ok(
        "T11 header shows the account menu trigger",
        "Open account menu" in html,
        "account menu trigger missing while signed in",
    )

    status, payload, hdrs, _ = api("POST", "/api/auth/logout", cookie=session_g)
    ok("T11 logout 200", status == 200, (status, payload))
    ok("T11 JSON says unauthenticated", payload.get("authenticated") is False, payload)
    set_cookie = hdrs.get("Set-Cookie") or ""
    ok(
        "T11 only the ProLib session cookie is cleared",
        cookie_names_set(hdrs) == ["prolib_session"],
        (cookie_names_set(hdrs), set_cookie),
    )
    ok(
        "T11 no google.com redirect (ProLib-only sign-out)",
        "Location" not in hdrs and "location" not in hdrs and "google.com" not in json.dumps(hdrs),
        hdrs,
    )
    status, payload, _, _ = api("GET", "/api/auth/me", cookie=session_g)
    ok("T11 Google-user session invalidated", payload.get("authenticated") is False, payload)
    status, hdrs, html = get("/")
    ok(
        "T11 header back to Sign in",
        "Sign in" in html and "Open account menu" not in html,
        (status,),
    )


SESSION_G = None


def t12_final_state():
    print("== T12 final state")
    ok(
        "T12 3 users total (A, B, Google user)",
        scalar("select count(*) as n from users")[0]["n"] == 3,
        scalar("select email from users"),
    )
    ok(
        "T12 1 session (B still signed in; A and Google user logged out)",
        scalar("select count(*) as n from sessions")[0]["n"] == 1,
        scalar("select user_id from sessions"),
    )
    ok(
        "T12 A reconnected (1 github_accounts row)",
        scalar("select count(*) as n from github_accounts")[0]["n"] == 1,
    )
    ok(
        "T12 project + repository data survived every flow",
        scalar("select count(*) as n from projects")[0]["n"] == 1
        and scalar("select count(*) as n from github_repositories")[0]["n"] == 1,
    )
    ok(
        "T12 4 seeded departments intact",
        scalar("select count(*) as n from departments")[0]["n"] == 4,
    )


# ------------------------------------------------------------------- main

FAKE_BASE = None
DEV_PROC = None


def main():
    global FAKE_BASE, DEV_PROC, SESSION_G

    print(f"suite db: {DB_NAME}   college domain: {ALLOWED_DOMAIN}")
    httpd, FAKE_BASE = boot_fake_provider()
    print(f"fake provider: {FAKE_BASE}")

    try:
        ensure_database()
        truncate()

        ok(
            "precondition: 0 users",
            scalar("select count(*) as n from users")[0]["n"] == 0,
        )

        stop_next_dev()
        print(f"starting next dev on :{PORT} (log: {DEV_LOG})")
        DEV_PROC = start_server(FAKE_BASE)
        sentinel()

        signup(USER_A)
        signup(USER_B)
        session_a = login(USER_A)
        session_b = login(USER_B)
        user_a = scalar("select id from users where email = '%s'" % USER_A["email"])[0]["id"]

        t1_profile_ui_before_connect(session_a)
        t2_connect_round_trip(session_a, user_a)
        t3_repository_listing_works(session_a)
        seed_project_data(user_a)
        t4_other_user_cannot_disconnect(session_b, user_a)

        SESSION_G = t11_google_signin_only()
        t5_disconnect(session_a, user_a)
        t6_disconnect_idempotent(session_a)
        t7_repository_listing_blocked(session_a)
        t8_reconnect_restores(session_a)
        t9_legacy_handle_preserved_on_save(session_a, user_a)
        t10_logout_password_user(session_a)
        t11_logout_google_user(SESSION_G)
        t12_final_state()

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


def t11_google_signin_only():
    """Signs the Google user in early (so T5 can prove unrelated sessions
    survive a GitHub disconnect). Full sign-out assertions live in T11."""
    state, cookies = google_start()
    status, hdrs, _ = google_callback("google-account-code", state, cookies)
    assert location(hdrs) == "/dashboard", (status, location(hdrs))
    session = session_of(hdrs)
    assert session, hdrs
    print("  google user signed in (session held for later scenarios)")
    return session


if __name__ == "__main__":
    main()
