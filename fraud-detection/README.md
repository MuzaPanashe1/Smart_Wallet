# Smart Wallet Fraud Service

## Current Training State

The PaySim model was trained from the local dataset on 2026-10-11. The saved bundle loads, and `/api/health` reports `scoring_mode: ml_model`. Transfer endpoint smoke tests route through the model; deposits and conversions explicitly remain heuristic-scored. Restart the Python service after retraining so the process reloads the artifact.

The held-out test set contained 554,082 rows (1,643 fraud). Fraud-class precision was 0.9994, recall 0.9970, and F1 0.9982; the confusion matrix was `[[552438, 1], [5, 1638]]`. A sampled normal PaySim TRANSFER scored 1% / LOW and a sampled fraudulent TRANSFER scored 100% / BLOCK. These are dataset evaluation and example results, not real-world wallet performance or calibrated probabilities; PaySim is synthetic and differs from this multi-currency wallet.

## Train

From the repository root, install dependencies and train from the already-downloaded PaySim file:

```powershell
python -m pip install -r fraud-detection/requirements.txt
python fraud-detection/train_model.py
```

The trainer reads only the required columns in chunks from `fraud-detection/data/PS_20174392719_1491204439457_log.csv`, filters to `TRANSFER` and `CASH_OUT`, and writes:

- `fraud-detection/fraud_model.pkl`
- `fraud-detection/metrics.txt`

Metrics include the classification report (precision, recall, F1) and confusion matrix. Training uses the full filtered dataset; it may take several minutes and substantial memory. Do not open or commit the CSV; `fraud-detection/data/` is ignored by Git.

## Run

After training, restart the Python service:

```powershell
python fraud-detection/app.py
```

The service listens on port 5001 by default. Check `GET http://127.0.0.1:5001/api/health`; it reports `scoring_mode`. `ml_model` means the joblib bundle loaded; `heuristic_fallback` means it did not. A model load or prediction error is logged and falls back instead of crashing the service.

Restart Express after the Python service is up:

```powershell
npm --prefix server run dev
```

The Node client calls the Python service at `FRAUD_SERVICE_URL` (default `http://127.0.0.1:5001`). The API is on port 5055 and the Vite client on port 5164 in this workspace setup.

## Features and decision policy

The Random Forest uses exactly these ordered columns:

`amount`, `is_transfer`, `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest`, `newbalanceDest`, `hour`, `balance_error`.

`hour` is `step % 24` during training. `balance_error` is `newbalanceOrig + amount - oldbalanceOrg`. For wallet transfers, the server maps the source amount and sender/recipient balances to USD equivalents, uses the current hour modulo 24, and computes the same balance error. PaySim has no currency field; this currency normalization is an explicit prototype approximation.

Only `TRANSFER` requests use the PaySim classifier. Deposits and conversions use the service heuristic because they do not have PaySim-style sender/receiver balance context. If the model is missing, incompatible, or prediction fails, the transfer uses the same heuristic fallback. Every assessment returns `scoring_mode` as `ml_model` or `heuristic_fallback`.

- Less than 30%: `LOW`, transfer may proceed.
- 30% through 70% inclusive: `REVIEW`, sender funds are held and a pending alert is recorded.
- Greater than 70%: `BLOCK`, a rejected attempt and resolved alert are recorded; sender and recipient balances do not change.

The displayed `predict_proba` value is a classifier score, not a calibrated real-world fraud probability. PaySim is synthetic data with substantial domain differences from a travel-wallet ledger. Report the generated test metrics, but do not claim real-world accuracy or effectiveness from them alone.

## Demo sequence

1. Train once with `python fraud-detection/train_model.py` and inspect `metrics.txt`.
2. Restart `python fraud-detection/app.py`, then restart Express.
3. Register two demo accounts and add clearly labelled demo funds to the sender. KYC is simulated in this prototype.
4. Make a normal transfer, run **Screen risk**, and check for `LOW`/`ml_model` before confirming.
5. In the transfer form, choose a funded source currency, enter the recipient, and use **Fill full balance demo amount**. This only fills the form. Screening does not move funds, but confirming a `LOW` result will transfer the entire selected-currency balance. Check for `REVIEW` or `BLOCK`; a particular result is not guaranteed by a specific amount.
6. Review score, decision, reason, and scoring mode in the fraud-alert view and transaction ledger.

Transfers are internal wallet ledger changes. There is no external payment settlement provider.
