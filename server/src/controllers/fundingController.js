const { LinkedAccount } = require('../models');
const {
  COUNTRY_NAMES,
  getProvidersForCountry,
  getProvider,
  normalizeCountry
} = require('../config/providers');

const maskAccountNumber = (accountNumber) => `••${String(accountNumber).slice(-4)}`;

const getFundingProviders = (req, res) => {
  const country = normalizeCountry(req.query.country);
  const providers = getProvidersForCountry(country);
  if (!providers) {
    return res.status(400).json({
      success: false,
      message: `Country must be one of: ${Object.keys(COUNTRY_NAMES).join(', ')}`
    });
  }
  return res.status(200).json({
    success: true,
    country,
    countryName: COUNTRY_NAMES[country],
    providers
  });
};

const listFundingSources = async (req, res) => {
  try {
    const sources = await LinkedAccount.findAll({
      where: { user_id: req.user.id },
      attributes: [
        'id',
        'country',
        'provider',
        'account_number',
        'currency',
        'simulated_balance',
        'status',
        'created_at'
      ],
      order: [['created_at', 'ASC']]
    });
    return res.status(200).json({
      success: true,
      sources: sources.map((source) => ({
        id: source.id,
        country: source.country,
        countryName: COUNTRY_NAMES[source.country],
        provider: source.provider,
        providerName: getProvider(source.country, source.provider)?.label || source.provider,
        accountNumber: maskAccountNumber(source.account_number),
        currency: source.currency,
        simulatedBalance: Number(source.simulated_balance),
        status: source.status,
        createdAt: source.created_at
      }))
    });
  } catch (error) {
    console.error('[FundingController] Could not list linked accounts:', error.message);
    return res.status(500).json({ success: false, message: 'Could not retrieve linked accounts' });
  }
};

module.exports = { getFundingProviders, listFundingSources };
