import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_theme.dart';
import '../utils/constants.dart';
import 'home_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl    = TextEditingController();
  final _emailCtrl   = TextEditingController();
  final _passCtrl    = TextEditingController();
  final _accountCtrl = TextEditingController();
  final _otpCtrl     = TextEditingController();
  static const _countries = {
    'ZW': 'Zimbabwe',
    'ZM': 'Zambia',
    'ZA': 'South Africa',
    'BW': 'Botswana',
    'GB': 'United Kingdom',
    'EU': 'European Union',
  };
  String _fundingCountry = 'ZW';
  String _provider = '';
  List<Map<String, dynamic>> _providers = [];
  String? _registrationError;
  String _currency = 'USD';
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _loadProviders(_fundingCountry);
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _emailCtrl.dispose();
    _passCtrl.dispose(); _accountCtrl.dispose(); _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProviders(String country) async {
    try {
      final response = await ApiService().getFundingProviders(country);
      if (!mounted) return;
      setState(() {
        _providers = (response['providers'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
        _provider = _providers.isEmpty ? '' : _providers.first['key'] as String;
      });
    } catch (error) {
      if (mounted) setState(() => _registrationError = error.toString());
    }
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final ok = await auth.register(
      _nameCtrl.text.trim(),
      _emailCtrl.text.trim(),
      _passCtrl.text,
      fundingCountry: _fundingCountry,
      provider: _provider,
      accountNumber: _accountCtrl.text.trim(),
      otp: _otpCtrl.text.trim(),
      defaultCurrency: _currency,
    );
    if (ok && mounted) {
      Navigator.pushAndRemoveUntil(context,
          MaterialPageRoute(builder: (_) => const HomeScreen()),
          (_) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Create Account')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Join Smart Wallet',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: AppTheme.textPrimary, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text('Open your free multi-currency travel wallet',
                  style: TextStyle(color: AppTheme.textSecondary)),
              const SizedBox(height: 28),
              if (auth.error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                      color: AppTheme.danger.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12)),
                  child: Text(auth.error!, style: TextStyle(color: AppTheme.danger)),
                ),
              if (_registrationError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Text(_registrationError!,
                      style: TextStyle(color: AppTheme.danger)),
                ),
              _field(_nameCtrl, 'Full Name', Icons.person_outline,
                  validator: (v) => (v == null || v.length < 2) ? 'Please enter your name' : null),
              const SizedBox(height: 14),
              _field(_emailCtrl, 'Email', Icons.email_outlined,
                  type: TextInputType.emailAddress,
                  validator: (v) =>
                      (v == null || !v.contains('@')) ? 'Enter a valid email' : null),
              const SizedBox(height: 14),
              _field(_passCtrl, 'Password', Icons.lock_outline,
                  obscure: _obscure,
                  suffix: IconButton(
                    icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility,
                        color: AppTheme.textSecondary, size: 20),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                  validator: (v) => (v == null || v.length < 8)
                      ? 'Password must be 8+ characters'
                      : null),
              const SizedBox(height: 14),
              const Text('Link your local account',
                  style: TextStyle(color: AppTheme.textPrimary,
                      fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              _dropdown<String>(
                label: 'Country',
                value: _fundingCountry,
                items: _countries.entries
                    .map((entry) => DropdownMenuItem(
                          value: entry.key,
                          child: Text(entry.value),
                        ))
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() {
                    _fundingCountry = value;
                    _provider = '';
                    _providers = [];
                    _accountCtrl.clear();
                    _otpCtrl.clear();
                  });
                  _loadProviders(value);
                },
              ),
              const SizedBox(height: 14),
              _dropdown<String>(
                label: 'Provider',
                value: _provider.isEmpty ? null : _provider,
                items: _providers.map((provider) => DropdownMenuItem(
                      value: provider['key'] as String,
                      child: Text(provider['label'] as String),
                    )).toList(),
                onChanged: (value) => setState(() {
                  _provider = value ?? '';
                  _accountCtrl.clear();
                  _otpCtrl.clear();
                }),
              ),
              if (_provider.isNotEmpty) ...[
                const SizedBox(height: 14),
                _field(_accountCtrl, 'Account number', Icons.account_balance_outlined,
                    type: TextInputType.text,
                    validator: (value) => (value == null || value.trim().length < 5)
                        ? 'Enter a valid account number'
                        : null,
                    onChanged: (_) => setState(() {})),
                if (_accountCtrl.text.trim().length >= 5) ...[
                  const SizedBox(height: 14),
                  _field(_otpCtrl, 'Mock OTP / approval code', Icons.verified_user_outlined,
                      type: TextInputType.number,
                      validator: (value) => (value == null || value.trim().isEmpty)
                          ? 'Enter the approval code'
                          : null),
                  const SizedBox(height: 4),
                  const Text('Demo approval code: 123456',
                      style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                ],
              ],
              const SizedBox(height: 14),
              // Currency picker
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(14)),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _currency,
                    dropdownColor: AppTheme.card,
                    isExpanded: true,
                    icon: const Icon(Icons.keyboard_arrow_down, color: AppTheme.textSecondary),
                    items: AppConstants.supportedCurrencies.map((c) {
                      return DropdownMenuItem(
                        value: c,
                        child: Text(
                            '${AppConstants.currencyFlags[c]} $c — ${AppConstants.currencyNames[c]}',
                            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14)),
                      );
                    }).toList(),
                    onChanged: (v) => setState(() => _currency = v!),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: auth.isLoading || _provider.isEmpty ? null : _register,
                  child: auth.isLoading
                      ? const SizedBox(height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Create Account'),
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: RichText(
                    text: const TextSpan(children: [
                      TextSpan(text: 'Already have an account? ',
                          style: TextStyle(color: AppTheme.textSecondary)),
                      TextSpan(text: 'Sign In',
                          style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w600)),
                    ]),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label, IconData icon,
      {bool obscure = false, Widget? suffix, TextInputType? type,
      String? Function(String?)? validator, void Function(String)? onChanged}) {
    return TextFormField(
      controller: c,
      obscureText: obscure,
      keyboardType: type,
      onChanged: onChanged,
      style: const TextStyle(color: AppTheme.textPrimary),
      decoration: InputDecoration(labelText: label,
          prefixIcon: Icon(icon, color: AppTheme.textSecondary, size: 20), suffixIcon: suffix),
      validator: validator,
    );
  }

  Widget _dropdown<T>({
    required String label,
    required T? value,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          hint: Text(label, style: const TextStyle(color: AppTheme.textSecondary)),
          dropdownColor: AppTheme.card,
          isExpanded: true,
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}
