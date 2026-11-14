import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../utils/app_theme.dart';
import '../utils/constants.dart';

class ExchangeScreen extends StatefulWidget {
  const ExchangeScreen({super.key});
  @override
  State<ExchangeScreen> createState() => _ExchangeScreenState();
}

class _ExchangeScreenState extends State<ExchangeScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _rates;
  bool _loading = true;
  String? _error;
  String _baseCurrency = 'USD';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.getRates();
      setState(() { _rates = res; _error = null; });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Unable to load exchange rates: $e');
    }
    finally { setState(() => _loading = false); }
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
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Exchange Rates',
                          style: TextStyle(color: AppTheme.textPrimary,
                              fontSize: 22, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                        Text('${_rateSourceLabel()} · Last updated: ${_rates?['lastUpdated'] ?? 'not yet updated'}',
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                      const SizedBox(height: 20),
                      // Base currency selector
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: AppConstants.supportedCurrencies.map((c) {
                            final selected = c == _baseCurrency;
                            return GestureDetector(
                              onTap: () => setState(() => _baseCurrency = c),
                              child: Container(
                                margin: const EdgeInsets.only(right: 8),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(
                                  color: selected
                                      ? AppTheme.primary
                                      : AppTheme.card,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  '${AppConstants.currencyFlags[c]} $c',
                                  style: TextStyle(
                                      color: selected
                                          ? Colors.white
                                          : AppTheme.textSecondary,
                                      fontWeight: selected
                                          ? FontWeight.w600
                                          : FontWeight.w400,
                                      fontSize: 13),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                      const SizedBox(height: 20),
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
              else if (_rates != null)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (ctx, i) {
                        final currencies = AppConstants.supportedCurrencies
                            .where((c) => c != _baseCurrency)
                            .toList();
                        final toCurrency = currencies[i];
                        final matrix = _rates!['matrix'] as Map<String, dynamic>? ?? {};
                        final baseRates = matrix[_baseCurrency] as Map<String, dynamic>? ?? {};
                        final rate = baseRates[toCurrency] ?? 0.0;
                        return _rateTile(_baseCurrency, toCurrency,
                            double.tryParse(rate.toString()) ?? 0.0);
                      },
                      childCount: AppConstants.supportedCurrencies.length - 1,
                    ),
                  ),
              if (_error != null)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(_error!,
                          style: const TextStyle(color: AppTheme.danger)),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _rateSourceLabel() {
    switch (_rates?['source']) {
      case 'exchange_rate_api':
        return 'Live ExchangeRate-API rates';
      case 'database_cache':
        return 'Last stored API rates';
      default:
        return 'Rate source unavailable';
    }
  }

  Widget _rateTile(String from, String to, double rate) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: AppTheme.card, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          _flagStack(from, to),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$from → $to',
                    style: const TextStyle(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                Text(AppConstants.currencyNames[to] ?? to,
                    style: const TextStyle(
                        color: AppTheme.textSecondary, fontSize: 12)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                rate == 0.0
                    ? '—'
                    : NumberFormat('#,##0.0000').format(rate),
                style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 15),
              ),
              Text('1 $from', style: const TextStyle(
                  color: AppTheme.textSecondary, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _flagStack(String from, String to) {
    return SizedBox(
      width: 52, height: 36,
      child: Stack(
        children: [
          Positioned(
            left: 0,
            child: Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                  color: AppTheme.surface,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.card, width: 2)),
              child: Center(
                  child: Text(AppConstants.currencyFlags[from] ?? '💱',
                      style: const TextStyle(fontSize: 18))),
            ),
          ),
          Positioned(
            right: 0,
            child: Container(
              width: 30, height: 30,
              decoration: BoxDecoration(
                  color: AppTheme.card,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.surface, width: 2)),
              child: Center(
                  child: Text(AppConstants.currencyFlags[to] ?? '💱',
                      style: const TextStyle(fontSize: 14))),
            ),
          ),
        ],
      ),
    );
  }
}
