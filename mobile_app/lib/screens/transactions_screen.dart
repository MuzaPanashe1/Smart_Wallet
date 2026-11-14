import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../utils/app_theme.dart';

class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({super.key});
  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  final _api = ApiService();
  List<TransactionModel> _transactions = [];
  List<Map<String, dynamic>> _fraudAlerts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        _api.getTransactions(limit: 50),
        _api.getUserFraudAlerts(),
      ]);
      final res = results[0];
      final alertResponse = results[1];
      final list = res['transactions'] as List<dynamic>?
          ?? res['data'] as List<dynamic>?
          ?? [];
      final alerts = alertResponse['alerts'] as List<dynamic>? ?? [];
      setState(() {
        _transactions = list
            .map((t) => TransactionModel.fromJson(t as Map<String, dynamic>))
            .toList();
        _fraudAlerts = alerts
            .map((alert) => alert as Map<String, dynamic>)
            .toList();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load transactions');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: AppTheme.primary,
          backgroundColor: AppTheme.card,
          onRefresh: _load,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('Transaction History',
                          style: TextStyle(color: AppTheme.textPrimary,
                              fontSize: 22, fontWeight: FontWeight.w700)),
                      SizedBox(height: 4),
                      Text('Your recent wallet activity',
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
              ),
              if (_loading)
                const SliverToBoxAdapter(
                    child: Center(
                        child: Padding(
                            padding: EdgeInsets.all(40),
                            child: CircularProgressIndicator(color: AppTheme.primary))))
              else if (_error != null)
                SliverToBoxAdapter(
                    child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(_error!,
                            style: const TextStyle(color: AppTheme.danger))))
              else if (_transactions.isEmpty)
                const SliverToBoxAdapter(
                    child: Padding(
                        padding: EdgeInsets.all(40),
                        child: Center(
                            child: Column(children: [
                              Icon(Icons.receipt_long_outlined,
                                  color: AppTheme.textSecondary, size: 48),
                              SizedBox(height: 12),
                              Text('No transactions yet',
                                  style: TextStyle(color: AppTheme.textSecondary)),
                            ]))))
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (ctx, i) => _txTile(_transactions[i]),
                      childCount: _transactions.length,
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 12),
                  child: Text(
                    'Fraud Alerts',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              if (_fraudAlerts.isEmpty)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(24, 0, 24, 24),
                    child: Text(
                      'No fraud alerts',
                      style: TextStyle(color: AppTheme.textSecondary),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _fraudAlertTile(_fraudAlerts[index]),
                      childCount: _fraudAlerts.length,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _txTile(TransactionModel tx) {
    final fmt = NumberFormat('#,##0.00');
    final dateFmt = DateFormat('MMM d, y  HH:mm');
    final isCredit = tx.type == 'DEPOSIT';
    final color = isCredit ? AppTheme.success : AppTheme.textPrimary;
    final sign  = isCredit ? '+' : '-';

    Color riskColor = AppTheme.textSecondary;
    if (tx.riskLevel != null) {
      if (tx.riskLevel!.toLowerCase().contains('high'))   riskColor = AppTheme.danger;
      else if (tx.riskLevel!.toLowerCase().contains('medium')) riskColor = AppTheme.warning;
      else riskColor = AppTheme.success;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: AppTheme.card, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
                color: _txColor(tx.type).withOpacity(0.12),
                borderRadius: BorderRadius.circular(12)),
            child: Icon(_txIcon(tx.type), color: _txColor(tx.type), size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_txLabel(tx.type),
                    style: const TextStyle(color: AppTheme.textPrimary,
                        fontWeight: FontWeight.w600, fontSize: 14)),
                if (tx.fundedFrom != null)
                  Text(tx.fundedFrom!,
                      style: const TextStyle(
                          color: AppTheme.textSecondary, fontSize: 11)),
                Text(dateFmt.format(tx.createdAt),
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                if (tx.riskLevel != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Row(
                      children: [
                        Icon(Icons.security_rounded, size: 10, color: riskColor),
                        const SizedBox(width: 4),
                        Text('${tx.riskLevel} · ${tx.riskScore ?? 0}% · ${tx.scoringModeLabel}',
                            style: TextStyle(color: riskColor, fontSize: 10,
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('$sign${fmt.format(tx.amount)} ${tx.currency}',
                  style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 14)),
              _statusChip(tx.status),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    Color c;
    switch (status) {
      case 'COMPLETED': c = AppTheme.success; break;
      case 'success':   c = AppTheme.success; break;
      case 'PENDING':
      case 'PENDING_REVIEW':
      case 'FLAGGED':   c = AppTheme.warning; break;
      case 'FAILED':
      case 'failed':
      case 'REJECTED':  c = AppTheme.danger; break;
      default:          c = AppTheme.textSecondary;
    }
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
          color: c.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(status, style: TextStyle(color: c, fontSize: 10, fontWeight: FontWeight.w600)),
    );
  }

  Widget _fraudAlertTile(Map<String, dynamic> alert) {
    final riskLevel = alert['risk_level']?.toString() ?? 'Risk assessment';
    final status = alert['review_status']?.toString() ?? 'PENDING';
    final color = riskLevel.toLowerCase().contains('high')
        ? AppTheme.danger
        : AppTheme.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.security_rounded, color: color, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$riskLevel · ${alert['risk_score'] ?? '—'}%',
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                status.replaceAll('_', ' '),
                style: TextStyle(color: color, fontSize: 11),
              ),
            ],
          ),
          if (alert['reason'] != null) ...[
            const SizedBox(height: 8),
            Text(
              alert['reason'].toString(),
              style: const TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
    );
  }

  IconData _txIcon(String type) {
    switch (type) {
      case 'DEPOSIT':    return Icons.arrow_downward_rounded;
      case 'TRANSFER':   return Icons.send_rounded;
      case 'CONVERSION': return Icons.swap_horiz_rounded;
      default:           return Icons.receipt_long_outlined;
    }
  }

  Color _txColor(String type) {
    switch (type) {
      case 'DEPOSIT':    return AppTheme.success;
      case 'TRANSFER':   return AppTheme.primary;
      case 'CONVERSION': return AppTheme.secondary;
      default:           return AppTheme.textSecondary;
    }
  }

  String _txLabel(String type) {
    switch (type) {
      case 'DEPOSIT':    return 'Funds Received';
      case 'TRANSFER':   return 'Money Sent';
      case 'CONVERSION': return 'Currency Converted';
      default:           return type;
    }
  }
}
