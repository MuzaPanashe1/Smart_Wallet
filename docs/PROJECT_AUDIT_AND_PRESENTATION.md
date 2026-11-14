# Smart Wallet Project Audit and Presentation Guide

Audit date: 2026-10-29

## Executive Summary

Smart Wallet is a multi-currency wallet prototype with a React/Vite web client, a Node.js/Express API using Sequelize, a PostgreSQL configuration/schema, a separate Flask fraud-risk service, and a Flutter mobile client. The Express API can also be run with SQLite for isolated testing. The repository contains meaningful working flows, but this is not a production payment or identity-verification service.

The Python service loads a scikit-learn Random Forest trained on the local PaySim dataset. The saved holdout report is recorded in `fraud-detection/metrics.txt`. Transfers use that model; conversions use a visibly labelled heuristic assessment based on the current transaction and recent transaction history. Automatic source pulls occur only after the enclosing conversion/transfer risk check. If the Python service is unavailable, Express uses its own heuristic fallback. PaySim is synthetic mobile-money data, so these metrics do not establish real travel-wallet performance. Exchange rates come from ExchangeRate-API when configured, otherwise the keyless ExchangeRate-API Open Access endpoint; rates are cached for 60 minutes and persisted, with the last complete database snapshot as a final fallback. Funding uses a labelled mock provider sandbox; no real payment settlement occurs.

## Implementation Status

Status meanings: **Tested** means exercised in this audit; **Partial** means code exists but important behavior is incomplete or mismatched; **Unable to verify** means required tooling, environment, or credentials were unavailable.

| Component | Status | Evidence and remaining work |
|---|---|---|
| React web client | Implemented and tested | `client/src/App.jsx`, `client/src/views/DashboardView.jsx`; `npm run build` passes. Login, wallet, conversion, transfer, history, and reviewer views exist. Regular-user risk alerts were wired to the existing API during this audit. Oxlint completes with pre-existing warnings. |
| Express API/auth | Implemented and tested | `server/src/app.js`, `server/src/routes/*`, `server/src/controllers/authController.js`; 35 server JS files pass `node --check`. Auth uses bcrypt and JWT. A fresh account registered and logged in during isolated SQLite API verification. PostgreSQL credentials from the existing configuration were not reported. |
| PostgreSQL schema/migration | Implemented, partially tested | `database/schema.sql`; tables include users, linked_accounts, wallets, wallet_balances, transactions, fraud_alerts, exchange_rates. Startup adds funding fields and updates currency/status constraints. A destructive full reset was not performed. Validate the SQL script against a fresh PostgreSQL database before claiming a clean install. |
| Wallet and KYC | Partial | `walletController.js`, `authController.js`, `User.js`. Registration initializes seven currencies and requires a local account link with the mock approval code `123456`; balances start at zero. Shortfalls are funded from the linked account only after fraud screening and mock gateway confirmation. KYC immediately marks a submitted document `VERIFIED`; there is no provider, reviewer rejection flow, or secure document-verification workflow. Transfers are limited for all non-verified accounts. Identity document numbers are stored as ordinary database fields and need stronger protection/retention controls before real use. |
| Exchange rates | Live provider integration | `exchangeRateService.js`, `rateController.js`, `ExchangeRate.js`. ExchangeRate-API is primary when `EXCHANGE_API_KEY` is configured; a keyless live provider is used otherwise or if the primary fails. Rates are cached for 60 minutes and persisted; provider failure falls back to the last complete database snapshot. Rate quotes lock the live rate and margin for 60 seconds. |
| Automatic funding | Multi-country mock adapters | `/api/funding/providers`, `/api/funding/sources`, `config/providers.js`, `automaticFunding.js`, `paymentGateway.js`, `LinkedAccount.js`. Registration links one provider-registry account after mock approval. When a conversion or transfer needs more wallet balance, the server fraud-screens first, requests the exact shortfall from the adapter, and records the linked source on the confirmed wallet credit. Mock approval takes about three seconds; `MOCK_PAYMENT_FORCE_FAILURE=true` demonstrates a decline without changing either balance. Simulated linked-account balances are shown read-only. This does not move real funds. |
| Fraud model/service | Implemented and tested on PaySim | `fraud-detection/train_model.py`, `fraud-detection/app.py`, `fraud-detection/model.py`, `server/src/services/fraudServiceClient.js`. Random Forest trained on 2,770,409 eligible rows, stratified 80/20 split; fraud-class precision 0.9994, recall 0.9970, F1 0.9982, confusion matrix `[[552438, 1], [5, 1638]]`. Live health reports `ml_model`; actual normal/fraud PaySim transfer examples scored 1%/LOW and 100%/BLOCK. Deposits/conversions and outages use explicit heuristic fallback. These synthetic-dataset metrics do not measure real-world wallet fraud performance. |
| Transfers and conversions | Partial, isolated tests performed | `transferController.js`, `conversionController.js`, `automaticFunding.js`, `fraudController.js`. ACID transaction blocks are used; rows are locked for balance updates. Internal transfers require a registered recipient; a missing recipient must not consume funds. Fraud assessment precedes any automatic shortfall pull; medium/high-risk conversions are held for review. The adapters are mocks only: no external payment rail, settlement, idempotency key, or proven concurrency test exists. |
| Analyst dashboard | Partial | Reviewer/admin API is role-protected in `fraudRoutes.js`; review decisions and release/refund logic exist in `fraudController.js`. Web reviewer view is present. End-to-end analyst workflow should be retested with an admin account after the latest changes. The view includes a traveller name/email; restrict displayed identity data further for real deployments. |
| Flutter mobile app | Present, not fully verified | `mobile_app/lib/*`, `pubspec.yaml`. It is a genuine Flutter project, not a React page. API host, field names, rates matrix, transaction parsing, and transfer payloads were aligned with Express. Flutter/Dart tooling is not installed in this environment, so no `flutter analyze`, test, APK, emulator, or device run is claimed. |
| Automated tests | Missing | No test/spec files or test script were found. Existing client build/lint and server syntax checks are available. Add repeatable API tests as a next step. |
| Documentation | Created for presentation | This audit and `SYSTEM_DIAGRAMS.md` reflect the observed source. Known limitations and unverified claims are called out. |

## Verified Stack and Connections

- Web: React 19 + Vite 8. Client API helper: `client/src/services/api.js`; requests use `/api`; Vite proxies `/api` to `http://localhost:5055` in `client/vite.config.js`.
- API: Node.js 24 in the current environment, Express 4, Sequelize 6, JWT, bcrypt. Server reads `PORT` and now defaults from `server/.env` to 5055.
- Database: PostgreSQL is the configured dialect. The server `.env` is intentionally not reproduced here. SQLite is available for isolated tests through `DB_DIALECT=sqlite`.
- Fraud: Python 3.14 is available and required Python packages import successfully here. Flask listens on port 5001 by default. FastAPI is not used.
- Mobile: Flutter project exists; emulator API URL now uses `10.0.2.2:5055/api`. Flutter executable was not found in this environment.
- Exchange providers: ExchangeRate-API at `https://v6.exchangerate-api.com` (optional server-only `EXCHANGE_API_KEY`) and keyless live rates from `https://open.er-api.com`.
- No payment/settlement provider was found. Transfers are internal wallet ledger operations only.

## Existing Database Cleanup

With the user's approval, the configured PostgreSQL demo ledger was reset on 2026-10-29. All transaction and fraud-alert rows were removed and all wallet balances were set to zero; the seven user accounts, three linked funding sources, wallet records, and stored exchange-rate data were retained. This cleared the seven legacy `DEPOSIT` rows that had no `funding_source_id` and could not be verified as provider-confirmed.

## Database Design Evidence

Actual Sequelize models and SQL define:

- `users`: UUID primary key, unique email, password hash, role, profile fields, simulated KYC status/tier/limits/document fields, timestamps.
- `wallets`: UUID primary key, one wallet per user through unique `user_id`, default currency.
- `wallet_balances`: UUID primary key, wallet foreign key, currency and non-negative numeric balance; unique `(wallet_id, currency)`.
- `transactions`: UUID primary key, user and wallet foreign keys, type, source/destination currencies and amounts, rate, recipient, status, risk score/level/factors, timestamps.
- `fraud_alerts`: UUID primary key, transaction foreign key, score, level, reason, review state, optional reviewer foreign key and notes.
- `exchange_rates`: UUID primary key, base/currency/rate/source/fetched timestamp; unique base/currency pair.

There is no separate KYC document table, fraud-assessment table, payment-provider record, or standalone analyst-review table. Risk fields live on transactions; review state lives on fraud alerts.

## API Endpoint Inventory

All paths below are mounted under `/api`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create account, initialize wallet, and link required provider account using mock OTP |
| POST | `/auth/login` | Public | Verify credentials and issue JWT |
| GET | `/auth/profile` | Authenticated | Current profile and wallet |
| GET | `/auth/kyc/status` | Authenticated | Read simulated KYC status and limits |
| POST | `/auth/kyc/verify` | Authenticated | Simulate KYC approval and raise limit |
| POST | `/auth/logout` | Authenticated | Acknowledge logout; JWT is removed client-side, not revoked server-side |
| GET | `/wallet` | Authenticated | Read wallet and balances |
| POST | `/wallet/default-currency` | Authenticated | Change display/default currency |
| GET | `/funding/providers?country=XX` | Public | List country-supported funding providers and currencies |
| GET | `/funding/sources` | Authenticated | Read linked account status and simulated balance |
| POST | `/conversions/preview` | Authenticated | Preview conversion |
| POST | `/conversions/execute` | Authenticated | Convert internal wallet balances |
| POST | `/transfers/pre-screen` | Authenticated | Request a risk assessment |
| POST | `/transfers/execute` | Authenticated | Internal wallet transfer with risk decision |
| GET | `/transactions` | Authenticated | User transaction history; `page` and `limit` |
| GET | `/transactions/:id` | Authenticated | Read own transaction; privileged roles can read any |
| GET | `/fraud/my-alerts` | Authenticated | Current user's risk alerts |
| GET | `/fraud/alerts` | Admin/reviewer | Review queue |
| PATCH | `/fraud/alerts/:id/review` | Admin/reviewer | Approve, reject, or resolve a pending alert |
| GET | `/rates` | Public | Rates, cross-rate matrix, timestamp, source |
| GET | `/rates/:from/:to` | Public | One cross-rate |
| POST | `/rates/quote` | Public | 60-second in-memory quote |
| GET | Fraud service `/api/health` | Internal | Flask service health |
| POST | Fraud service `/api/fraud/assess` | Internal | Model/rule risk assessment |
| GET | Fraud service `/api/fraud/explain` | Internal/public service route | Methodology description |

## Input Design and Validation

| Form | Current input and validation | Processing outcome / caveat |
|---|---|---|
| Registration | Name, email, password, phone, default currency, and required local-account country/provider/account number/mock OTP (`123456`). Provider choices come from the registry. | Creates the user, wallet/seven balances, and one linked source with a 10,000 simulated balance atomically. No email verification or password-reset flow. |
| Login | Email and password; backend normalizes email and checks bcrypt hash. | JWT expires after seven days. Logout currently removes the client token only. |
| KYC | Document type and number required. | Prototype immediately stores values and changes status to verified; no provider or actual identity check. Do not enter real sensitive identifiers in a demo. |
| Automatic funding | No wallet-funding form. One active local account is linked during registration; the dashboard shows its provider, masked number, country, status and simulated balance read-only. | After risk screening, an approved mock gateway pull covers only a conversion/transfer shortfall; the wallet is credited only after confirmation, and the linked source balance is debited. |
| Conversion | Source currency, destination currency, positive amount; both currencies must be supported and differ for execution. | On the Convert action, fetches a live provider-backed rate, margin and fee, then executes against that 60-second quote. No quote is calculated while typing. |
| Transfer | Sender from authenticated token; recipient email, source currency, destination currency, positive amount. | Requires supported currencies, non-self recipient, registered destination wallet, KYC and daily limits, then risk assessment; any shortfall is pulled only after risk screening. Internal ledger credit only. No idempotency key; no provider settlement. |
| Analyst review | Alert ID, decision in `APPROVED`, `REJECTED`, `RESOLVED`, optional notes. | Role-protected; one pending alert can be reviewed once. Approval releases held value/credits recipient; rejection refunds sender. Review and balances run in a DB transaction. |

The API, not just the UI, performs these checks. It does not yet provide a general idempotency-key mechanism, and no adversarial/concurrency test is claimed.

## Test Evidence

Current implementation validation:

- React production build passed.
- Client lint completed with existing warnings; no lint errors were reported.
- `node --check` passed for all 36 server JavaScript files.
- An isolated in-memory SQLite API integration passed required OTP registration, forced gateway decline with unchanged wallet balance, confirmed conversion and transfer, decreasing source balance, and provider-linked funding history.
- Flutter SDK is unavailable, so Flutter analyzer/device validation could not run.

The following checks were run during the 2026-10-29 audit and describe that earlier revision; its callback-based sandbox details are superseded by the automatic-funding flow above.

- `npm --prefix client run build`: passed after the final funding, exchange-rate label, and risk-display updates.
- `npm --prefix client run lint`: completed with existing warnings for unused imports/variables, React effect patterns/dependencies, and a no-useless-catch report; no clean-lint claim is made.
- `node --check` across all 35 `server/src/**/*.js` files: passed.
- PostgreSQL end-to-end checks passed: wallet balance stayed unchanged before callback; sandbox confirmation credited the provider-returned amount; mismatched callback amount was rejected; callback replay did not double-credit; forced failure left the balance unchanged; and a live-rate conversion and its fee persisted across an API restart. A transaction-history response included the provider and a masked account number. Startup migration of funding fields and existing varchar user IDs succeeded.
- React production build passed with the funding UI, and client lint completed with existing warnings. Flutter SDK is unavailable, so Flutter analyzer/device validation could not run.
- Python source compilation and imports for Flask, Flask-CORS, NumPy, and scikit-learn: passed; scikit-learn version observed as 1.9.1.
- PaySim trainer completed on all 6,362,620 source rows, retaining 2,770,409 TRANSFER/CASH_OUT rows and 8,213 fraud labels. The stratified test set had 554,082 rows including 1,643 fraud examples; fraud-class precision 0.9994, recall 0.9970, F1 0.9982; confusion matrix `[[552438, 1], [5, 1638]]`.
- Fresh-process model load and Flask endpoint checks passed. Flask health reports `scoring_mode: ml_model`; model predictions on sampled PaySim normal and fraudulent TRANSFER rows returned 1%/LOW and 100%/BLOCK. Deposits and conversions return `heuristic_fallback` as intended.
- Isolated SQLite transaction checks passed with deterministic model outcomes: LOW credited recipient; REVIEW held sender funds and created a pending alert; BLOCK stored a rejected record and scoring mode without changing either balance.
- PostgreSQL server connection, ORM synchronization, and KYC-column inspection: passed in prior checks. Do not confuse that schema check with the full PostgreSQL end-to-end journey.
- CORS preflight from `http://127.0.0.1:5164`: HTTP 204 with matching allow-origin; health returned HTTP 200.
- Vite proxy rate quote: HTTP 200 in prior smoke test. Authenticated calls without a token returned expected HTTP 401, not fetch/CORS failures.
- ExchangeRate-API credentials are optional: if `EXCHANGE_API_KEY` is absent, live rates are fetched from the keyless provider. If both live providers fail, only a complete persisted snapshot is used; otherwise the API returns an error rather than inventing rates.
- After the user's approval, the seven legacy deposit records and all other transaction/fraud-alert history were cleared, and all 44 currency balance rows were verified at zero. All seven user accounts and three linked funding sources were retained. A fresh sandbox funding transaction was then verified and its temporary test user removed.
- Isolated SQLite API checks: registration/login (201/200), wallet fetch, KYC-limited transfer (403), simulated KYC update (200), mismatched quote rejection (400), valid conversion (200), unknown-recipient rejection (404) with unchanged sender balance, and registered internal transfer (200, recipient credited) passed. The first high-risk test returned Medium because a large initial deposit skewed the behavioral average; no high-risk result is claimed from that run.
- The project is not available as a Git working tree in the current workspace, so no GitHub push could be made. `npm run seed` uses `sync({ force: true })` and is destructive; it was not run.
- Flutter analysis/build and a fully clean high-risk/admin-review end-to-end test: not run. Flutter tooling is unavailable; the full test invocation was skipped/interrupted. These remain explicit verification gaps.

## Startup and Demo Instructions

Prerequisites: Node.js/npm; PostgreSQL configured in `server/.env`; Python plus `fraud-detection/requirements.txt` for the ML service. Do not share `.env` contents. Never use `npm run seed` on data you need; it drops and recreates tables.

1. Prepare the database once using the configured PostgreSQL instance and `database/schema.sql`, or the project's `npm --prefix server run db:init` in a disposable environment. Review the SQL and database target before running either initializer.
2. Start Flask fraud service in terminal 1:
   `python -m pip install -r fraud-detection/requirements.txt`
   `python fraud-detection/app.py`
3. Start Express in terminal 2:
   `npm --prefix server install`
   `npm --prefix server run dev`
   It uses port 5055 from the local server configuration.
4. Start React in terminal 3:
   `npm --prefix client install`
   `npm --prefix client run dev`
   Vite normally uses port 5163 and proxies `/api` to 5055. Open the URL Vite prints.
5. Register a new traveller through the UI. Use only invented academic demo details; link a provider-registry account during signup and enter mock OTP `123456`. Convert or send more than the wallet balance to demonstrate the three-second just-in-time pull and the linked source balance decreasing. Set `MOCK_PAYMENT_FORCE_FAILURE=true` and restart the API to demonstrate a decline that leaves wallet and source balances unchanged. Submit demo KYC if testing a larger transfer, then inspect history and alerts. For reviewer flow, use an account whose role is explicitly configured as `admin` or `reviewer`; public registration creates ordinary users.
6. To use Flutter, install Flutter/Android tooling, run `flutter pub get` in `mobile_app`, and use an Android emulator whose host mapping is `10.0.2.2`. Run `flutter analyze` and test each API journey before presenting the mobile app as verified.

Funding uses mock provider adapters; new linked accounts start with a simulated balance of 10,000 in their registered currency. No real money is moved or real payment prompt delivered. Transfers are internal Smart Wallet ledger operations, not external remittances. Demo KYC and the fixed OTP are not real identity verification. Live exchange rates do not require a key with the configured keyless fallback; a stored complete snapshot is used only if live providers are unavailable.

## Presentation Guide

Suggested 6-minute sequence:

1. Problem: travellers cross borders with balances in different currencies and need a single place to understand conversion and transaction risk.
2. Scope: present this as an academic prototype, not a regulated wallet or settlement provider.
3. Architecture: explain React/Vite → Express API → PostgreSQL; Express calls the optional Flask risk service; ExchangeRate-API is server-side, cached, and falls back to the last stored snapshot.
4. Register a test traveller and show seven separate currency balances; point out the KYC status is simulated.
5. Register with a local account and mock OTP `123456`; convert an amount above the wallet balance to show just-in-time funding, the rate/fee/result, and the simulated source balance decrease.
6. Send an internal transfer to a second registered user. Explain risk assessment, status and recipient credit. If demonstrating a flagged path, use a controlled test account/history and verify it before presenting; do not promise a specific score from a particular amount.
7. Show history and the fraud alert/reviewer queue if a pending alert exists. Explain approval releases a held transfer and rejection refunds the source balance.
8. Close with test evidence, limitations and next steps: real KYC provider, payment settlement, idempotency/concurrency tests, real labelled fraud evaluation, and Flutter device validation.

### Likely Lecturer Questions

- **Is the fraud detector really machine learning?** Transfers use a scikit-learn Random Forest trained on PaySim's synthetic transaction data and return the model's `predict_proba` score. Deposits/conversions and outages use explicitly labelled heuristic fallback. The metrics measure a PaySim holdout only; they do not establish performance on real wallet transactions.
- **Are these exchange rates live?** ExchangeRate-API supplies them when `EXCHANGE_API_KEY` is configured; otherwise the service uses the keyless live provider. Rates are cached for 60 minutes and persisted. If both providers fail, a complete stored snapshot is used; if none exists, the API reports an error rather than showing fabricated rates.
- **Does a transfer reach a bank or mobile-money provider?** No. It is an internal ledger transfer to a registered Smart Wallet account.
- **Is identity verified?** No external provider is integrated. The current KYC endpoint simulates a verification status transition and should only receive fictional demo values.
- **Is Flutter implemented?** A Flutter source project exists, and the API mismatches found during audit were corrected, but Flutter SDK was unavailable here; an emulator/device build is not verified.
- **How are balances kept consistent?** Mutations use Sequelize database transactions, and the critical balance rows are selected with update locks. Idempotency and multi-process concurrency testing remain future work.

## Prioritized Remaining Work

1. Add repeatable integration tests for PostgreSQL, high-risk hold, analyst approve/reject, concurrency, quote expiry and balance invariants.
2. Install Flutter/Android tooling and run analyze/build/device tests; verify Android cleartext/network configuration for local HTTP.
3. Add a real/sandbox KYC provider or keep demo verification explicitly disabled outside academic demonstrations; protect and minimize identity data.
4. Add idempotency keys, transaction-level locking/unique safeguards for concurrent debits and review actions, and audit-friendly external-settlement boundaries.
5. Evaluate fraud behavior on representative labelled data; document feature units and model limitations; never report unsupported accuracy.
6. Validate PostgreSQL schema creation/migrations on a disposable clean database and remove destructive seed ambiguity from demo instructions.
