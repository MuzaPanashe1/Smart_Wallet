const { sequelize } = require('../models');

const initDatabase = async () => {
  try {
    console.log('[DB Init] Authenticating and syncing database tables...');
    await sequelize.authenticate();
    console.log('[DB Init] Connection established successfully.');
    await sequelize.sync({ alter: true });
    console.log('[DB Init] All database tables successfully created/synchronized.');
  } catch (error) {
    console.error('[DB Init] Database initialization failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
