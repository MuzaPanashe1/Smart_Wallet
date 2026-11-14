import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/app_theme.dart';

class KycScreen extends StatefulWidget {
  const KycScreen({super.key});
  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  final _api = ApiService();
  final _docNumberCtrl = TextEditingController();
  String _docType = 'National ID';
  bool _loading = false;
  String? _error;
  bool _done = false;

  final List<String> _docTypes = [
    'National ID', 'Passport', 'Driver License', 'Birth Certificate'
  ];

  Future<void> _submit() async {
    if (_docNumberCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Please enter your document number');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final res = await _api.submitKyc(_docType, _docNumberCtrl.text.trim());
      if (res['success'] == true) {
        setState(() => _done = true);
      } else {
        setState(() => _error = res['message'] ?? 'Verification failed');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Network error. Please try again.');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Identity Verification')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: _done ? _successView() : _formView(),
      ),
    );
  }

  Widget _successView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80, height: 80,
            decoration: BoxDecoration(
                color: AppTheme.success.withOpacity(0.12), shape: BoxShape.circle),
            child: const Icon(Icons.verified_rounded,
                color: AppTheme.success, size: 42),
          ),
          const SizedBox(height: 20),
          const Text('Demo KYC status updated',
              style: TextStyle(color: AppTheme.textPrimary,
                  fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text(
              'The prototype marked this submission as verified and raised its demo limit. No external identity verification was performed.',
              style: TextStyle(color: AppTheme.textSecondary),
              textAlign: TextAlign.center),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Back to Profile'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _formView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.primary.withOpacity(0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.primary.withOpacity(0.2)),
          ),
          child: const Row(
            children: [
              Icon(Icons.info_outline, color: AppTheme.primary, size: 18),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Demo KYC submission raises the prototype transfer limit from \$1,500 to \$5,000 USD. This is not a real identity check.',
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),
        if (_error != null)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
                color: AppTheme.danger.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.danger.withOpacity(0.3))),
            child: Text(_error!, style: const TextStyle(color: AppTheme.danger)),
          ),
        const Text('Document Type',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          decoration: BoxDecoration(
              color: AppTheme.card, borderRadius: BorderRadius.circular(14)),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _docType,
              dropdownColor: AppTheme.card,
              isExpanded: true,
              icon: const Icon(Icons.keyboard_arrow_down,
                  color: AppTheme.textSecondary),
              items: _docTypes.map((t) => DropdownMenuItem(
                value: t,
                child: Text(t,
                    style: const TextStyle(color: AppTheme.textPrimary)),
              )).toList(),
              onChanged: (v) => setState(() => _docType = v!),
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _docNumberCtrl,
          style: const TextStyle(color: AppTheme.textPrimary),
          decoration: const InputDecoration(
            labelText: 'Document Number',
            prefixIcon: Icon(Icons.badge_outlined, color: AppTheme.textSecondary),
            hintText: 'e.g. 63-123456-Z-78',
          ),
        ),
        const Spacer(),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            icon: const Icon(Icons.verified_user_rounded),
            label: _loading
                ? const SizedBox(height: 18, width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Submit Demo KYC'),
            onPressed: _loading ? null : _submit,
          ),
        ),
      ],
    );
  }
}
