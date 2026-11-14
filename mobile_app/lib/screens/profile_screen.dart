import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_theme.dart';
import 'login_screen.dart';
import 'kyc_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _kycData;

  @override
  void initState() { super.initState(); _loadKyc(); }

  Future<void> _loadKyc() async {
    try {
      final res = await _api.getKycStatus();
      if (res['success'] == true) setState(() => _kycData = res['kyc'] as Map<String, dynamic>?);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Profile',
                  style: TextStyle(color: AppTheme.textPrimary,
                      fontSize: 22, fontWeight: FontWeight.w700)),
              const SizedBox(height: 24),
              // Avatar + name
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 80, height: 80,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                            colors: [AppTheme.primary, AppTheme.secondary]),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          (user?.name.isNotEmpty == true)
                              ? user!.name[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                              color: Colors.white, fontSize: 32,
                              fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(user?.name ?? '—',
                        style: const TextStyle(
                            color: AppTheme.textPrimary,
                            fontSize: 20, fontWeight: FontWeight.w700)),
                    Text(user?.email ?? '—',
                        style: const TextStyle(
                            color: AppTheme.textSecondary, fontSize: 13)),
                    const SizedBox(height: 8),
                    _kycBadge(),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              // Info tiles
              _infoCard([
                _infoRow(Icons.flag_outlined, 'Country', user?.country ?? '—'),
                _infoRow(Icons.phone_outlined, 'Phone', user?.phone ?? '—'),
                _infoRow(Icons.shield_outlined, 'KYC Tier', 'Tier ${_kycData?['tier'] ?? user?.kycTier ?? 1}'),
                _infoRow(Icons.attach_money_rounded, 'Daily Limit',
                    '\$${NumberFormat('#,##0.00').format(_kycData?['dailyLimitUsd'] ?? user?.dailyLimitUsd ?? 1500)}'),
              ]),
              const SizedBox(height: 20),
              // KYC card
              if (user?.kycStatus != 'VERIFIED') ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppTheme.warning.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.warning.withOpacity(0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(children: [
                        Icon(Icons.verified_user_outlined,
                            color: AppTheme.warning, size: 18),
                        SizedBox(width: 8),
                        Text('Identity Verification',
                            style: TextStyle(color: AppTheme.warning,
                                fontWeight: FontWeight.w600)),
                      ]),
                      const SizedBox(height: 8),
                      const Text(
                          'Verify your identity to increase your daily transfer limit to \$5,000 USD.',
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.warning,
                              foregroundColor: Colors.black),
                          onPressed: () =>
                              Navigator.push(context, MaterialPageRoute(
                                  builder: (_) => const KycScreen()))
                              .then((_) { _loadKyc(); auth.refreshProfile(); }),
                          child: const Text('Verify Now'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],
              // Sign out
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.logout_rounded, color: AppTheme.danger),
                  label: const Text('Sign Out',
                      style: TextStyle(color: AppTheme.danger)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: AppTheme.danger),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () async {
                    await auth.logout();
                    if (mounted) {
                      Navigator.pushAndRemoveUntil(
                          context,
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                          (_) => false);
                    }
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _kycBadge() {
    final isVerified = _kycData?['status'] == 'VERIFIED';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: isVerified
            ? AppTheme.success.withOpacity(0.1)
            : AppTheme.warning.withOpacity(0.1),
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
          const SizedBox(width: 5),
          Text(isVerified ? 'KYC Verified' : 'KYC Pending',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isVerified ? AppTheme.success : AppTheme.warning)),
        ],
      ),
    );
  }

  Widget _infoCard(List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: AppTheme.card, borderRadius: BorderRadius.circular(18)),
      child: Column(children: children),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(children: [
        Icon(icon, color: AppTheme.primary, size: 18),
        const SizedBox(width: 14),
        Text(label,
            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
        const Spacer(),
        Text(value,
            style: const TextStyle(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w600, fontSize: 14)),
      ]),
    );
  }
}
