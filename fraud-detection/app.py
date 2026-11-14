import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from model import FraudDetectionModel

app = Flask(__name__)
CORS(app)

# Initialize model
fraud_model = FraudDetectionModel()

@app.route('/health', methods=['GET'])
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "Smart Wallet Fraud Risk Service",
        "version": "1.0.0",
        "model": "PaySim-trained Random Forest" if fraud_model.model is not None else "Heuristic fallback (PaySim model unavailable)",
        "scoring_mode": "ml_model" if fraud_model.model is not None else "heuristic_fallback",
        "supported_currencies": ["USD", "GBP", "EUR", "ZAR", "ZMW", "BWP"]
    }), 200

@app.route('/api/fraud/assess', methods=['POST'])
def assess_fraud():
    """
    Receives transaction context from Node.js backend:
    - amount_usd: float
    - user_avg_amount: float
    - minutes_since_last_tx: float
    - user_tx_count_last_hour: int
    - source_currency: str
    - destination_currency: str
    - hour_of_day: int
    """
    data = request.get_json() or {}
    try:
        assessment = fraud_model.assess_transaction(data)
        return jsonify({
            "status": "success",
            "data": assessment
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[FraudService Error]: {e}", flush=True)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/fraud/explain', methods=['GET'])
def explain_methodology():
    return jsonify({
        "project": "Smart Wallet",
        "model_architecture": "PaySim-trained scikit-learn RandomForestClassifier for transfers; heuristic fallback for other types or model errors",
        "key_features": [
            "PaySim amount",
            "Transfer type indicator",
            "Sender balance before and after",
            "Recipient balance before and after",
            "Hour derived from PaySim step (step modulo 24)",
            "Sender balance movement error"
        ],
        "risk_levels": {
            "LOW": "Fraud probability below 30%: transfer may proceed",
            "REVIEW": "Fraud probability from 30% through 70%: transfer is held for review",
            "BLOCK": "Fraud probability above 70%: transfer is rejected without balance movement"
        },
        "academic_disclaimer": "The system computes probabilistic fraud-risk scores and classifies risk levels; it does not claim definitive proof of fraudulent intent."
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"[FraudService] Starting Fraud Detection API on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
