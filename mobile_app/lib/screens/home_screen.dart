import 'package:flutter/material.dart';
import '../utils/app_theme.dart';
import 'wallet_screen.dart';
import 'exchange_screen.dart';
import 'transactions_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _idx = 0;
  int _walletRevision = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      WalletScreen(key: ValueKey(_walletRevision)),
      const ExchangeScreen(),
      const TransactionsScreen(),
      const ProfileScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: _idx, children: screens),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppTheme.surface,
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.07))),
        ),
        child: NavigationBar(
          backgroundColor: AppTheme.surface,
          selectedIndex: _idx,
          onDestinationSelected: (i) => setState(() {
            _idx = i;
            if (i == 0) _walletRevision++;
          }),
          indicatorColor: AppTheme.primary.withOpacity(0.15),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: const [
            NavigationDestination(
                icon: Icon(Icons.account_balance_wallet_outlined),
                selectedIcon: Icon(Icons.account_balance_wallet, color: AppTheme.primary),
                label: 'Wallet'),
            NavigationDestination(
                icon: Icon(Icons.currency_exchange_outlined),
                selectedIcon: Icon(Icons.currency_exchange, color: AppTheme.primary),
                label: 'Exchange'),
            NavigationDestination(
                icon: Icon(Icons.receipt_long_outlined),
                selectedIcon: Icon(Icons.receipt_long, color: AppTheme.primary),
                label: 'History'),
            NavigationDestination(
                icon: Icon(Icons.person_outline),
                selectedIcon: Icon(Icons.person, color: AppTheme.primary),
                label: 'Profile'),
          ],
        ),
      ),
    );
  }
}
