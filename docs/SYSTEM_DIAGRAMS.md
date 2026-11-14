# Smart Wallet System Diagrams

These diagrams represent the inspected implementation. Dashed/future components are not currently integrated.

## System Architecture

```mermaid
flowchart LR
  Traveller[Traveller browser]
  Analyst[Analyst browser]
  Web[React 19 web client<br/>Vite dev proxy]
  Mobile[Flutter client<br/>Source exists; not device-verified]
  API[Node.js / Express API<br/>JWT authentication and role checks]
  Auth[Auth and simulated KYC]
  Wallet[Wallet, conversion and transfer controllers]
  Rates[Rate management service]
  FraudClient[Fraud service client<br/>Node heuristic fallback]
  Flask[Flask service<br/>PaySim-trained Random Forest for transfers<br/>heuristic scoring for conversions]
  FX[ExchangeRate-API<br/>EXCHANGE_API_KEY server-side]
  DB[(PostgreSQL<br/>users, wallets, balances,<br/>transactions, alerts, rates)]
  Pay[Mock linked-account adapters<br/>3-second approval; no real settlement]

  Traveller --> Web
  Analyst --> Web
  Web -->|HTTP /api via Vite proxy| API
  Mobile -->|HTTP /api; emulator host mapping| API
  API --> Auth
  API --> Wallet
  API --> Rates
  API --> FraudClient
  Rates -->|60-minute cache; attempt fetch| FX
  Rates -->|persist/fallback to last stored snapshot| DB
  Auth --> DB
  Wallet -->|read/write in DB transactions| DB
  FraudClient -->|assessment request| Flask
  FraudClient -.->|fallback if unavailable| Wallet
  Wallet -->|risk assessed before transfer commit| FraudClient
  Wallet -->|transactional balance/ledger changes| DB
  Wallet -->|After fraud check: pull exact shortfall| Pay
  Pay -->|Confirmed or declined| Wallet
  Wallet -->|Confirmed funding credit, source debit, conversion/transfer| DB
```

## DFD Level 0: Context

```mermaid
flowchart LR
  Traveller[External entity: Traveller]
  Analyst[External entity: Analyst / administrator]
  FX[External entity: Exchange-rate provider]
  Settlement[External entity: Payment / transfer provider<br/>Not integrated]
  System((0. Smart Wallet system<br/>React / Flutter clients + Express API<br/>Flask fraud assessment + database))

  Traveller -->|Registration, login, KYC demo input, wallet queries, conversion and transfer requests| System
  System -->|Authentication result, balances, rate source, quote, transfer status, history and own risk alerts| Traveller
  Analyst -->|Login, alert filters, approve/reject/resolve decision and notes| System
  System -->|Flagged transaction details, risk score/reason and review result| Analyst
  System -->|USD rate snapshot request| FX
  FX -->|Provider rate response, if reachable| System
  System -.->|No request or settlement flow implemented| Settlement
  Settlement -.->|No settlement response implemented| System
```

## DFD Level 1: Main Processes and Stores

```mermaid
flowchart LR
  Traveller[External entity: Traveller]
  Analyst[External entity: Analyst]
  FX[External entity: FX provider]
  Flask[External process: Flask fraud service<br/>PaySim Random Forest for transfers<br/>heuristic scoring for conversions]
  Auth((1.0 Authenticate user and simulate KYC))
  Wallet((2.0 Manage wallet and automatic confirmed funding))
  Rates((3.0 Retrieve rates, quote and convert))
  Transfer((4.0 Validate and process internal transfer))
  Risk((5.0 Assess risk and create alert))
  History((6.0 Read history and review alerts))
  Users[(D1 users)]
  Wallets[(D2 wallets and wallet_balances)]
  Ledger[(D3 transactions)]
  AlertStore[(D4 fraud_alerts)]
  RateStore[(D5 exchange_rates)]

  Traveller -->|Registration/login/KYC fields| Auth
  Auth -->|JWT, profile, demo KYC status| Traveller
  Auth <--> Users
  Auth --> Wallets
  Traveller -->|Balance/default currency/conversion or transfer request| Wallet
  Wallet -->|Balances and transaction result| Traveller
  Wallet <--> Wallets
  Wallet -->|Provider-linked funding credit ledger record| Ledger
  Traveller -->|Currency pair, amount, optional quote ID| Rates
  Rates -->|FX request| FX
  FX -->|Rates| Rates
  Rates <--> RateStore
  Rates -->|Rate source, preview/quote or conversion status| Traveller
  Rates -->|Conversion ledger/risk state| Ledger
  Rates -->|High-risk conversion alert| AlertStore
  Traveller -->|Recipient, currencies and amount| Transfer
  Transfer -->|Transaction context before commit| Risk
  Risk -->|HTTP assessment request| Flask
  Flask -->|Score, risk level and factors| Risk
  Risk -->|Risk score, level, recommendation and factors| Transfer
  Risk -->|Flagged assessment record| AlertStore
  Transfer <--> Wallets
  Transfer -->|Approved/flagged transaction record| Ledger
  Transfer -->|Status and internal recipient result| Traveller
  Analyst -->|Review decision and notes| History
  History <--> AlertStore
  History <--> Ledger
  History -->|Review queue / decision result| Analyst
  Traveller -->|History / personal alert query| History
  History -->|Own history and alert details| Traveller
  History --> Users
```

Process 5 is an internal Express-to-Flask call when Flask is reachable; otherwise Express uses its Node heuristic fallback. There is no external payment settlement process. A high-risk transfer debits/reserves source funds and is marked `FLAGGED`; analyst approval completes/releases it, while rejection marks it `REJECTED` and refunds the sender.

## UML Use Case Diagram

PlantUML is used here to show standard UML actors, system boundary, and relationships.

```plantuml
@startuml
left to right direction
actor Traveller
actor Analyst
actor Administrator
actor "Exchange-rate provider" as FX
actor "Mock funding-provider adapters\n(real providers not integrated)" as Pay

rectangle "Smart Wallet" {
  usecase "Register" as UC1
  usecase "Log in / log out" as UC2
  usecase "Submit demo KYC" as UC3
  usecase "View wallet balances" as UC4
  usecase "View exchange rates" as UC5
  usecase "Preview conversion" as UC6
  usecase "Confirm conversion" as UC7
  usecase "Initiate transfer" as UC8
  usecase "Assess transaction risk" as UC9
  usecase "Confirm low/medium-risk transfer" as UC10
  usecase "Hold high-risk transfer" as UC11
  usecase "View transaction history" as UC12
  usecase "View personal risk alerts" as UC13
  usecase "Review flagged transaction" as UC14
  usecase "Approve / reject / resolve" as UC15
  usecase "Manage users/configuration" as UC16
  usecase "Fetch provider rates" as UC17
}

Traveller -- UC1
Traveller -- UC2
Traveller -- UC3
Traveller -- UC4
Traveller -- UC5
Traveller -- UC6
Traveller -- UC7
Traveller -- UC8
Traveller -- UC10
Traveller -- UC12
Traveller -- UC13
Analyst -- UC2
Analyst -- UC12
Analyst -- UC13
Analyst -- UC14
Analyst -- UC15
Administrator -- UC2
Administrator -- UC14
Administrator -- UC15
Administrator -- UC16
FX -- UC17
UC6 ..> UC5 : <<include>>
UC7 ..> UC6 : <<include>>
UC8 ..> UC9 : <<include>>
UC11 ..> UC9 : <<extend>>
UC15 ..> UC14 : <<include>>

note right of Pay
No payment provider is integrated.
Transfers are internal ledger credits only.
end note
note bottom of UC3
Prototype status update only;
not real identity verification.
end note
@enduml
```

## Entity-Relationship Diagram

```mermaid
erDiagram
  USERS ||--o| WALLETS : owns
  WALLETS ||--|{ WALLET_BALANCES : contains
  USERS ||--o{ TRANSACTIONS : initiates
  WALLETS ||--o{ TRANSACTIONS : records
  TRANSACTIONS ||--o| FRAUD_ALERTS : may_raise
  USERS o|--o{ FRAUD_ALERTS : reviews

  USERS {
    uuid id PK
    string name
    string email UK
    string password_hash
    string role
    string kyc_status
    int kyc_tier
    decimal daily_limit_usd
    string id_document_type
    string id_document_number
  }
  WALLETS {
    uuid id PK
    uuid user_id FK_UK
    string default_currency
  }
  WALLET_BALANCES {
    uuid id PK
    uuid wallet_id FK
    string currency
    decimal balance
  }
  TRANSACTIONS {
    uuid id PK
    uuid user_id FK
    uuid wallet_id FK
    string transaction_type
    string source_currency
    string destination_currency
    decimal source_amount
    decimal converted_amount
    decimal exchange_rate
    string status
    decimal fraud_risk_score
    string fraud_risk_level
    json risk_factors
  }
  FRAUD_ALERTS {
    uuid id PK
    uuid transaction_id FK
    decimal risk_score
    string risk_level
    string review_status
    uuid reviewed_by FK
    datetime reviewed_at
    text reason
  }
  EXCHANGE_RATES {
    uuid id PK
    string base_currency
    string currency
    decimal rate
    string source
    datetime fetched_at
  }
```

A user's KYC state is stored on `users`, not in a separate KYC table. Country/provider linked sources are stored in `linked_accounts`; funding transactions reference the source and provider reference. Unique constraints apply to `(wallet_id, currency)` and `(base_currency, currency)`. Fraud assessment details are attached to transactions; review state is in `fraud_alerts`. The mock gateway adapters do not represent real payment-provider settlement tables.
