# Smart Wallet

### AI-Powered Multi-Currency Travel Wallet with Exchange Rate Management and Fraud Detection

Smart Wallet is a software prototype designed to help cross-border travellers manage multiple currencies, monitor exchange rates, convert funds and identify potentially suspicious transactions.

The system focuses on travellers moving between Zambia, Zimbabwe and Botswana.

## Key Features

- **Multi-Currency Wallet:** Manage balances across USD, GBP, EUR, ZAR, ZMW and BWP.
- **Currency Conversion:** Convert between supported currencies using available exchange rates.
- **Exchange Rate Management:** Retrieve and manage exchange rate information.
- **Fraud Detection:** Use a machine learning component to assess transactions and generate risk alerts.
- **Transaction Management:** Record and monitor wallet transactions.
- **Funding Management:** Manage funding sources within the prototype.
- **KYC:** Support user identity verification workflows.
- **Analyst Dashboard:** Provide a view of flagged transactions and their risk status.

## Technologies Used

| Component | Technology |
|---|---|
| Frontend | React, Vite, CSS |
| Backend | Node.js, Express.js |
| Database | SQL database configuration |
| Mobile Application | Flutter, Dart |
| Fraud Detection | Python, Machine Learning |
| Version Control | Git and GitHub |

## System Architecture

The project is organised into the following main components:

- `client/` – Web application frontend.
- `server/` – Backend API, authentication, wallet and transaction services.
- `database/` – Database schema and related files.
- `fraud-detection/` – Python-based fraud detection component.
- `mobile_app/` – Flutter mobile application.
- `docs/` – Project documentation and system diagrams.

## Project Purpose

The purpose of Smart Wallet is to explore how multi-currency wallet management, exchange rate information and AI-assisted fraud detection can be combined in one platform.

It is an academic software prototype and is not a licensed bank, payment processor or replacement for existing financial institutions.

## Getting Started

Clone the repository:

```bash
git clone https://github.com/MuzaPanashe1/Smart_Wallet.git
```

Open the project:

```bash
cd Smart_Wallet
```

Install the dependencies for the relevant components using their respective package managers.

Configure the required environment variables using the provided `.env.example` file. Never publish actual passwords, API keys or secret credentials.

Refer to the individual component folders for their setup requirements.

## Project Status

**Development in progress.**

Features and integrations are being developed and tested as part of an academic project.

## Repository

GitHub: https://github.com/MuzaPanashe1/Smart_Wallet

---

*Smart Wallet – Simplifying multi-currency travel wallet management through technology.*
