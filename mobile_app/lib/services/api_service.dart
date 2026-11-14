import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/constants.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final _storage = const FlutterSecureStorage();
  final String _base = AppConstants.baseUrl;

  Future<String?> get _token async => await _storage.read(key: 'jwt_token');

  Future<Map<String, String>> get _authHeaders async {
    final token = await _token;
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<void> saveToken(String token) =>
      _storage.write(key: 'jwt_token', value: token);

  Future<void> clearToken() => _storage.delete(key: 'jwt_token');

  Future<bool> get hasToken async => (await _token) != null;

  // ── Auth ──────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> register(Map<String, dynamic> body) =>
      _post('/auth/register', body, auth: false);

  Future<Map<String, dynamic>> login(String email, String password) =>
      _post('/auth/login', {'email': email, 'password': password}, auth: false);

  Future<Map<String, dynamic>> getProfile() => _get('/auth/profile');

  Future<Map<String, dynamic>> getKycStatus() => _get('/auth/kyc/status');

  Future<Map<String, dynamic>> submitKyc(String docType, String docNumber) =>
      _post('/auth/kyc/verify', {
        'documentType': docType,
        'documentNumber': docNumber,
      });

  Future<void> logout() async {
    await _post('/auth/logout', {});
    await clearToken();
  }

  // ── Wallet ────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getWallet() => _get('/wallet');

  Future<Map<String, dynamic>> getFundingSources() => _get('/funding/sources');

  Future<Map<String, dynamic>> getFundingProviders(String country) =>
      _get('/funding/providers?country=${Uri.encodeQueryComponent(country)}',
          auth: false);

  Future<Map<String, dynamic>> setDefaultCurrency(String currency) =>
      _post('/wallet/default-currency', {'currency': currency});

  // ── Exchange Rates ────────────────────────────────────────────────
  Future<Map<String, dynamic>> getRates() => _get('/rates');

  Future<Map<String, dynamic>> requestQuote(
          String from, String to, double amount) =>
      _post('/rates/quote', {
        'sourceCurrency': from,
        'destinationCurrency': to,
        'amount': amount,
      });

  // ── Conversions ───────────────────────────────────────────────────
  Future<Map<String, dynamic>> previewConversion(
          String from, String to, double amount) =>
      _post('/conversions/preview', {
        'sourceCurrency': from,
        'destinationCurrency': to,
        'amount': amount,
      });

  Future<Map<String, dynamic>> executeConversion(
      String from, String to, double amount, {String? quoteId}) =>
      _post('/conversions/execute', {
        'sourceCurrency': from,
        'destinationCurrency': to,
        'amount': amount,
        if (quoteId != null) 'quoteId': quoteId,
      });

  // ── Transfers ─────────────────────────────────────────────────────
  Future<Map<String, dynamic>> preScreenTransfer(Map<String, dynamic> body) =>
      _post('/transfers/pre-screen', body);

  Future<Map<String, dynamic>> executeTransfer(Map<String, dynamic> body) =>
      _post('/transfers/execute', body);

  // ── Transactions ──────────────────────────────────────────────────
    Future<Map<String, dynamic>> getTransactions({int limit = 20, int page = 1}) =>
      _get('/transactions?limit=$limit&page=$page');

  // ── Fraud ─────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getUserFraudAlerts() =>
      _get('/fraud/my-alerts');

  Future<Map<String, dynamic>> getFraudExplanation() =>
      _get('/fraud/explain');

  // ── HTTP Helpers ──────────────────────────────────────────────────
  Future<Map<String, dynamic>> _get(String path, {bool auth = true}) async {
    final headers = auth
        ? await _authHeaders
        : {'Content-Type': 'application/json'};
    final response = await http.get(
      Uri.parse('$_base$path'),
      headers: headers,
    );
    return _parse(response);
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body,
      {bool auth = true}) async {
    final headers = auth
        ? await _authHeaders
        : {'Content-Type': 'application/json'};
    final response = await http.post(
      Uri.parse('$_base$path'),
      headers: headers,
      body: jsonEncode(body),
    );
    return _parse(response);
  }

  Map<String, dynamic> _parse(http.Response response) {
    try {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode >= 400) {
        throw ApiException(
          data['message'] ?? 'Request failed',
          response.statusCode,
        );
      }
      return data;
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Unable to parse server response', response.statusCode);
    }
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  const ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}
