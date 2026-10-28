# VBONotif --- AI Agent Handshake & Production Context

**Updated:** 15 October 2026 (Asia/Kolkata)\
**Purpose:** Transfer project identity, production setup, working rules,
file map, architecture and current state to a new ChatGPT chat or AI
agent.

> **CRITICAL:** Never modify `api/main.py` unless the user explicitly
> gives permission for that specific change. Existing router
> registration must be respected.

## 1. Operating contract for the next agent

-   Keep replies concise, warm, casual Hinglish unless another style is
    requested.
-   Work one step at a time; normally give 1--3 commands, then wait for
    output.
-   Never guess file contents, anchors, line numbers, paths, patch
    status, or test results. Inspect the real file/output first.
-   Prefer minimum, low-risk, deterministic patches. Do not refactor
    unrelated working code.
-   **Never modify `main.py` without explicit permission.**
-   **Never provide server restart commands.** User performs restarts
    manually. It is fine to say a manual restart is needed, but do not
    give the command.
-   Do not expose API keys, Meta access tokens, session tokens, or
    secrets in code, URLs, logs, screenshots or chat.
-   Never claim a test passed unless actual output confirms it. Label
    verified facts separately from assumptions and pending work.
-   Every coding response must end with an **RB Status** line:
    compliance, changed files, verification, pending checks, and
    confirmation `main.py untouched`.
-   Do not over-engineer. Preserve existing client isolation, billing,
    wallet, and unrelated functionality.
-   For errors, identify the actual machine, Windows account, process
    executable and Python environment before installing packages or
    changing code.

## 2. Product identity and architecture

VBONotif is an independent, reusable, multi-client WhatsApp platform. It
is **not** a VBO Organiser module; VBO Organiser is one client.

Core capabilities: WhatsApp messaging/sending, chatbot, Inbox, public
API integration, client-specific configuration, wallet and billing.
Other planned/related tools may include CRM, SMS and Telegram
management; do not assume all are implemented.

Architecture: - Shared WhatsApp engine/API and common logic:
`api/whatsapp/`. - Each client has isolated config and data, including
its own SQLite DB: `clients/<client>/config/client.json` and
`clients/<client>/data/whatsapp.db`. - Client identity is resolved
through account/phone mapping or authenticated session depending on
route. - Client session helper: `get_session_client(token)`. - Browser
session key: `localStorage["vbonotif_token"]`. - Inbox helper
`get_inbox_client_db(authorization)` validates bearer/session and
resolves the authenticated client's database. - Never mix a client's
config, credentials, DB, storage, rates or wallet with another client. -
Do not make the platform dependent on Organiser or introduce a separate
Admin Panel without explicit user direction.

## 3. Two Windows PCs --- distinguish them carefully

### A. LAN Windows server PC (runs backend)

-   LAN IP: `192.168.31.132`
-   Hostname previously recorded: `DESKTOP-L1RCBGP`
-   Project root: `C:\VBOEngine`
-   UNC path from workstation: `\\192.168.31.132\c\VBOEngine`
-   Sometimes mapped as `Z:\VBOEngine`
-   App entry: `api.main:app`
-   Server Windows account in recent error: `admin`
-   Python used in recent worker traceback:
    `C:\Users\admin\AppData\Local\Programs\Python\Python314\python.exe`
-   A server process inspection showed a command resembling
    `python -m uvicorn api.main:app --host 127.0.0.1 --port 8000`;
    another log showed `--host 0.0.0.0`. These were different observed
    runs---verify current settings instead of assuming.
-   A server-side venv has also been referenced at
    `C:\VBOEngine\venv\Scripts\python.exe`, but the recent traceback
    showed global Python 3.14, not that venv.

### B. Production/workstation PC (where user works)

-   Windows user: `VBO-4`
-   Frontend root: `C:\Users\VBO-4\Desktop\codefactory\whtsapp`
-   `C:\Python314\python.exe` was the Python resolved by `python` on
    this PC.
-   `py -3.14` resolved to
    `C:\Users\VBO-4\AppData\Local\Python\pythoncore-3.14-64\python.exe`.
-   These are **not** the LAN server's `admin` Python.
-   User commonly runs PowerShell here and edits frontend; may access
    server files by UNC.

**Environment rule:** Installing a package on the workstation does not
install it on the server. Use the exact Python executable of the running
server worker and the correct Windows account. Do not rely on generic
`python` or `py` if the process path is known.

## 4. Important paths

### Backend

-   Server root: `C:\VBOEngine`
-   UNC root: `\\192.168.31.132\c\VBOEngine`
-   WhatsApp backend: `\\192.168.31.132\c\VBOEngine\api\whatsapp`
-   Main routes: `\\192.168.31.132\c\VBOEngine\api\whatsapp\routes.py`
-   Admin routes:
    `\\192.168.31.132\c\VBOEngine\api\whatsapp\admin\routes.py`
-   Receiver:
    `\\192.168.31.132\c\VBOEngine\api\whatsapp\services\receiver.py`
-   Sender/billing:
    `\\192.168.31.132\c\VBOEngine\api\whatsapp\services\sender.py`
-   Meta API helpers:
    `\\192.168.31.132\c\VBOEngine\api\whatsapp\services\whatsapp_api.py`
-   Attachment storage:
    `\\192.168.31.132\c\VBOEngine\api\whatsapp\services\attachment_storage.py`
-   Requirements: `\\192.168.31.132\c\VBOEngine\requirements.txt`
-   DB initializer/migration was referenced as
    `api\whatsapp\init_db.py`; verify exact current file location before
    editing.
-   Example config:
    `\\192.168.31.132\c\VBOEngine\clients\kwikkwashrampur\config\client.json`
-   Example DB:
    `\\192.168.31.132\c\VBOEngine\clients\kwikkwashrampur\data\whatsapp.db`
-   Also known: `clients\VBO Organiser\config\client.json` and
    `clients\VBO Organiser\data\whatsapp.db`.

### Frontend

-   Root: `C:\Users\VBO-4\Desktop\codefactory\whtsapp`
-   Inbox HTML: `C:\Users\VBO-4\Desktop\codefactory\whtsapp\inbox.html`
-   Inbox JS: `C:\Users\VBO-4\Desktop\codefactory\whtsapp\js\inbox.js`
-   Inbox CSS:
    `C:\Users\VBO-4\Desktop\codefactory\whtsapp\css\inbox.css`
-   Other known files: `dashboard.html`, `js\dashboard.js`,
    `integrations.html`, `js\integrations.js`, `css\dashboard.css`,
    `admin.html`, `js\admin.js`.
-   Attachment JS calls
    `https://app.vbo.co.in/api/v1/whatsapp/inbox/send-attachment`.

Confirm the exact target path before edits. A UNC path being accessible
does not prove the running service uses that source copy.

## 5. `main.py` and routers --- high priority

-   Entry point is `C:\VBOEngine\api\main.py`, app `api.main:app`.
-   Existing application setup imports `router` from
    `api.whatsapp.routes` and mounts it under `/api/v1/whatsapp`.
-   Recent traceback showed the import around `main.py` line 237:
    `from api.whatsapp.routes import router as whatsapp_router`
-   Existing public endpoints are documented under
    `/api/v1/whatsapp/...`.
-   New WhatsApp endpoints normally belong in the existing router in
    `api/whatsapp/routes.py`. Since the router is already mounted under
    `/api/v1/whatsapp`, do not repeat that full prefix in individual
    decorators unless the verified existing pattern requires it.
-   Before route edits, inspect the actual `APIRouter` declaration,
    decorators and mount pattern read-only.
-   **Do not edit the import, `include_router`, middleware, startup
    logic or anything else in `main.py` without explicit permission.**
-   A focused endpoint fix is not justification for modifying `main.py`.

## 6. RB Rule Book --- mandatory edit process

1.  Identify the exact target file and inspect current contents.
2.  Identify a unique expected anchor and expected count.
3.  Create a timestamped backup immediately before editing, beside the
    file (example `routes.py.bak_YYYYMMDD_HHMMSS`).
4.  Use a narrow deterministic PowerShell patch.
5.  Abort without edits if the anchor/count differs, is missing or
    duplicated.
6.  Print the changed region and verify the intended marker/count.
7.  Run relevant syntax or targeted tests using the correct interpreter;
    report exactly what was checked.
8.  Report changed files, backup path, verification result and remaining
    risks.
9.  Never provide server restart commands; the user restarts manually.
10. Copyable PowerShell blocks contain executable commands only.
11. Use one step at a time, usually 1--3 commands.

## 7. Billing and data-integrity rules

-   All message rates are client-specific and read from that client's
    config.
-   Chatbot, Inbox/manual sends and other sending routes must use the
    same configured client-specific rates and billing rules.
-   **Only statuses `Failed` or `Rejected` are non-chargeable.**
    Messages not delivered but not marked failed/rejected remain
    chargeable under the configured rate. Do not simplify this to "only
    delivered messages are charged."
-   Text/template rates are separate (commonly `text_message` and
    `template_message`).
-   Avoid duplicate charges on retries/status updates; preserve
    message-row/Meta-ID linkage and existing billing helpers.
-   Inbox hard-delete removes the selected `messages` row but billing
    history remains permanently. Deleting a message is not a refund.
-   Refund/reversal only follows the explicit failed/rejected billing
    policy.
-   Never delete billing, wallet, audit, recharge or unrelated records
    during message cleanup.
-   DB cleanup may delete only old text message records within
    configured policy.
-   Preserve existing wallet locks/concurrency controls.

## 8. Inbox UI and attachment requirements

### Inbox design decisions

-   Mobile: WhatsApp Messenger-like.
-   Desktop: WhatsApp Web-like three-column layout with narrow icon
    sidebar.
-   WhatsApp-inspired light theme with green accents; avoid unrelated
    black/green redesign.
-   Remove Inbox heading; move remaining menu to top-right three-dot
    menu.
-   Unread count badge like WhatsApp.
-   Smart scroll only when already near bottom; otherwise show a
    new-message indicator.
-   Incoming messages require manual refresh. Do not add continuous
    polling due to server-load concern.
-   Back navigation preserves chat-list search and scroll position.
-   Future requirement: PWA/browser/Android push notifications,
    permissions and subscription management.

### Attachment policy

-   Attachments are for Inbox send/receive.
-   Maximum size: **16 MiB**.
-   Shared attachment pool: **15 GB total**, with no per-client cap in
    shared mode.
-   When full, evict oldest attachments automatically; retention-expired
    items first.
-   Dedicated storage is configurable per client with that client's own
    size limit and retention.
-   Dedicated cleanup must never delete another client's files.
-   Do not expose physical paths to the browser; use authenticated media
    endpoint.
-   Preserve the existing text send route.
-   Validate Meta-supported media types before expanding support.

## 9. Attachment implementation snapshot --- verify before relying on it

This is historical project context, not proof of a production end-to-end
pass.

### Backend

-   `services\attachment_storage.py`: shared/dedicated storage config
    and cleanup; shared base recorded as `VBOEngine\attachments\shared`;
    shared cap 15 GB. Dedicated mode expects absolute path and positive
    `limit_gb`, with optional positive `retention_days`. Isolated
    temporary-directory tests were reported passed.
-   DB migration adds message fields: `media_id`, `media_mime_type`,
    `media_filename`, `media_path`, `media_size_bytes`. Prior
    migration/idempotence test was reported passed.
-   `services\receiver.py`: incoming-message save accepts optional
    client name and media metadata; prior syntax/INSERT placeholder
    checks reported passed.
-   `services\whatsapp_api.py`: `upload_media`, `send_media_message`,
    `get_media_url`, `download_media`. Download helper was described as
    restricting HTTPS to `lookaside.fbsbx.com`, disabling redirects,
    streaming under byte cap, and removing partial files on errors.
    Mocked/syntax checks reported passed; no real Meta end-to-end test
    confirmed.
-   `services\sender.py`: `save_message`, `update_message_meta_id`,
    `update_message_status`, `_bill_accepted_message`. Billing helper
    reads client config and skips billing when message row is
    failed/rejected; billing exceptions are caught/logged, so post-send
    billing failure may need reconciliation.
-   `routes.py`: incoming media metadata/download/persistence and
    authenticated Inbox media endpoint were added. Inbox query returns
    `/api/v1/whatsapp/inbox/media/{message_id}`, not physical path.
    `GET /inbox/media/{message_id}` authenticates and checks that
    resolved file stays under allowed storage.
-   `POST /inbox/send-attachment`: multipart `Form`/`File`,
    session/phone validation, 16 MiB streaming limit, client
    config/rate/wallet check, storage cleanup/capacity check, upload to
    Meta, send, persistence and billing. `meta_accepted` guard prevents
    a local exception after Meta acceptance from incorrectly marking
    message failed.
-   Known risk: old attachments may be evicted before Meta send
    completes; a later send failure may not restore those files. A
    post-acceptance DB failure may require reconciliation. Do not tackle
    these until service is stable.

### Frontend

-   `inbox.html`: hidden `attachmentInput` and `＋` attachment button
    added near message box.
-   `js\inbox.js`: `buildInboxAttachmentHtml()` and
    `sendInboxAttachment()` added. Uses `vbonotif_token`,
    `selectedWaId`, FormData fields `wa_id`, `file`, empty caption;
    posts to
    `https://app.vbo.co.in/api/v1/whatsapp/inbox/send-attachment`, then
    refreshes with `openChat(selectedWaId)`.
-   `css\inbox.css`: attachment display styles added.
-   Prior Node syntax check was reported passed. Confirm actual current
    source before edits.

### Historical backups (existence not re-verified)

-   `routes.py.bak_20261015_123305` (accepted-status guard)
-   `routes.py.bak_20261015_122235`
-   `attachment_storage.py.bak_20261015_033400`
-   `admin\routes.py.bak_20261015_024854`
-   `init_db.py.bak_20261015_025732`
-   `receiver.py.bak_20261015_031611`
-   `receiver.py.bak_20261015_031803`
-   `requirements.txt.bak_20261015_121458`
-   `inbox.js.bak_20261015_115834`
-   `inbox.js.bak_20261015_122508`
-   `inbox.js.bak_20261015_122625`
-   `inbox.js.bak_20261015_122737`
-   `inbox.html.bak_20261015_122441`
-   `inbox.css.bak_20261015_120003`

## 10. Current production incident: `python-multipart` / FastAPI startup

### Error

FastAPI worker failed while importing `api.whatsapp.routes` at:
`@router.post("/inbox/send-attachment")`

Error:
`RuntimeError: Form data requires "python-multipart" to be installed.`

### Root cause

Different Python 3.14 installations existed on the workstation and LAN
server. Installing on the workstation did not fix the server's Python
environment.

### Confirmed server action on 15 Oct 2026

On the **LAN server PC**, in PowerShell as `C:\Users\admin`:

`Test-Path "C:\Users\admin\AppData\Local\Programs\Python\Python314\python.exe"`
returned `True`.

Then the user ran:
`& "C:\Users\admin\AppData\Local\Programs\Python\Python314\python.exe" -m pip install python-multipart==0.0.32`

Result: `Successfully installed python-multipart-0.0.32`.

Verification:
`& "C:\Users\admin\AppData\Local\Programs\Python\Python314\python.exe" -c "import multipart; print('MULTIPART_READY', multipart.__file__)"`

Output:
`MULTIPART_READY C:\Users\admin\AppData\Local\Programs\Python\Python314\Lib\site-packages\multipart\__init__.py`

This verifies the dependency in the interpreter path from the worker
traceback, but **does not yet verify FastAPI has started**.

### Pending, highest priority

1.  User manually restarts/relaunches FastAPI; never provide a restart
    command.
2.  Inspect fresh startup log.
3.  Confirm no multipart error and `Application startup complete`.
4.  Confirm other clients are reachable before testing attachments.
5.  Only after service recovery, test attachment send/receive and
    billing.
6.  `requirements.txt` was recorded as containing
    `python-multipart==0.0.32`, with historical backup
    `requirements.txt.bak_20261015_121458`; verify actual
    file/deployment before assuming reproducibility is complete.

## 11. Public API facts recorded previously

Under `/api/v1/whatsapp`: - `GET /public/templates` requires
`X-Client-ID` and `X-API-Key`. - `POST /public/send-template` uses JSON
fields `template_name` (or `template_id`), `language`, `recipients`
(list or comma-separated string), `parameters` (list of strings). -
Legacy `GET /public/send-template` sends immediately; it is
state-changing and can leak query data in history/logs. Never place
secrets in URLs or use a casual auto-open browser link. - Prior handover
documented checks for API enabled state, SHA-256 API-key hash, template
approval/Meta ID, recipient limit, duplicate recipients and required
parameters. - Raw API key is returned only at generation time;
`client.json` stores SHA-256 hash. - `public_api_logs` was documented
with `created_at`, `client_id`, `template_name`, `language`,
`requested_count`, `accepted_count`, `failed_count`, `charged`,
`results_json`. Verify schema before modifying.

## 12. Meta integration history --- don't reopen resolved issues without a new report

A Lavexo incoming webhook and outgoing/template issue was reported fully
resolved on 13 Oct 2026 after adding VBO Organiser as a partner in
Lavexo and reusing the VBO Organiser access token for Lavexo. Treat that
issue as resolved unless the user reports a new failure. Earlier WABA
subscription troubleshooting predates this resolution. Never copy
credentials between clients without an explicitly verified reason and
authorization.

## 13. Verified versus pending

**Verified by recorded user/tool outputs** - `python-multipart==0.0.32`
imports from the LAN server's `admin` Python 3.14 interpreter. - Prior
syntax/isolated tests were reported for storage helpers, DB migration,
receiver, routes, WhatsApp API mocks and Inbox JS. - `meta_accepted`
guard was confirmed present in `routes.py` by prior inspection.

**Pending / not proven** - FastAPI startup after the latest server-side
install. - Recovery/accessibility of all clients. - Real Meta attachment
send/receive end-to-end test. - Billing reconciliation in real API/DB
failure scenarios. - Existence of all historical backups. - Whether all
server start methods consistently use the same interpreter/account and
exact source tree.

## 14. Latest chatbot and handoff status (25 October 2026)

This section supersedes earlier chatbot assumptions. It records code that
was changed and tested locally/against the accessible source tree; it is
not proof that a fresh real WhatsApp event has been tested in production.

### Chatbot backend

- Chatbot runtime remains in
  `api/whatsapp/bot/botengine.py`; it uses each client's published flow
  and the shared sender/billing path. `main.py` was not changed.
- Bot settings now include independent `session_timeout_seconds` and
  `handoff_timeout_seconds` values. Existing clients stay fail-closed if
  bot configuration is missing or invalid.
- A handoff conversation skips automated bot replies while active.
  The handoff timestamp is refreshed when an employee sends a successful
  reply through Inbox. This means the timeout is measured from the most
  recent human activity, not only from the original handoff.
- When the handoff timeout has elapsed, the **next new customer message**
  clears the old state and starts the client's published flow from its
  start node with fresh answers. No message is sent merely because time
  elapsed.
- A production locking fault was found from FastAPI logs: the expired
  handoff path deleted state inside an open SQLite transaction and then
  invoked the sender, which needed a database write. The fix commits the
  state deletion before flow execution. Runtime exceptions are logged
  without customer content and the inbound event is marked `failed`, not
  left in `processing`.
- The source backup made for that backend fix is:
  `\\192.168.31.132\c\VBOEngine\api\whatsapp\backup\handoff_release_fix_20261025_192649`.

### Handoff employee notification

- Handoff node configuration supports an employee number and a selected
  notification template. The frontend lists templates dynamically from
  the authenticated/current client; no template or client name is
  hardcoded.
- The selected template is saved in the handoff node and used for the
  employee alert with customer information where the template accepts it.
- If no usable approved template is selected, it is unavailable, or its
  send fails, the fixed normal-text fallback is:
  `Customer seeking your help: https://vbo.co.in/whtsapp`
- If the normal-text 24-hour window is closed, fallback failure is
  handled safely. Customer confirmation and shared client-specific
  sender/billing rules remain unchanged.

### Chatbot frontend

- Main chatbot page:
  `C:\Users\VBO-4\Desktop\codefactory\whtsapp\chatbot.html`
- Runtime UI code:
  `C:\Users\VBO-4\Desktop\codefactory\whtsapp\js\chatbot.js`
- Shared page styling:
  `C:\Users\VBO-4\Desktop\codefactory\whtsapp\css\dashboard.css`
- The page has responsive flow-builder controls and bot settings for
  reply-session timeout and handoff timeout.
- A **Guide** button now opens a short, non-technical popup covering:
  enable bot, set handoff timeout, choose/build a flow, connect steps,
  save/validate/publish, and handoff setup. Support contact shown there:
  `+91 70079 02013` (telephone link only; no direct WhatsApp chat link).
- The Guide popup has no API calls and does not alter bot configuration.
  It closes with the close button, Got it button, outside click, or Escape.
- Frontend backups for this popup work:
  `C:\Users\VBO-4\Desktop\codefactory\whtsapp\backups\chatbot_guide_20261025_215723`
  and
  `C:\Users\VBO-4\Desktop\codefactory\whtsapp\backups\chatbot_guide_label_20261025_220037`.

### Last recorded verification and remaining checks

- Command run: `py -m unittest api.whatsapp.bot.test_botengine -v`
- Recorded result: 8/8 passed, covering disabled bot, duplicate message,
  menu handling, handoff, active-handoff skip, expired-handoff fresh
  restart, human-reply timeout refresh, and runtime-failure terminal
  state.
- Command run: `node --check C:\Users\VBO-4\Desktop\codefactory\whtsapp\js\chatbot.js`
- Recorded result: passed after the Guide popup addition.
- Still required before declaring production behavior verified: send a
  **new** customer message after the configured handoff timeout and
  inspect safe logs/state. Do not replay the old Meta message ID; it is
  intentionally idempotent. Do not send unsolicited real customer test
  messages.
- Inspect current source before further edits because the frontend and
  server source trees are separate and may change independently.

## 15. Handshake prompt to give the next AI

> You are continuing VBONotif. Read this handover fully and treat it as
> a binding project contract. First identify the immediate goal, exact
> machine, Windows account, Python executable and file path. Never
> modify `api/main.py` without my explicit permission. Never give server
> restart commands. Do not guess file contents or claim unverified
> success. For every code edit: inspect the actual file, make a
> timestamped backup, use exact anchor/count guards, patch narrowly,
> verify, and report files/backups/tests/pending checks. Work one step
> at a time in concise Hinglish. End every coding response with RB
> Status, including confirmation that `main.py` remains untouched.
> Read section 14 first for the latest chatbot/handoff status. Before
> changing handoff behavior, inspect the current runtime and use a new
> inbound event for verification because duplicate Meta IDs are correctly
> ignored. Also retain the earlier attachment startup checks in sections
> 9--10 when they are still applicable.

------------------------------------------------------------------------

**End of handover. Update this file whenever production architecture,
working rules, paths or verified status changes.**
