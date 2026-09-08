# Persistent local runtime — 2026-09-08

User could not sign in after a previous local restart. Confirmed both host web/API ports were unreachable, while the isolated MySQL Docker container remained running. The password was valid once the application was brought back; it was not reset.

Added `compose.next.yml` for persistent web/API execution using the existing Linux renderer image, loopback ports 4621/4620 and `restart: unless-stopped`. It mounts current source/build and the existing private storage; optional `STORAGE_ROOT` preserves all stored absolute file paths. Database remains `ams_next` on 3319. The app performs rendering internally; no Docker socket is exposed inside the container. Existing project, users, credentials and exports are retained.

Validated login HTTP 200 and session `/v1/auth/me` HTTP 200. Server TypeScript and existing regression suite are checked alongside authenticated access to prior render assets. Run `docker start ams-next-mysql ams-next-studio` to resume the application; the earlier terminal-based `pnpm dev` process is no longer required for normal use.
