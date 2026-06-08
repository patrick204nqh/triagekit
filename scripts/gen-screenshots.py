#!/usr/bin/env python3
"""Regenerate the marketing screenshots in site/screenshots/.

Renders the REAL dashboard against a MOCKED GitHub API with fictional `acme-corp`
data — so the screenshots are authentic (the actual UI) but contain no real repo
names, tokens, or network calls. Anonymity is structural: nothing real ever loads.

Prerequisites (one-time):
    python3 -m pip install playwright
    python3 -m playwright install chromium

Run:
    npm run screenshots        # wrapper for: python3 scripts/gen-screenshots.py

Output: site/screenshots/{dashboard,insights,code-scanning,review}.png
Edit the FIXTURES below to change what the screenshots show.
"""
import functools
import http.server
import json
import os
import re
import socketserver
import subprocess
import tempfile
import threading
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DIST = REPO / "dist"
OUT = REPO / "site" / "screenshots"
PORT = 8123

# Fictional config: enables the Insights view and bakes the acme-corp scope so the
# dashboard auto-loads. (No token is baked — that is seeded at runtime below.)
DEMO_CONFIG = """\
source: github
views:
  - code-security
  - insights
scope:
  repos:
    - acme-corp/web-app
    - acme-corp/api-gateway
    - acme-corp/billing-service
branding:
  title: "Acme Triage"
"""


def avatar(color: str) -> str:
    svg = (
        f"<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'>"
        f"<circle cx='20' cy='20' r='20' fill='%23{color}'/></svg>"
    )
    return "data:image/svg+xml," + svg


# ── Fictional GitHub API fixtures, keyed by repo ──────────────────────────────
DEPENDABOT = {
    "acme-corp/web-app": [
        {"number": 1, "security_advisory": {"severity": "critical", "cvss": {"score": 9.8}}, "security_vulnerability": {"first_patched_version": {"identifier": "1.7.4"}}, "dependency": {"scope": "runtime", "package": {"name": "axios"}}, "created_at": "2026-05-02T10:00:00Z", "html_url": "https://github.com/acme-corp/web-app/security/dependabot/1"},
        {"number": 2, "security_advisory": {"severity": "high", "cvss": {"score": 7.5}}, "security_vulnerability": {"first_patched_version": {"identifier": "4.17.21"}}, "dependency": {"scope": "runtime", "package": {"name": "lodash"}}, "created_at": "2026-05-10T10:00:00Z", "html_url": "https://github.com/acme-corp/web-app/security/dependabot/2"},
        {"number": 3, "security_advisory": {"severity": "medium", "cvss": {"score": 5.3}}, "security_vulnerability": {}, "dependency": {"scope": "development", "package": {"name": "minimist"}}, "created_at": "2026-04-20T10:00:00Z", "html_url": "https://github.com/acme-corp/web-app/security/dependabot/3"},
    ],
    "acme-corp/api-gateway": [
        {"number": 4, "security_advisory": {"severity": "critical", "cvss": {"score": 9.1}}, "security_vulnerability": {"first_patched_version": {"identifier": "9.0.2"}}, "dependency": {"scope": "runtime", "package": {"name": "jsonwebtoken"}}, "created_at": "2026-05-15T10:00:00Z", "html_url": "https://github.com/acme-corp/api-gateway/security/dependabot/4"},
        {"number": 5, "security_advisory": {"severity": "high", "cvss": {"score": 7.2}}, "security_vulnerability": {"first_patched_version": {"identifier": "7.5.4"}}, "dependency": {"scope": "runtime", "package": {"name": "semver"}}, "created_at": "2026-05-18T10:00:00Z", "html_url": "https://github.com/acme-corp/api-gateway/security/dependabot/5"},
    ],
    "acme-corp/billing-service": [
        {"number": 6, "security_advisory": {"severity": "low", "cvss": {"score": 3.1}}, "security_vulnerability": {"first_patched_version": {"identifier": "6.0.2"}}, "dependency": {"scope": "runtime", "package": {"name": "tough-cookie"}}, "created_at": "2026-03-30T10:00:00Z", "html_url": "https://github.com/acme-corp/billing-service/security/dependabot/6"},
    ],
}
CODESCAN = {
    "acme-corp/web-app": [
        {"number": 11, "rule": {"id": "js/sql-injection", "name": "Database query built from user-controlled sources", "security_severity_level": "high"}, "tool": {"name": "CodeQL"}, "most_recent_instance": {"location": {"path": "src/db/query.js", "start_line": 42}}, "state": "open", "created_at": "2026-05-05T10:00:00Z", "html_url": "https://github.com/acme-corp/web-app/security/code-scanning/11"},
    ],
    "acme-corp/api-gateway": [
        {"number": 12, "rule": {"id": "js/hardcoded-credentials", "name": "Hard-coded credentials", "security_severity_level": "critical"}, "tool": {"name": "CodeQL"}, "most_recent_instance": {"location": {"path": "src/auth/keys.js", "start_line": 15}}, "state": "open", "created_at": "2026-05-12T10:00:00Z", "html_url": "https://github.com/acme-corp/api-gateway/security/code-scanning/12"},
    ],
}
ISSUES = {
    "acme-corp/web-app": [
        {"number": 482, "title": "Bump axios from 1.6.2 to 1.7.4", "pull_request": {}, "draft": False, "user": {"login": "dependabot[bot]", "type": "Bot", "avatar_url": avatar("8A8A92")}, "labels": [{"name": "dependencies", "color": "0366d6"}], "comments": 1, "created_at": "2026-05-20T10:00:00Z", "html_url": "https://github.com/acme-corp/web-app/pull/482", "body": "Bumps [axios](https://github.com/axios/axios) from 1.6.2 to 1.7.4.\n\n## Release notes\n- Fixes a CSRF vulnerability (GHSA-xxxx).\n- Patches prototype pollution.\n\nReview and merge when CI is green."},
        {"number": 475, "title": "Add request rate limiting to the gateway", "pull_request": {}, "draft": False, "user": {"login": "octella", "type": "User", "avatar_url": avatar("2E9E96")}, "labels": [{"name": "enhancement", "color": "a2eeef"}], "comments": 5, "created_at": "2026-05-17T10:00:00Z", "html_url": "https://github.com/acme-corp/web-app/pull/475", "body": "Adds a token-bucket rate limiter.\n\n- Configurable per-route limits\n- Returns 429 with Retry-After\n\nNeeds a review on the Redis backend choice."},
        {"number": 501, "title": "Login page flashes white on slow connections", "user": {"login": "marlowe-q", "type": "User", "avatar_url": avatar("C9783F")}, "labels": [{"name": "bug", "color": "d73a4a"}], "comments": 3, "created_at": "2026-05-22T10:00:00Z", "html_url": "https://github.com/acme-corp/web-app/issues/501", "body": "On a throttled 3G connection the login page renders white for ~400ms before the theme applies."},
    ],
    "acme-corp/api-gateway": [
        {"number": 320, "title": "Refactor auth middleware to async", "pull_request": {}, "draft": True, "user": {"login": "octella", "type": "User", "avatar_url": avatar("2E9E96")}, "labels": [{"name": "refactor", "color": "5319e7"}], "comments": 0, "created_at": "2026-05-19T10:00:00Z", "html_url": "https://github.com/acme-corp/api-gateway/pull/320", "body": "Draft: migrating the auth middleware to async/await."},
    ],
    "acme-corp/billing-service": [],
}


def _repo(url: str, segment: str):
    m = re.search(r"/repos/([^/]+/[^/]+)/" + segment, url)
    return m.group(1) if m else None


def make_handler(routed: list):
    def handle(route):
        url = route.request.url
        routed.append(url)

        def ok(data):
            route.fulfill(status=200, content_type="application/json", body=json.dumps(data))

        if "/dependabot/alerts" in url:
            return ok(DEPENDABOT.get(_repo(url, "dependabot"), []))
        if "/code-scanning/alerts" in url:
            return ok(CODESCAN.get(_repo(url, "code-scanning"), []))
        if "/issues" in url and "/issues/" not in url:
            return ok(ISSUES.get(_repo(url, "issues"), []))
        if re.search(r"/pulls/\d+$", url):
            return ok({"head": {"sha": "abc123"}, "mergeable": True, "mergeable_state": "clean", "requested_reviewers": [{"login": "marlowe-q", "type": "User", "avatar_url": avatar("C2A23E")}]})
        if "/check-runs" in url:
            return ok({"check_runs": [{"status": "completed", "conclusion": "success"}]})
        if "/user/repos" in url:
            return ok([{"full_name": f"acme-corp/{n}", "name": n, "owner": {"login": "acme-corp"}} for n in ["web-app", "api-gateway", "billing-service"]])
        return ok([])

    return handle


def build_demo_dashboard():
    """Compile dist/triage.html from the fictional DEMO_CONFIG."""
    subprocess.run(["npm", "run", "build:cli"], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
    with tempfile.NamedTemporaryFile("w", suffix=".yml", delete=False) as f:
        f.write(DEMO_CONFIG)
        cfg = f.name
    try:
        subprocess.run(["node", "dist-cli/cli/index.js", "build", "-c", cfg], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
    finally:
        os.unlink(cfg)
    assert (DIST / "triage.html").exists(), "build did not produce dist/triage.html"


def capture():
    from playwright.sync_api import sync_playwright

    OUT.mkdir(parents=True, exist_ok=True)
    handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(handler, directory=str(DIST)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    routed = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True)
            ctx = b.new_context(viewport={"width": 1512, "height": 900}, device_scale_factor=2, color_scheme="dark")
            ctx.add_init_script(
                "sessionStorage.setItem('triagekit.cred.github','ghp_demo_not_a_real_token');"
                "localStorage.setItem('triagekit.theme','dark');"
            )
            page = ctx.new_page()
            page.route("**/api.github.com/**", make_handler(routed))
            page.goto(f"http://127.0.0.1:{PORT}/triage.html")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1200)

            page.screenshot(path=str(OUT / "dashboard.png"))
            print("✓ dashboard.png (Dependencies findings)")

            page.get_by_role("button", name="Insights", exact=True).click()
            page.wait_for_timeout(1500)
            page.screenshot(path=str(OUT / "insights.png"))
            print("✓ insights.png")
            page.get_by_role("button", name="List", exact=True).click()
            page.wait_for_timeout(500)

            page.get_by_role("button", name="Code scanning", exact=True).click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            page.screenshot(path=str(OUT / "code-scanning.png"))
            print("✓ code-scanning.png")

            page.get_by_role("button", name="Change requests", exact=True).click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            page.get_by_text("Add request rate limiting to the gateway", exact=False).first.click()
            page.wait_for_timeout(1800)  # let enrich (pulls + check-runs) resolve
            page.screenshot(path=str(OUT / "review.png"))
            print("✓ review.png (review panel)")

            b.close()
    finally:
        httpd.shutdown()
    assert routed, "no GitHub API calls were intercepted — did the app fail to load?"


if __name__ == "__main__":
    print("• building demo dashboard (fictional acme-corp config)…")
    build_demo_dashboard()
    print("• capturing screenshots →", OUT.relative_to(REPO))
    capture()
    print("done. Review the PNGs, then commit site/screenshots/.")
