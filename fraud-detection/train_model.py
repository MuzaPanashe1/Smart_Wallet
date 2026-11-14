import argparse
import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from model import FEATURE_NAMES

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'PS_20174392719_1491204439457_log.csv')
MODEL_FILE = os.path.join(BASE_DIR, 'fraud_model.pkl')
METRICS_FILE = os.path.join(BASE_DIR, 'metrics.txt')
USE_COLUMNS = [
    'step', 'type', 'amount', 'oldbalanceOrg', 'newbalanceOrig',
    'oldbalanceDest', 'newbalanceDest', 'isFraud'
]
COLUMN_TYPES = {
    'step': 'int32',
    'type': 'category',
    'amount': 'float32',
    'oldbalanceOrg': 'float32',
    'newbalanceOrig': 'float32',
    'oldbalanceDest': 'float32',
    'newbalanceDest': 'float32',
    'isFraud': 'uint8'
}


def load_paysim(chunksize):
    feature_chunks = []
    label_chunks = []
    reader = pd.read_csv(
        DATA_FILE,
        usecols=USE_COLUMNS,
        dtype=COLUMN_TYPES,
        chunksize=chunksize
    )

    for chunk_number, chunk in enumerate(reader, start=1):
        chunk = chunk[chunk['type'].isin(['TRANSFER', 'CASH_OUT'])].copy()
        if chunk.empty:
            continue

        chunk['is_transfer'] = (chunk['type'] == 'TRANSFER').astype('float32')
        chunk['hour'] = (chunk['step'] % 24).astype('float32')
        chunk['balance_error'] = (
            chunk['newbalanceOrig'] + chunk['amount'] - chunk['oldbalanceOrg']
        ).astype('float32')
        feature_chunks.append(chunk[FEATURE_NAMES].astype('float32'))
        label_chunks.append(chunk['isFraud'].astype('uint8'))
        print(f'Loaded PaySim chunk {chunk_number:,}', flush=True)

    if not feature_chunks:
        raise ValueError('No TRANSFER or CASH_OUT rows found in the PaySim file.')

    return (
        pd.concat(feature_chunks, ignore_index=True),
        pd.concat(label_chunks, ignore_index=True)
    )


def train(chunksize):
    if not os.path.isfile(DATA_FILE):
        raise FileNotFoundError(f'PaySim dataset was not found at {DATA_FILE}')

    features, labels = load_paysim(chunksize)
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels
    )

    print(f'Training rows: {len(x_train):,}; test rows: {len(x_test):,}', flush=True)
    print(f'Fraud rows: {int(labels.sum()):,}; total rows: {len(labels):,}', flush=True)
    classifier = RandomForestClassifier(
        class_weight='balanced',
        n_estimators=100,
        n_jobs=-1,
        random_state=42
    )
    classifier.fit(x_train, y_train)
    predictions = classifier.predict(x_test)
    report = classification_report(y_test, predictions, digits=4, zero_division=0)
    matrix = confusion_matrix(y_test, predictions, labels=[0, 1])

    metrics = '\n'.join([
        'Smart Wallet PaySim Random Forest evaluation',
        f'Trained at (UTC): {datetime.now(timezone.utc).isoformat()}',
        f'Dataset: {DATA_FILE}',
        'Included transaction types: TRANSFER, CASH_OUT',
        f'Features: {", ".join(FEATURE_NAMES)}',
        'Split: 80/20, stratified, random_state=42',
        f'Train rows: {len(x_train):,}',
        f'Test rows: {len(x_test):,}',
        f'Fraud examples: {int(labels.sum()):,}',
        '',
        'Classification report:',
        report,
        'Confusion matrix (actual rows, predicted columns; labels 0, 1):',
        np.array2string(matrix),
        ''
    ])
    print(metrics)
    with open(METRICS_FILE, 'w', encoding='utf-8') as metrics_file:
        metrics_file.write(metrics)

    joblib.dump({
        'model': classifier,
        'features': FEATURE_NAMES,
        'classes': [int(value) for value in classifier.classes_],
        'source': 'PaySim',
        'transaction_types': ['TRANSFER', 'CASH_OUT']
    }, MODEL_FILE, compress=3)
    print(f'Model saved to {MODEL_FILE}')
    print(f'Metrics saved to {METRICS_FILE}')


def main():
    parser = argparse.ArgumentParser(description='Train the Smart Wallet PaySim fraud model.')
    parser.add_argument('--chunksize', type=int, default=500_000)
    args = parser.parse_args()
    train(args.chunksize)


if __name__ == '__main__':
    main()
