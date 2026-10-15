const { query } = require('../config/db');

/**
 * Initialize saas_plans and saas_bank_accounts tables in PostgreSQL
 */
const initBillingTables = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS saas_plans (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        duration_months INT NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'ETB',
        description TEXT,
        features JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        is_popular BOOLEAN DEFAULT FALSE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS saas_bank_accounts (
        id SERIAL PRIMARY KEY,
        bank_name VARCHAR(100) NOT NULL,
        bank_code VARCHAR(50) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        account_name VARCHAR(150) NOT NULL,
        branch VARCHAR(150),
        is_primary BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Check if saas_plans needs initial seed
    const plansCount = await query('SELECT COUNT(*) FROM saas_plans');
    if (parseInt(plansCount.rows[0].count, 10) === 0) {
      await query(`
        INSERT INTO saas_plans (id, name, duration_months, price, currency, description, features, is_active, is_popular, sort_order)
        VALUES 
        (
          'TERM',
          '1 Academic Term (Semester)',
          4,
          15000,
          'ETB',
          'Full access for 1 Semester (4 months) with unlimited students, courses, grades, and SMS/ChatHub.',
          '["Unlimited student & teacher enrollment", "Continuous assessment & report cards", "School-isolated ChatHub channels", "Daily attendance tracking"]'::jsonb,
          FALSE,
          FALSE,
          1
        ),
        (
          'ANNUAL',
          'Full Academic Year (12 Months)',
          12,
          35000,
          'ETB',
          'Best value: 1 Full Academic Year (12 months) with priority cloud storage and annual progression engine.',
          '["All Term Plan features included", "Grade progression & promotion engine (Grades 9-12)", "Natural & Social Science stream allocation", "Priority Cloudinary document storage", "Dedicated Super Admin onboarding support", "Save over 10,000 ETB compared to term-by-term"]'::jsonb,
          TRUE,
          TRUE,
          2
        ),
        (
          'ENTERPRISE',
          '2-Year Institutional License',
          24,
          60000,
          'ETB',
          'Long-term stability: 24 months of full access with custom branding and multi-year transcript archives.',
          '["Everything in the Annual Plan", "Custom school branding and domain support", "Multi-year historical student records archive", "Guaranteed pricing protection for 2 full years", "Direct WhatsApp & phone VIP technical support"]'::jsonb,
          FALSE,
          FALSE,
          3
        )
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('[Billing DB] Seeded initial saas_plans.');
    }

    // Check if saas_bank_accounts needs initial seed (CBE, Awash, Abyssinia)
    const accountsCount = await query('SELECT COUNT(*) FROM saas_bank_accounts');
    if (parseInt(accountsCount.rows[0].count, 10) === 0) {
      await query(`
        INSERT INTO saas_bank_accounts (bank_name, bank_code, account_number, account_name, branch, is_primary, is_active, sort_order)
        VALUES 
        ('Commercial Bank of Ethiopia (CBE)', 'CBE', '1000293847561', 'EthioHighHub SaaS Cloud Technologies', 'Finfinne Branch', TRUE, TRUE, 1),
        ('Awash Bank', 'AWASH', '01320491827300', 'EthioHighHub SaaS Cloud Technologies', 'Bole Medhanialem Branch', FALSE, TRUE, 2),
        ('Bank of Abyssinia (BoA)', 'ABYSSINIA', '192837465', 'EthioHighHub SaaS Cloud Technologies', 'Main Branch', FALSE, TRUE, 3)
      `);
      console.log('[Billing DB] Seeded initial saas_bank_accounts.');
    }
  } catch (err) {
    console.error('[Billing DB] Initialization warning:', err.message);
  }
};

/**
 * Get active plans for school administrators
 */
const getActivePlans = async () => {
  await initBillingTables();
  const res = await query(
    'SELECT * FROM saas_plans WHERE is_active = TRUE ORDER BY sort_order ASC, price ASC'
  );
  return res.rows.map((row) => ({
    id: row.id,
    name: row.name,
    durationMonths: row.duration_months,
    price: parseFloat(row.price),
    currency: row.currency || 'ETB',
    description: row.description,
    features: Array.isArray(row.features) ? row.features : [],
    isPopular: row.is_popular,
    isActive: row.is_active,
  }));
};

/**
 * Get all plans for Super Admin governance
 */
const getAllPlans = async () => {
  await initBillingTables();
  const res = await query('SELECT * FROM saas_plans ORDER BY sort_order ASC, price ASC');
  return res.rows.map((row) => ({
    id: row.id,
    name: row.name,
    durationMonths: row.duration_months,
    price: parseFloat(row.price),
    currency: row.currency || 'ETB',
    description: row.description,
    features: Array.isArray(row.features) ? row.features : [],
    isPopular: row.is_popular,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }));
};

/**
 * Super Admin: Create or update a SaaS plan
 */
const upsertPlan = async (planData) => {
  await initBillingTables();
  const {
    id,
    name,
    durationMonths = 12,
    price,
    currency = 'ETB',
    description = '',
    features = [],
    isActive = true,
    isPopular = false,
  } = planData;

  const res = await query(
    `INSERT INTO saas_plans (id, name, duration_months, price, currency, description, features, is_active, is_popular, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       duration_months = EXCLUDED.duration_months,
       price = EXCLUDED.price,
       currency = EXCLUDED.currency,
       description = EXCLUDED.description,
       features = EXCLUDED.features,
       is_active = EXCLUDED.is_active,
       is_popular = EXCLUDED.is_popular,
       updated_at = NOW()
     RETURNING *`,
    [
      id.toUpperCase().trim(),
      name,
      parseInt(durationMonths, 10),
      parseFloat(price),
      currency,
      description,
      JSON.stringify(features),
      isActive,
      isPopular,
    ]
  );
  return res.rows[0];
};

/**
 * Super Admin: Toggle plan active state
 */
const togglePlanStatus = async (planId, isActive) => {
  await initBillingTables();
  const res = await query(
    'UPDATE saas_plans SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [isActive, planId]
  );
  return res.rows[0];
};

/**
 * Get active bank accounts for school administrators
 */
const getActiveBankAccounts = async () => {
  await initBillingTables();
  const res = await query(
    'SELECT * FROM saas_bank_accounts WHERE is_active = TRUE ORDER BY is_primary DESC, sort_order ASC, id ASC'
  );
  return res.rows.map((row) => ({
    id: row.id,
    bank: row.bank_name,
    code: row.bank_code,
    accountNumber: row.account_number,
    accountName: row.account_name,
    branch: row.branch,
    isPrimary: row.is_primary,
    isActive: row.is_active,
  }));
};

/**
 * Get all bank accounts for Super Admin governance
 */
const getAllBankAccounts = async () => {
  await initBillingTables();
  const res = await query(
    'SELECT * FROM saas_bank_accounts ORDER BY is_primary DESC, sort_order ASC, id ASC'
  );
  return res.rows.map((row) => ({
    id: row.id,
    bank: row.bank_name,
    code: row.bank_code,
    accountNumber: row.account_number,
    accountName: row.account_name,
    branch: row.branch,
    isPrimary: row.is_primary,
    isActive: row.is_active,
  }));
};

/**
 * Super Admin: Add a new bank account
 */
const createBankAccount = async (data) => {
  await initBillingTables();
  const { bankName, bankCode, accountNumber, accountName, branch, isPrimary = false, isActive = true } = data;
  if (isPrimary) {
    await query('UPDATE saas_bank_accounts SET is_primary = FALSE');
  }
  const res = await query(
    `INSERT INTO saas_bank_accounts (bank_name, bank_code, account_number, account_name, branch, is_primary, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
    [bankName, bankCode || bankName.substring(0, 5).toUpperCase(), accountNumber, accountName, branch, isPrimary, isActive]
  );
  return res.rows[0];
};

/**
 * Super Admin: Update a bank account
 */
const updateBankAccount = async (id, data) => {
  await initBillingTables();
  const { bankName, bankCode, accountNumber, accountName, branch, isPrimary, isActive } = data;
  if (isPrimary) {
    await query('UPDATE saas_bank_accounts SET is_primary = FALSE WHERE id != $1', [id]);
  }
  const res = await query(
    `UPDATE saas_bank_accounts
     SET bank_name = COALESCE($1, bank_name),
         bank_code = COALESCE($2, bank_code),
         account_number = COALESCE($3, account_number),
         account_name = COALESCE($4, account_name),
         branch = COALESCE($5, branch),
         is_primary = COALESCE($6, is_primary),
         is_active = COALESCE($7, is_active),
         updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [bankName, bankCode, accountNumber, accountName, branch, isPrimary, isActive, id]
  );
  return res.rows[0];
};

/**
 * Super Admin: Toggle bank account active status
 */
const toggleBankAccountStatus = async (id, isActive) => {
  await initBillingTables();
  const res = await query(
    'UPDATE saas_bank_accounts SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [isActive, id]
  );
  return res.rows[0];
};

/**
 * Super Admin: Delete a SaaS plan
 */
const deletePlan = async (id) => {
  await initBillingTables();
  await query('DELETE FROM saas_plans WHERE id = $1', [id]);
  return true;
};

/**
 * Super Admin: Publish selected plans batch (only selected plans become active)
 */
const publishSelectedPlans = async (planIds = []) => {
  await initBillingTables();
  // Ensure array of strings
  const ids = Array.isArray(planIds) ? planIds : [planIds];
  await query('UPDATE saas_plans SET is_active = (id = ANY($1::varchar[])), updated_at = NOW()', [ids]);
  return await getAllPlans();
};

/**
 * Super Admin: Publish selected bank accounts batch (only selected banks become active)
 */
const publishSelectedBanks = async (bankIds = []) => {
  await initBillingTables();
  const ids = (Array.isArray(bankIds) ? bankIds : [bankIds]).map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
  await query('UPDATE saas_bank_accounts SET is_active = (id = ANY($1::int[])), updated_at = NOW()', [ids]);
  return await getAllBankAccounts();
};

/**
 * Super Admin: Delete bank account
 */
const deleteBankAccount = async (id) => {
  await initBillingTables();
  await query('DELETE FROM saas_bank_accounts WHERE id = $1', [id]);
  return true;
};


module.exports = {
  initBillingTables,
  getActivePlans,
  getAllPlans,
  upsertPlan,
  togglePlanStatus,
  deletePlan,
  publishSelectedPlans,
  getActiveBankAccounts,
  getAllBankAccounts,
  createBankAccount,
  updateBankAccount,
  toggleBankAccountStatus,
  deleteBankAccount,
  publishSelectedBanks,
};

