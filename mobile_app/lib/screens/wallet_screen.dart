import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/auth_provider.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../utils/app_theme.dart';
import '../utils/constants.dart';
import 'transfer_screen.dart';
import 'convert_screen.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});
  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final _api = ApiService();
  WalletModel? _wallet;
  Map<String, dynamic>? _fundingSource;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await _api.getWallet();
      final fundingRes = await _api.getFundingSources();
      if (res['success'] == true && res['wallet'] != null) {
        Map<String, dynamic>? activeSource;
        for (final item in fundingRes['sources'] as List<dynamic>? ?? []) {
          if (item is Map<String, dynamic> && item['status'] == 'ACTIVE') {
            activeSource = item;
            break;
          }
        }
        setState(() {
          _wallet = WalletModel.fromJson(res['wallet'] as Map<String, dynamic>);
          _fundingSource = activeSource;
        });
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final fmt = NumberFormat('#,##0.00');
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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Good ${_greeting()}!',
                                  style: const TextStyle(
                                      color: AppTheme.textSecondary, fontSize: 13)),
                              const SizedBox(height: 2),
                              Text(user?.name.split(' ').first ?? 'Traveller',
                                  style: const TextStyle(
                                      color: AppTheme.textPrimary,
                                      fontSize: 22,
                                      fontWeight: FontWeight.w700)),
                            ],
                          ),
                          _kycBadge(user?.kycStatus ?? 'TIER_1_PENDING'),
                        ],
                      ),
                      const SizedBox(height: 24),
                      // Main balance card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF166534), AppTheme.primary],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary.withOpacity(0.3),
                              blurRadius: 20, offset: const Offset(0, 8)),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Total Wallet',
                                style: TextStyle(color: Colors.white70, fontSize: 13)),
                            const SizedBox(height: 8),
                            Text(
                              _wallet == null
                                  ? '—'
                                  : '${fmt.format(_totalInDefaultCurrency())} ${_wallet!.defaultCurrency}',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 34,
                                  fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text('Total in ${_wallet?.defaultCurrency ?? 'USD'}',
                                style: const TextStyle(color: Colors.white70, fontSize: 12)),
                            const SizedBox(height: 20),
                            Row(
                              children: [
                                _actionBtn(Icons.send_rounded, 'Transfer',
                                    onTap: () => _navTo(const TransferScreen())),
                                const SizedBox(width: 12),
                                _actionBtn(Icons.swap_horiz_rounded, 'Convert',
                                    onTap: () => _navTo(const ConvertScreen())),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 28),
                      _fundingSourceCard(),
                      const SizedBox(height: 24),
                      const Text('Currency Balances',
                          style: TextStyle(
                              color: AppTheme.textPrimary,
                              fontSize: 17,
                              fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
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
              else if (_wallet != null)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, i) {
                        final b = _wallet!.balances[i];
                        return _balanceTile(b, fmt);
                      },
                      childCount: _wallet!.balances.length,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _balanceTile(BalanceModel b, NumberFormat fmt) {
    final isDefault = _wallet?.defaultCurrency == b.currency;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        color: isDefault
            ? AppTheme.primary.withOpacity(0.12)
            : AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isDefault
                ? AppTheme.primary.withOpacity(0.3)
                : Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
                color: AppTheme.surface, borderRadius: BorderRadius.circular(12)),
            child: Center(
              child: Text(AppConstants.currencyFlags[b.currency] ?? '💱',
                  style: const TextStyle(fontSize: 22)),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(b.currency,
                    style: const TextStyle(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15)),
                Text(AppConstants.currencyNames[b.currency] ?? '',
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
              ],
            ),
          ),
          Text(fmt.format(b.balance),
              style: const TextStyle(
                  color: AppTheme.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 16)),
        ],
      ),
    );
  }

  Widget _fundingSourceCard() {
    final source = _fundingSource;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.primary.withOpacity(0.25)),
      ),
      child: source == null
          ? const Text('Local account: Not linked',
              style: TextStyle(color: AppTheme.textSecondary))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Funded from: ${source['providerName']} ${source['accountNumber']} (${source['countryName']})',
                  style: const TextStyle(
                      color: AppTheme.textPrimary, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                Text(
                  'Status: ${source['status']} · Source balance: ${NumberFormat('#,##0.00').format(source['simulatedBalance'] ?? 0)} ${source['currency']}',
                  style: const TextStyle(
                      color: AppTheme.textSecondary, fontSize: 12),
                ),
              ],
            ),
    );
  }

  Widget _actionBtn(IconData icon, String label, {VoidCallback? onTap}) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(14)),
          child: Column(
            children: [
              Icon(icon, color: Colors.white, size: 22),
              const SizedBox(height: 4),
              Text(label,
                  style: const TextStyle(color: Colors.white, fontSize: 11)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _kycBadge(String status) {
    final isVerified = status == 'VERIFIED';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: isVerified
            ? AppTheme.success.withOpacity(0.12)
            : AppTheme.warning.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: isVerified
                ? AppTheme.success.withOpacity(0.3)
                : AppTheme.warning.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(isVerified ? Icons.verified_rounded : Icons.pending_outlined,
              size: 14,
              color: isVerified ? AppTheme.success : AppTheme.warning),
          const SizedBox(width: 4),
          Text(isVerified ? 'Verified' : 'Unverified',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isVerified ? AppTheme.success : AppTheme.warning)),
        ],
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  double _totalInDefaultCurrency() {
    if (_wallet == null) return 0;
    return _wallet!.totalBalanceInDefault;
  }

  void _navTo(Widget screen) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen))
        .then((_) => _load());
  }
}
