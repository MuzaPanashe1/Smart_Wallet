const {
  fetchLatestRates,
  getDirectRate,
  createRateQuote,
  SUPPORTED_CURRENCIES
} = require('../services/exchangeRateService');

/**
 * Returns latest rates matrix against USD and all supported cross-rates
 */
const getRates = async (req, res) => {
  try {
    const { rates, source, timestamp } = await fetchLatestRates();

    // Build cross rates grid
    const matrix = {};
    for (const from of SUPPORTED_CURRENCIES) {
      matrix[from] = {};
      for (const to of SUPPORTED_CURRENCIES) {
        if (from === to) {
          matrix[from][to] = 1.0;
        } else {
          const fromRate = rates[from];
          const toRate = rates[to];
          matrix[from][to] = parseFloat((toRate / fromRate).toFixed(4));
        }
      }
    }

    return res.status(200).json({
      success: true,
      baseCurrency: 'USD',
      supportedCurrencies: SUPPORTED_CURRENCIES,
      ratesVsUSD: rates,
      matrix,
      source,
      timestamp,
      lastUpdated: timestamp
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: 'Failed to retrieve exchange rates',
      error: error.message
    });
  }
};

/**
 * Get direct rate between two specific currencies
 */
const getPairRate = async (req, res) => {
  try {
    const { from, to } = req.params;
    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'Both from and to currencies are required' });
    }

    const rate = await getDirectRate(from, to);
    return res.status(200).json({
      success: true,
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: 'Failed to fetch pair rate',
      error: error.message
    });
  }
};

module.exports = {
  getRates,
  getPairRate,
  requestRateQuote: async (req, res) => {
    try {
      const { sourceCurrency, destinationCurrency, amount, marginPercent } = req.body;
      if (!sourceCurrency || !destinationCurrency || !amount) {
        return res.status(400).json({
          success: false,
          message: 'sourceCurrency, destinationCurrency, and amount are required'
        });
      }
      const quote = await createRateQuote(
        sourceCurrency,
        destinationCurrency,
        amount,
        marginPercent !== undefined ? parseFloat(marginPercent) : 0.005
      );
      return res.status(200).json({
        success: true,
        quote
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        message: 'Failed to create rate lock quote',
        error: error.message
      });
    }
  }
};
