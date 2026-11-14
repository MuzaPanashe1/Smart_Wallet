import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../utils/app_theme.dart';
import '../utils/constants.dart';

String _scoringModeLabel(dynamic mode) {
  if (mode == 'ml_model') return 'AI model';
  if (mode == 'heuristic_fallback') return 'Risk rules';
  return 'Risk screening';
}

class TransferScreen extends StatefulWidget {
  const TransferScreen({super.key});
  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  final _api = ApiService();
  final _recipientCtrl  = TextEditingController();
  final _amountCtrl     = TextEditingController();
  final _descCtrl       = TextEditingController();
  String _currency = 'USD';
  String _destinationCurrency = 'ZMW';
  bool _screening = false;
  bool _executing = false;
  Map<String, dynamic>? _riskResult;
  String? _error;
  String? _success;

  Future<void> _preScreen() async {
    if (_recipientCtrl.text.isEmpty) {
      setState(() => _error = 'Recipient email is required');
      return;
    }
    final amount = double.tryParse(_amountCtrl.text);
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a valid amount');
      return;
    }
    setState(() { _screening = true; _error = null; _riskResult = null; _success = null; });
    try {
      final res = await _api.preScreenTransfer({
        'recipientEmail': _recipientCtrl.text.trim(),
        'amount': amount,
        'sourceCurrency': _currency,
        'destinationCurrency': _destinationCurrency,
        'description': _descCtrl.text.trim(),
      });
      if (res['success'] == true) {
        setState(() => _riskResult = res);
      } else {
        setState(() => _error = res['message'] ?? 'Pre-screen failed');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Network error');
    } finally {
      setState(() => _screening = false);
    }
  }

  Future<void> _send() async {
    final amount = double.tryParse(_amountCtrl.text);
    if (amount == null) return;
    setState(() { _executing = true; _error = null; });
    try {
      final res = await _api.executeTransfer({
        'recipientEmail': _recipientCtrl.text.trim(),
        'amount': amount,
        'sourceCurrency': _currency,
        'destinationCurrency': _destinationCurrency,
        'description': _descCtrl.text.trim(),
      });
      if (res['success'] == true) {
        final transfer = res['transfer'] as Map<String, dynamic>? ?? {};
        setState(() {
          _success = transfer['status'] == 'FLAGGED'
              ? 'Transfer held for review. Reference: ${transfer['transactionId']}'
              : res['message'] ?? 'Transfer sent.';
          _riskResult = null;
          _amountCtrl.clear();
          _recipientCtrl.clear();
          _descCtrl.clear();
        });
      } else {
        setState(() => _error = res['message'] ?? 'Transfer failed');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Network error');
    } finally {
      setState(() => _executing = false);
    }
  }

  Color _riskColor(String level) {
    switch (level.toLowerCase()) {
      case 'low risk':   return AppTheme.success;
      case 'medium risk': return AppTheme.warning;
      default:           return AppTheme.danger;
    }
  }

  @override
  Widget build(BuildContext context) {
    final assessment = _riskResult?['assessment'] as Map<String, dynamic>? ?? {};
    final decision = assessment['decision'] ?? _riskResult?['decision'];
    final blocked = decision == 'BLOCK';
    final needsReview = decision == 'REVIEW';
    return Scaffold(
      appBar: AppBar(title: const Text('Send Money')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_success != null)
              _banner(_success!, AppTheme.success, Icons.check_circle_outline),
            if (_error != null)
              _banner(_error!, AppTheme.danger, Icons.error_outline),
            TextField(
              controller: _recipientCtrl,
              keyboardType: TextInputType.emailAddress,
              style: const TextStyle(color: AppTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Recipient Email',
                prefixIcon: Icon(Icons.person_outline, color: AppTheme.textSecondary),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _amountCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: const TextStyle(color: AppTheme.textPrimary),
                    onChanged: (_) => setState(() => _riskResult = null),
                    decoration: const InputDecoration(
                      labelText: 'Amount',
                      prefixIcon: Icon(Icons.attach_money, color: AppTheme.textSecondary),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(child: _currencyPicker('From', _currency, (value) => setState(() { _currency = value; _riskResult = null; }))),
                const SizedBox(width: 12),
                Expanded(child: _currencyPicker('To', _destinationCurrency, (value) => setState(() { _destinationCurrency = value; _riskResult = null; }))),
              ],
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _descCtrl,
              style: const TextStyle(color: AppTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                prefixIcon: Icon(Icons.notes_outlined, color: AppTheme.textSecondary),
              ),
            ),
            const SizedBox(height: 24),
            // AI Risk Assessment result
            if (_riskResult != null) ...[
              _riskCard(_riskResult!),
              const SizedBox(height: 16),
              if (!blocked)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.send_rounded),
                    label: _executing
                        ? const SizedBox(height: 18, width: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Text('Confirm & Send'),
                    onPressed: _executing ? null : _send,
                  ),
                ),
              if (blocked)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                      color: AppTheme.danger.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(14)),
                  child: const Text(
                    'This transfer is blocked by the risk policy. No balance will be changed.',
                      style: TextStyle(color: AppTheme.danger),
                      textAlign: TextAlign.center),
                ),
              if (needsReview)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                      color: AppTheme.warning.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(14)),
                  child: const Text(
                    'If confirmed, this transfer will be held for analyst review.',
                    style: TextStyle(color: AppTheme.warning),
                    textAlign: TextAlign.center,
                  ),
                ),
            ] else
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: _screening
                      ? const SizedBox(height: 16, width: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: AppTheme.primary))
                      : const Icon(Icons.security_rounded,
                          color: AppTheme.primary),
                  label: const Text('AI Risk Check',
                      style: TextStyle(color: AppTheme.primary)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: const BorderSide(color: AppTheme.primary),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _screening ? null : _preScreen,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _riskCard(Map<String, dynamic> result) {
    final riskData = result['assessment'] as Map<String, dynamic>?
      ?? result['riskAssessment'] as Map<String, dynamic>?
        ?? result['fraud'] as Map<String, dynamic>?
        ?? {};
    final level = riskData['risk_level']?.toString() ?? riskData['riskLevel']?.toString() ?? 'Unknown';
    final score = riskData['risk_score']?.toString() ?? riskData['riskScore']?.toString() ?? '—';
    final factors = (riskData['risk_factors'] as List<dynamic>? ?? riskData['riskFactors'] as List<dynamic>? ?? [])
        .map((f) => f.toString())
        .toList();
    final color = _riskColor(level);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.psychology_alt_rounded, color: color, size: 20),
              const SizedBox(width: 8),
              Text('AI Risk Assessment',
                  style: TextStyle(
                      color: color, fontWeight: FontWeight.w700, fontSize: 14)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                    color: color.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20)),
                child: Text('Score: $score',
                    style: TextStyle(
                        color: color, fontWeight: FontWeight.w600, fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(level,
              style: TextStyle(
                  color: color, fontWeight: FontWeight.w800, fontSize: 18)),
          Text(
            'Decision: ${riskData['decision'] ?? riskData['recommendation'] ?? 'UNKNOWN'} · ${_scoringModeLabel(riskData['scoring_mode'])}',
            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
          ),
          if (factors.isNotEmpty) ...[
            const SizedBox(height: 10),
            ...factors.map((f) => Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.circle, size: 6, color: color),
                      const SizedBox(width: 8),
                      Expanded(
                          child: Text(f,
                              style: TextStyle(
                                  color: AppTheme.textSecondary, fontSize: 12))),
                    ],
                  ),
                )),
          ],
        ],
      ),
    );
  }

  Widget _currencyPicker(String label, String value, ValueChanged<String> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
        DropdownButton<String>(
          value: value,
          isExpanded: true,
          dropdownColor: AppTheme.card,
          items: AppConstants.supportedCurrencies.map((currency) => DropdownMenuItem(
            value: currency,
            child: Text(currency, style: const TextStyle(color: AppTheme.textPrimary)),
          )).toList(),
          onChanged: (next) { if (next != null) onChanged(next); },
        ),
      ],
    );
  }

  Widget _banner(String msg, Color color, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3))),
      child: Row(children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(msg, style: TextStyle(color: color, fontSize: 13))),
      ]),
    );
  }
}
