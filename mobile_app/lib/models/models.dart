class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? country;
  final String? phone;
  final String kycStatus;
  final int kycTier;
  final double dailyLimitUsd;
  final WalletModel? wallet;

  const UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.country,
    this.phone,
    this.kycStatus = 'TIER_1_PENDING',
    this.kycTier = 1,
    this.dailyLimitUsd = 1500.0,
    this.wallet,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'user',
      country: json['country'],
      phone: json['phone'],
      kycStatus: json['kyc_status'] ?? 'TIER_1_PENDING',
      kycTier: json['kyc_tier'] ?? 1,
      dailyLimitUsd: double.tryParse(json['daily_limit_usd']?.toString() ?? '1500') ?? 1500.0,
      wallet: json['wallet'] != null ? WalletModel.fromJson(json['wallet']) : null,
    );
  }
}

class WalletModel {
  final String id;
  final String defaultCurrency;
  final double totalBalanceInDefault;
  final List<BalanceModel> balances;

  const WalletModel({
    required this.id,
    required this.defaultCurrency,
    this.totalBalanceInDefault = 0,
    required this.balances,
  });

  factory WalletModel.fromJson(Map<String, dynamic> json) {
    final balanceList = (json['balances'] as List<dynamic>? ?? [])
        .map((b) => BalanceModel.fromJson(b as Map<String, dynamic>))
        .toList();
    return WalletModel(
      id: json['id']?.toString() ?? '',
      defaultCurrency: json['defaultCurrency'] ?? json['default_currency'] ?? 'USD',
      totalBalanceInDefault:
          double.tryParse(json['totalBalanceInDefault']?.toString() ?? '0') ?? 0,
      balances: balanceList,
    );
  }

  double getBalance(String currency) {
    final match = balances.where((b) => b.currency == currency);
    return match.isNotEmpty ? match.first.balance : 0.0;
  }
}

class BalanceModel {
  final String currency;
  final double balance;

  const BalanceModel({required this.currency, required this.balance});

  factory BalanceModel.fromJson(Map<String, dynamic> json) {
    return BalanceModel(
      currency: json['currency'] ?? '',
      balance: double.tryParse(json['balance']?.toString() ?? '0') ?? 0.0,
    );
  }
}

class TransactionModel {
  final String id;
  final String type;
  final double amount;
  final String currency;
  final String? toAmount;
  final String? toCurrency;
  final String status;
  final String? description;
  final String? fundedFrom;
  final DateTime createdAt;
  final double? riskScore;
  final String? riskLevel;
  final String scoringMode;
  String get scoringModeLabel => scoringMode == 'ml_model'
      ? 'AI model'
      : scoringMode == 'heuristic_fallback'
          ? 'Risk rules'
          : 'Risk screening';

  const TransactionModel({
    required this.id,
    required this.type,
    required this.amount,
    required this.currency,
    this.toAmount,
    this.toCurrency,
    required this.status,
    this.description,
    this.fundedFrom,
    required this.createdAt,
    this.riskScore,
    this.riskLevel,
    this.scoringMode = 'heuristic_fallback',
  });

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    final type = json['transaction_type'] ?? json['type'] ?? '';
    final fundingSource = json['fundingSource'];
    final rawAmount = type == 'DEPOSIT'
        ? json['converted_amount']
        : (json['source_amount'] ?? json['amount']);
    return TransactionModel(
      id: json['id']?.toString() ?? '',
      type: type,
      amount: double.tryParse(rawAmount?.toString() ?? '0') ?? 0.0,
      currency: type == 'DEPOSIT'
          ? json['destination_currency'] ?? 'USD'
          : json['source_currency'] ?? json['currency'] ?? 'USD',
      toAmount: json['converted_amount']?.toString() ?? json['to_amount']?.toString(),
      toCurrency: json['destination_currency'] ?? json['to_currency'],
      status: json['status'] ?? 'COMPLETED',
      description: json['description'],
      fundedFrom: fundingSource is Map<String, dynamic>
          ? 'Funded from ${fundingSource['providerName'] ?? fundingSource['provider']}'
          : null,
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
      riskScore: double.tryParse(json['fraud_risk_score']?.toString() ?? json['risk_score']?.toString() ?? ''),
      riskLevel: json['fraud_risk_level'] ?? json['risk_level'],
      scoringMode: json['scoring_mode'] ?? 'heuristic_fallback',
    );
  }
}
