class AppConstants {
  // Change this to your machine IP when running on a physical device
  // Use 10.0.2.2 for Android emulator (maps to host machine localhost)
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5055/api',
  );

  static const List<String> supportedCurrencies = [
    'USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP'
  ];

  static const Map<String, String> currencyFlags = {
    'USD': '🇺🇸',
    'GBP': '🇬🇧',
    'EUR': '🇪🇺',
    'ZAR': '🇿🇦',
    'ZMW': '🇿🇲',
    'ZWG': '🇿🇼',
    'BWP': '🇧🇼',
  };

  static const Map<String, String> currencyNames = {
    'USD': 'US Dollar',
    'GBP': 'British Pound',
    'EUR': 'Euro',
    'ZAR': 'South African Rand',
    'ZMW': 'Zambian Kwacha',
    'ZWG': 'Zimbabwe Gold',
    'BWP': 'Botswana Pula',
  };
}
