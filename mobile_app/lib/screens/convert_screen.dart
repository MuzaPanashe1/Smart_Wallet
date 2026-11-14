import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../utils/app_theme.dart';
import '../utils/constants.dart';

class ConvertScreen extends StatefulWidget {
  const ConvertScreen({super.key});
  @override
  State<ConvertScreen> createState() => _ConvertScreenState();
}

class _ConvertScreenState extends State<ConvertScreen> {
  final _api = ApiService();
  final _amountCtrl = TextEditingController();
  String _from = 'USD';
  String _to = 'ZAR';
  bool _executing = false;
  Map<String, dynamic>? _preview;
  String? _error;
  String? _success;

  Future<void> _execute() async {
    final amount = double.tryParse(_amountCtrl.text);
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a valid amount');
      return;
    }
    if (_from == _to) {
      setState(() => _error = 'Source and destination currencies must differ');
      return;
    }
    setState(() {
      _executing = true;
      _error = null;
      _success = null;
    });
    try {
      final quoteResponse = await _api.requestQuote(_from, _to, amount);
      if (quoteResponse['success'] != true) {
        throw ApiException(quoteResponse['message'] ?? 'Could not retrieve a conversion rate', 400);
      }
      final quote = quoteResponse['quote'] as Map<String, dynamic>?;
      if (quote == null || quote['quoteId'] == null) {
        throw const ApiException('The rate service returned an invalid quote', 502);
      }
      setState(() => _preview = quote);
      final res = await _api.executeConversion(
        _from,
        _to,
        amount,
        quoteId: quote['quoteId'].toString(),
      );
      if (res['success'] == true) {
        setState(() {
          _success = res['message'] ?? 'Conversion successful!';
        });
      } else {
        setState(() => _error = res['message'] ?? 'Conversion failed');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Network error');
    } finally {
      setState(() {
        _executing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.0000');
    return Scaffold(
      appBar: AppBar(title: const Text('Convert Currency')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_success != null)
              _banner(_success!, AppTheme.success, Icons.check_circle_outline),
            if (_error != null)
              _banner(_error!, AppTheme.danger, Icons.error_outline),
            // From / To row
            Row(
              children: [
                Expanded(child: _currencyPicker('From', _from,
                    (v) => setState(() { _from = v; _preview = null; }))),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: GestureDetector(
                    onTap: () => setState(() {
                      final tmp = _from; _from = _to; _to = tmp; _preview = null;
                    }),
                    child: Container(
                      width: 40, height: 40,
                      decoration: BoxDecoration(
                          color: AppTheme.primary.withOpacity(0.15),
                          shape: BoxShape.circle),
                      child: const Icon(Icons.swap_horiz_rounded,
                          color: AppTheme.primary, size: 20),
                    ),
                  ),
                ),
                Expanded(child: _currencyPicker('To', _to,
                    (v) => setState(() { _to = v; _preview = null; }))),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 18),
              onChanged: (_) => setState(() {
                _preview = null;
                _success = null;
                _error = null;
              }),
              decoration: InputDecoration(
                labelText: 'Amount in $_from',
                prefixIcon: const Icon(Icons.attach_money, color: AppTheme.textSecondary),
              ),
            ),
            const SizedBox(height: 20),
            // Preview card
            if (_preview != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Conversion Result',
                        style: TextStyle(color: AppTheme.primary,
                            fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 12),
                    _previewRow('Rate',
                      '1 $_from = ${fmt.format(_preview!['effectiveRate'] ?? _preview!['exchangeRate'] ?? _preview!['rate'] ?? 0)} $_to'),
                    _previewRow('Margin',
                      '${((_preview!['marginPercent'] ?? 0) * 100).toStringAsFixed(2)}%'),
                    _previewRow('You Pay',
                      '${fmt.format(_preview!['sourceAmount'] ?? _preview!['fromAmount'] ?? 0)} $_from'),
                    _previewRow('You Receive',
                        '${fmt.format(_preview!['toAmount'] ?? _preview!['convertedAmount'] ?? 0)} $_to'),
                    _previewRow('Fee',
                      '${fmt.format(_preview!['feeAmount'] ?? 0)} ${_preview!['feeCurrency'] ?? _to}'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.swap_horiz_rounded),
                  label: _executing
                      ? const SizedBox(height: 18, width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('Convert $_from to $_to'),
                  onPressed: _executing ? null : _execute,
                ),
              ),
            ] else ...[
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: _executing
                      ? const SizedBox(height: 16, width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary))
                      : const Icon(Icons.swap_horiz_rounded, color: AppTheme.primary),
                  label: Text('Convert $_from to $_to', style: const TextStyle(color: AppTheme.primary)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: const BorderSide(color: AppTheme.primary),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _executing ? null : _execute,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _currencyPicker(String label, String value, ValueChanged<String> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
              color: AppTheme.card, borderRadius: BorderRadius.circular(12)),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              dropdownColor: AppTheme.card,
              isExpanded: true,
              icon: const Icon(Icons.arrow_drop_down, color: AppTheme.textSecondary),
              items: AppConstants.supportedCurrencies.map((c) => DropdownMenuItem(
                value: c,
                child: Text('${AppConstants.currencyFlags[c]} $c',
                    style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14)),
              )).toList(),
              onChanged: (v) => onChanged(v!),
            ),
          ),
        ),
      ],
    );
  }

  Widget _previewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          Text(value, style: const TextStyle(color: AppTheme.textPrimary,
              fontWeight: FontWeight.w600, fontSize: 13)),
        ],
      ),
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
