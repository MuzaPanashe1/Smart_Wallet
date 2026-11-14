const bcrypt = require('bcryptjs');
const { sequelize, User, Wallet, WalletBalance } = require('../models');
const { SUPPORTED_CURRENCIES } = require('../services/exchangeRateService');

const seedDatabase = async () => {
  try {
    console.log('[Seed] Syncing database models...');
    await sequelize.sync({ force: true }); // Reset tables for fresh demo seed

    console.log('[Seed] Generating hashed passwords...');
    const salt = await bcrypt.genSalt(10);
    const userPasswordHash = await bcrypt.hash('Password123!', salt);
    const adminPasswordHash = await bcrypt.hash('AdminPassword123!', salt);

    // 1. Create Demo Users
    console.log('[Seed] Creating demo users...');
    const traveller = await User.create({
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Farai Moyo',
      email: 'traveller@example.com',
      password_hash: userPasswordHash,
      role: 'user',
      phone: '+263771234567',
      country: 'Zimbabwe'
    });

    await User.create({
      id: 'a0000000-0000-0000-0000-000000000002',
      name: 'Chipo Dube (Fraud Analyst)',
      email: 'admin@smartwallet.com',
      password_hash: adminPasswordHash,
      role: 'admin',
      phone: '+263779876543',
      country: 'Zimbabwe'
    });

    const recipient = await User.create({
      id: 'a0000000-0000-0000-0000-000000000003',
      name: 'Kabelo Phiri',
      email: 'recipient@example.com',
      password_hash: userPasswordHash,
      role: 'user',
      phone: '+26771234567',
      country: 'Botswana'
    });

    // 2. Create Wallets
    console.log('[Seed] Creating wallets...');
    const travellerWallet = await Wallet.create({
      id: 'b0000000-0000-0000-0000-000000000001',
      user_id: traveller.id,
      default_currency: 'USD'
    });

    const recipientWallet = await Wallet.create({
      id: 'b0000000-0000-0000-0000-000000000003',
      user_id: recipient.id,
      default_currency: 'BWP'
    });

    // 3. Create Multi-Currency Balances for Traveller and recipient with zeroed starting balances.
    console.log('[Seed] Initializing zeroed multi-currency balances...');
    const balances = SUPPORTED_CURRENCIES.map((currency) => ({
      currency,
      balance: 0.00
    }));

    for (const b of balances) {
      await WalletBalance.create({
        wallet_id: travellerWallet.id,
        currency: b.currency,
        balance: b.balance
      });
    }

    for (const b of balances) {
      await WalletBalance.create({
        wallet_id: recipientWallet.id,
        currency: b.currency,
        balance: b.balance
      });
    }

    console.log('[Seed] Zero-balance demo accounts created. Use the app to create real sandbox transactions.');
    console.log('----------------------------------------------------');
    console.log('DEMO ACCOUNTS READY FOR DEFENSE / TESTING:');
    console.log('1. Traveller User:');
    console.log('   Email: traveller@example.com');
    console.log('   Password: Password123!');
    console.log('   Initial balances: zeroed until wallet activity is recorded');
    console.log('');
    console.log('2. Admin / Fraud Reviewer:');
    console.log('   Email: admin@smartwallet.com');
    console.log('   Password: AdminPassword123!');
    console.log('   Role: admin (Full access to Fraud Review Dashboard)');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
