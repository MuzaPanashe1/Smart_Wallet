import logging
import os

import joblib
import numpy as np
import pandas as pd

MODEL_FILE = os.path.join(os.path.dirname(__file__), 'fraud_model.pkl')
FEATURE_NAMES = [
    'amount',
    'is_transfer',
    'oldbalanceOrg',
    'newbalanceOrig',
    'oldbalanceDest',
    'newbalanceDest',
    'hour',
    'balance_error'
]
LOGGER = logging.getLogger('smart_wallet.fraud')

class FraudDetectionModel:
    def __init__(self):
        self.model = None
        self.feature_names = FEATURE_NAMES
        try:
            self._load_model()
        except Exception:
            LOGGER.exception('Could not load the PaySim model; heuristic fallback is active.')

    def train(self):
        raise RuntimeError('Train the PaySim model with: python train_model.py')

    def _load_model(self):
        if not os.path.isfile(MODEL_FILE):
            LOGGER.warning('PaySim model file is missing at %s; heuristic fallback is active.', MODEL_FILE)
            return

        bundle = joblib.load(MODEL_FILE)
        if bundle.get('features') != FEATURE_NAMES:
            raise ValueError('Model feature list does not match the PaySim inference schema.')
        if not hasattr(bundle.get('model'), 'predict_proba'):
            raise ValueError('Loaded model does not support predict_proba.')
        self.model = bundle['model']
        LOGGER.info('Loaded PaySim Random Forest model from %s.', MODEL_FILE)

    def assess_transaction(self, data):
        transaction_type = str(data.get('transaction_type', 'TRANSFER')).upper()
        if transaction_type == 'TRANSFER' and self.model is not None:
            try:
                values = data.get('features') or data
                row = {name: float(values[name]) for name in FEATURE_NAMES}
                features = pd.DataFrame([row], columns=FEATURE_NAMES, dtype=np.float32)
                classes = list(self.model.classes_)
                fraud_probability = float(self.model.predict_proba(features)[0][classes.index(1)])
                score = round(float(np.clip(fraud_probability * 100.0, 0.0, 100.0)), 2)
                result = self._result(score, 'ml_model')
                result['risk_factors'] = [
                    f'PaySim-trained Random Forest estimated {score:.2f}% fraud probability.'
                ]
                if abs(row['balance_error']) > max(1.0, row['amount'] * 0.01):
                    result['risk_factors'].append(
                        'Sender balance movement does not match the attempted transfer amount.'
                    )
                result['features'] = row
                return result
            except Exception:
                LOGGER.exception('PaySim prediction failed; using heuristic fallback for this assessment.')

        return self._assess_heuristic(data)

    @staticmethod
    def _result(score, scoring_mode):
        score = round(float(np.clip(score, 0.0, 100.0)), 2)
        if score < 30.0:
            decision, risk_level = 'LOW', 'Low Risk'
        elif score <= 70.0:
            decision, risk_level = 'REVIEW', 'Medium Risk'
        else:
            decision, risk_level = 'BLOCK', 'High Risk'
        return {
            'risk_score': score,
            'risk_level': risk_level,
            'decision': decision,
            'recommendation': decision,
            'flagged': decision != 'LOW',
            'scoring_mode': scoring_mode,
            'risk_factors': []
        }

    def _assess_heuristic(self, data):
        amount = max(0.0, float(data.get('amount_usd', data.get('amount', 0)) or 0))
        average = max(1.0, float(data.get('user_avg_amount', amount or 1) or 1))
        minutes = max(0.0, float(data.get('minutes_since_last_tx', 1440) or 0))
        velocity = max(0, int(data.get('user_tx_count_last_hour', 0) or 0))
        ratio = amount / average
        score = 5.0
        reasons = []

        if ratio >= 4:
            score += 30
            reasons.append(f'Amount is {ratio:.1f}x the recent average.')
        elif ratio >= 2:
            score += 15
            reasons.append(f'Amount is {ratio:.1f}x the recent average.')
        if minutes < 2 and velocity >= 2:
            score += 25
            reasons.append('Another transaction occurred within two minutes.')
        if velocity >= 4:
            score += 20
            reasons.append(f'{velocity} transactions occurred within the last hour.')
        if amount >= 3000:
            score += 25
            reasons.append('Transaction amount is unusually large for this prototype.')

        result = self._result(score, 'heuristic_fallback')
        result['risk_factors'] = reasons or ['No heuristic risk threshold was triggered.']
        return result

if __name__ == '__main__':
    model = FraudDetectionModel()
    print('Model scoring mode:', 'ml_model' if model.model is not None else 'heuristic_fallback')
    print('Normal sample:', model.assess_transaction({'transaction_type': 'DEPOSIT', 'amount_usd': 50}))
