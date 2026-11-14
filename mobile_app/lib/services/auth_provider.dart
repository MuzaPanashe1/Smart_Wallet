import 'package:flutter/foundation.dart';
import '../models/models.dart';
import 'api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  UserModel? _user;
  bool _isLoading = false;
  String? _error;
  bool _initialized = false;

  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isLoggedIn => _user != null;
  bool get initialized => _initialized;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    final hasToken = await _api.hasToken;
    if (hasToken) {
      try {
        final res = await _api.getProfile();
        if (res['success'] == true && res['user'] != null) {
          _user = UserModel.fromJson(res['user'] as Map<String, dynamic>);
        }
      } catch (_) {
        await _api.clearToken();
      }
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await _api.login(email, password);
      if (res['success'] == true) {
        await _api.saveToken(res['token'] as String);
        _user = UserModel.fromJson(res['user'] as Map<String, dynamic>);
        _isLoading = false;
        notifyListeners();
        return true;
      }
      throw ApiException(res['message'] ?? 'Login failed', 400);
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Network error. Please check your connection.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String name, String email, String password,
      {String fundingCountry = 'ZW',
      String provider = '',
      String accountNumber = '',
      String otp = '',
      String defaultCurrency = 'USD'}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await _api.register({
        'name': name,
        'email': email,
        'password': password,
        'country': fundingCountry,
        'defaultCurrency': defaultCurrency,
        'fundingSource': {
          'country': fundingCountry,
          'provider': provider,
          'accountNumber': accountNumber,
          'otp': otp,
        },
      });
      if (res['success'] == true) {
        await _api.saveToken(res['token'] as String);
        _user = UserModel.fromJson(res['user'] as Map<String, dynamic>);
        _isLoading = false;
        notifyListeners();
        return true;
      }
      throw ApiException(res['message'] ?? 'Registration failed', 400);
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Network error. Please check your connection.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> refreshProfile() async {
    try {
      final res = await _api.getProfile();
      if (res['success'] == true && res['user'] != null) {
        _user = UserModel.fromJson(res['user'] as Map<String, dynamic>);
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> logout() async {
    await _api.logout();
    _user = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
