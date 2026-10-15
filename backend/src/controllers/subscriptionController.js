const { query } = require('../config/db');
const { initializePayment, verifyPayment } = require('../services/chapaService');
const { logAudit } = require('../services/auditService');
const billingSettingsService = require('../services/billingSettingsService');

// Fallback in-memory plans if database is initializing
const SUBSCRIPTION_PLANS = {
  TERM: {
    id: 'TERM',
    name: '1 Academic Term (Semester)',
    durationMonths: 4,
    price: 15000,
    currency: 'ETB',
    description: 'Full access for 1 Semester (4 months) with unlimited students, courses, grades, and SMS/ChatHub.',
    features: [
      'Unlimited student & teacher enrollment',
      'Continuous assessment & report cards',
      'School-isolated ChatHub channels',
      'Daily attendance tracking',
    ],
  },
  ANNUAL: {
    id: 'ANNUAL',
    name: 'Full Academic Year (12 Months)',
    durationMonths: 12,
    price: 35000,
    currency: 'ETB',
    isPopular: true,
    description: 'Best value: 1 Full Academic Year (12 months) with priority cloud storage and annual progression engine.',
    features: [
      'All Term Plan features included',
      'Grade progression & promotion engine (Grades 9-12)',
      'Natural & Social Science stream allocation',
      'Priority Cloudinary document storage',
      'Dedicated Super Admin onboarding support',
      'Save over 10,000 ETB compared to term-by-term',
    ],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: '2-Year Institutional License',
    durationMonths: 24,
    price: 60000,
    currency: 'ETB',
    description: 'Long-term stability: 24 months of full access with custom branding and multi-year transcript archives.',
    features: [
      'Everything in the Annual Plan',
      'Custom school branding and domain support',
      'Multi-year historical student records archive',
      'Guaranteed pricing protection for 2 full years',
      'Direct WhatsApp & phone VIP technical support',
    ],
  },
};

/**
 * Get available subscription plans and official bank receiving accounts
 * Dynamically queries ONLY what the Super Admin has configured and activated!
 */
const getPlans = async (req, res, next) => {
  try {
    const plans = await billingSettingsService.getActivePlans();
    const bankAccounts = await billingSettingsService.getActiveBankAccounts();
    res.json({
      success: true,
      data: plans || [],
      bankAccounts: bankAccounts || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription status and payment history for authenticated school
 */
const getSchoolSubscription = async (req, res, next) => {
  try {
    const schoolId = req.user.role === 'superadmin' ? req.query.schoolId || req.user.school_id : req.user.school_id;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'School ID is required.' });
    }

    const schoolRes = await query(
      `SELECT id, name, code, logo_url, subscription_status, subscription_plan,
              subscription_started_at, subscription_expires_at, is_active
       FROM schools
       WHERE id = $1`,
      [schoolId]
    );

    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const school = schoolRes.rows[0];

    // Compute remaining days
    let daysRemaining = 0;
    let isExpired = false;
    if (school.subscription_expires_at) {
      const now = new Date();
      const expiresAt = new Date(school.subscription_expires_at);
      const diffTime = expiresAt - now;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 0) {
        isExpired = true;
        daysRemaining = 0;
      }
    }

    // Fetch recent payments
    const paymentsRes = await query(
      `SELECT p.*, u.first_name as admin_first_name, u.last_name as admin_last_name
       FROM school_payments p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.school_id = $1
       ORDER BY p.created_at DESC LIMIT 20`,
      [schoolId]
    );

    res.json({
      success: true,
      data: {
        school: {
          ...school,
          daysRemaining,
          isExpired,
        },
        currentPlan: SUBSCRIPTION_PLANS[school.subscription_plan] || SUBSCRIPTION_PLANS.STANDARD || null,
        payments: paymentsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initiate Chapa checkout for subscription plan
 */
const initiateSubscriptionPayment = async (req, res, next) => {
  try {
    const { planId, returnUrl: customReturnUrl } = req.body;
    const schoolId = req.user.school_id;
    const userId = req.user.id;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'Only school administrators can renew subscriptions.' });
    }

    const activePlans = await billingSettingsService.getActivePlans();
    const plan = (activePlans && activePlans.length > 0)
      ? activePlans.find((p) => p.id === planId)
      : SUBSCRIPTION_PLANS[planId];

    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid or disabled subscription plan selected.' });
    }

    const schoolRes = await query('SELECT id, name, email, phone FROM schools WHERE id = $1', [schoolId]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School record not found.' });
    }
    const school = schoolRes.rows[0];

    // Generate unique transaction reference
    const txRef = `SCH-${schoolId}-${Date.now()}`;

    // Record pending transaction in database
    const insRes = await query(
      `INSERT INTO school_payments (school_id, user_id, plan_name, plan_duration_months, amount, currency, tx_ref, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
       RETURNING *`,
      [schoolId, userId, plan.id, plan.durationMonths, plan.price, plan.currency, txRef]
    );

    // Call Chapa API to initialize payment
    const chapaResult = await initializePayment({
      amount: plan.price,
      currency: plan.currency,
      email: req.user.email || school.email || 'admin@school.com',
      firstName: req.user.firstName || 'School',
      lastName: req.user.lastName || 'Admin',
      phone: school.phone || undefined,
      txRef,
      returnUrl: (() => {
        const base = customReturnUrl || process.env.CHAPA_RETURN_URL;
        const sep = base.includes('?') ? '&' : '?';
        return `${base}${sep}tx_ref=${txRef}`;
      })(),
      customization: {
        title: 'School License',
        description: `Plan: ${plan.id} License Renewal`,
      },
    });

    // Update payment record with checkout url
    await query('UPDATE school_payments SET checkout_url = $1 WHERE id = $2', [
      chapaResult.checkoutUrl,
      insRes.rows[0].id,
    ]);

    await logAudit({
      userId,
      action: 'PAYMENT_INITIATED',
      entityType: 'PAYMENT',
      entityId: insRes.rows[0].id,
      details: { schoolId, planId, amount: plan.price, txRef },
    });

    res.json({
      success: true,
      message: 'Payment initialized successfully. Redirecting to Chapa checkout...',
      checkoutUrl: chapaResult.checkoutUrl,
      txRef,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Chapa payment by transaction reference (Called when redirected back from Chapa)
 */
const verifySubscriptionPayment = async (req, res, next) => {
  try {
    const { txRef } = req.params;

    if (!txRef) {
      return res.status(400).json({ success: false, message: 'Transaction reference is required.' });
    }

    const payRes = await query('SELECT * FROM school_payments WHERE tx_ref = $1', [txRef]);
    if (payRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this transaction reference.' });
    }

    const payment = payRes.rows[0];

    // If already verified as SUCCESS, return current state
    if (payment.payment_status === 'SUCCESS') {
      const sRes = await query('SELECT id, name, subscription_status, subscription_plan, subscription_expires_at FROM schools WHERE id = $1', [payment.school_id]);
      return res.json({
        success: true,
        message: 'Payment was already verified and active.',
        payment,
        school: sRes.rows[0],
      });
    }

    // Call Chapa verification endpoint
    const verifyResult = await verifyPayment(txRef);

    if (verifyResult.success && (verifyResult.status === 'success' || verifyResult.status === 'completed')) {
      const durationMonths = payment.plan_duration_months || 12;

      // Update payment record
      await query(
        `UPDATE school_payments
         SET payment_status = 'SUCCESS',
             chapa_reference = $1,
             payment_method = $2,
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [verifyResult.reference || 'CHAPA-PAID', verifyResult.paymentMethod || 'chapa', payment.id]
      );

      // Extend school subscription
      const updateSchoolRes = await query(
        `UPDATE schools
         SET subscription_status = 'ACTIVE',
             subscription_plan = $1,
             subscription_expires_at = (
               CASE
                 WHEN subscription_expires_at IS NULL OR subscription_expires_at < NOW()
                 THEN NOW() + ($2 || ' month')::interval
                 ELSE subscription_expires_at + ($2 || ' month')::interval
               END
             ),
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, name, subscription_status, subscription_plan, subscription_expires_at`,
        [payment.plan_name, durationMonths, payment.school_id]
      );

      await logAudit({
        userId: payment.user_id || 0,
        action: 'PAYMENT_VERIFIED_SUCCESS',
        entityType: 'PAYMENT',
        entityId: payment.id,
        details: { txRef, amount: payment.amount, planName: payment.plan_name },
      });

      return res.json({
        success: true,
        message: 'Payment verified successfully! School subscription has been extended.',
        payment: {
          ...payment,
          payment_status: 'SUCCESS',
        },
        school: updateSchoolRes.rows[0],
      });
    } else {
      // Payment failed or not yet completed
      await query(
        "UPDATE school_payments SET payment_status = 'FAILED', updated_at = NOW() WHERE id = $1",
        [payment.id]
      );

      return res.status(400).json({
        success: false,
        message: verifyResult.message || 'Payment has not been completed or failed on Chapa.',
        payment: {
          ...payment,
          payment_status: 'FAILED',
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Chapa Webhook Listener (Asynchronous server-to-server callback)
 */
const handleChapaWebhook = async (req, res, next) => {
  try {
    const event = req.body;
    console.log('[Chapa Webhook] Received webhook payload:', event);

    const txRef = event.tx_ref || event.trx_ref || event.reference;

    if (!txRef) {
      return res.status(200).json({ received: true, note: 'No tx_ref in payload' });
    }

    const payRes = await query('SELECT * FROM school_payments WHERE tx_ref = $1', [txRef]);
    if (payRes.rows.length === 0) {
      console.warn('[Chapa Webhook] Unrecognized transaction reference:', txRef);
      return res.status(200).json({ received: true, note: 'Transaction not found locally' });
    }

    const payment = payRes.rows[0];

    if (payment.payment_status === 'SUCCESS') {
      return res.status(200).json({ received: true, note: 'Already processed' });
    }

    // Verify directly with Chapa API for 100% integrity
    const verifyResult = await verifyPayment(txRef);

    if (verifyResult.success && (verifyResult.status === 'success' || verifyResult.status === 'completed')) {
      const durationMonths = payment.plan_duration_months || 12;

      await query(
        `UPDATE school_payments
         SET payment_status = 'SUCCESS',
             chapa_reference = $1,
             payment_method = $2,
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [verifyResult.reference || 'CHAPA-WEBHOOK', verifyResult.paymentMethod || 'chapa', payment.id]
      );

      await query(
        `UPDATE schools
         SET subscription_status = 'ACTIVE',
             subscription_plan = $1,
             subscription_expires_at = (
               CASE
                 WHEN subscription_expires_at IS NULL OR subscription_expires_at < NOW()
                 THEN NOW() + ($2 || ' month')::interval
                 ELSE subscription_expires_at + ($2 || ' month')::interval
               END
             ),
             updated_at = NOW()
         WHERE id = $3`,
        [payment.plan_name, durationMonths, payment.school_id]
      );

      console.log(`[Chapa Webhook] Successfully renewed school ID ${payment.school_id} via webhook!`);
    } else {
      console.warn(`[Chapa Webhook] Verification returned status: ${verifyResult.status}`);
    }

    // Always return 200 to acknowledge Chapa webhook receipt
    res.status(200).json({ received: true, status: 'processed' });
  } catch (error) {
    console.error('[Chapa Webhook Error]:', error.message);
    res.status(200).json({ received: true, error: error.message });
  }
};

/**
 * Super Admin: Get all subscriptions & revenue analytics across all schools
 */
const getAllSubscriptions = async (req, res, next) => {
  try {
    // School subscription overview
    const schoolsRes = await query(`
      SELECT s.id, s.name, s.code, s.subscription_status, s.subscription_plan,
             s.subscription_started_at, s.subscription_expires_at, s.is_active,
             (SELECT COUNT(*) FROM students WHERE school_id = s.id) as student_count,
             (SELECT COUNT(*) FROM teachers WHERE school_id = s.id) as teacher_count,
             COALESCE((SELECT SUM(amount) FROM school_payments WHERE school_id = s.id AND payment_status = 'SUCCESS'), 0) as total_paid
      FROM schools s
      ORDER BY s.id ASC
    `);

    // Financial totals: strictly actual completed subscription payments from School Admins
    const totalRevRes = await query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) = 'chapa' OR tx_ref LIKE 'SCH-%' THEN amount ELSE 0 END), 0) as chapa_revenue,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) != 'chapa' AND tx_ref NOT LIKE 'SCH-%' THEN amount ELSE 0 END), 0) as bank_direct_revenue,
        COUNT(*) as total_successful_payments
      FROM school_payments 
      WHERE payment_status = 'SUCCESS'
    `);

    // Recent payments from school administrators
    const recentPaymentsRes = await query(`
      SELECT p.*, s.name as school_name, s.code as school_code,
             u.first_name as admin_first_name, u.last_name as admin_last_name
      FROM school_payments p
      JOIN schools s ON p.school_id = s.id
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC LIMIT 50
    `);

    res.json({
      success: true,
      data: {
        schools: schoolsRes.rows,
        metrics: {
          totalRevenue: parseFloat(totalRevRes.rows[0]?.total_revenue || 0),
          chapaRevenue: parseFloat(totalRevRes.rows[0]?.chapa_revenue || 0),
          bankDirectRevenue: parseFloat(totalRevRes.rows[0]?.bank_direct_revenue || 0),
          totalSuccessfulPayments: parseInt(totalRevRes.rows[0]?.total_successful_payments || 0, 10),
          totalSchools: schoolsRes.rows.length,
          activeSchools: schoolsRes.rows.filter(s => s.subscription_status === 'ACTIVE' && s.is_active).length,
        },
        payments: recentPaymentsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Get all billing settings (all plans & all bank accounts)
 */
const getBillingSettings = async (req, res, next) => {
  try {
    const plans = await billingSettingsService.getAllPlans();
    const bankAccounts = await billingSettingsService.getAllBankAccounts();
    res.json({
      success: true,
      data: {
        plans,
        bankAccounts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Upsert a plan (create/edit price, duration, popular)
 */
const savePlanSettings = async (req, res, next) => {
  try {
    const plan = await billingSettingsService.upsertPlan(req.body);
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_SAAS_PLAN',
      entityType: 'SUBSCRIPTION_PLAN',
      entityId: plan.id,
      details: req.body,
    });
    res.json({ success: true, message: `Plan "${plan.name}" updated successfully.`, data: plan });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Toggle plan active status
 */
const togglePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const updated = await billingSettingsService.togglePlanStatus(id, isActive);
    res.json({ success: true, message: `Plan ${id} is now ${isActive ? 'ACTIVE' : 'DISABLED'}.`, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Add bank account
 */
const addBankAccount = async (req, res, next) => {
  try {
    const account = await billingSettingsService.createBankAccount(req.body);
    res.json({ success: true, message: 'Bank account added successfully.', data: account });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Update bank account
 */
const editBankAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await billingSettingsService.updateBankAccount(id, req.body);
    res.json({ success: true, message: 'Bank account updated successfully.', data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Toggle bank account active status
 */
const toggleBankAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const updated = await billingSettingsService.toggleBankAccountStatus(id, isActive);
    res.json({ success: true, message: `Bank account status updated to ${isActive ? 'ACTIVE' : 'DISABLED'}.`, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Delete bank account
 */
const removeBankAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    await billingSettingsService.deleteBankAccount(id);
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_BANK_ACCOUNT',
      entityType: 'BANK_ACCOUNT',
      entityId: id,
    });
    res.json({ success: true, message: 'Bank account removed successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Delete a SaaS plan
 */
const removePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    await billingSettingsService.deletePlan(id);
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_SAAS_PLAN',
      entityType: 'SUBSCRIPTION_PLAN',
      entityId: id,
    });
    res.json({ success: true, message: `Plan ${id} deleted successfully.` });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Batch publish selected plans (sets only chosen plans active)
 */
const publishPlansBatch = async (req, res, next) => {
  try {
    const { planIds } = req.body;
    if (!Array.isArray(planIds)) {
      return res.status(400).json({ success: false, message: 'planIds must be an array of plan IDs.' });
    }
    const plans = await billingSettingsService.publishSelectedPlans(planIds);
    await logAudit({
      userId: req.user.id,
      action: 'BATCH_PUBLISH_PLANS',
      entityType: 'SUBSCRIPTION_PLANS',
      details: { publishedPlanIds: planIds },
    });
    res.json({
      success: true,
      message: `Successfully updated plan offerings! Exactly ${planIds.length} plan(s) are now active and visible to schools.`,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Batch publish selected bank accounts
 */
const publishBanksBatch = async (req, res, next) => {
  try {
    const { bankIds } = req.body;
    if (!Array.isArray(bankIds)) {
      return res.status(400).json({ success: false, message: 'bankIds must be an array of bank account IDs.' });
    }
    const bankAccounts = await billingSettingsService.publishSelectedBanks(bankIds);
    await logAudit({
      userId: req.user.id,
      action: 'BATCH_PUBLISH_BANKS',
      entityType: 'BANK_ACCOUNTS',
      details: { publishedBankIds: bankIds },
    });
    res.json({
      success: true,
      message: `Successfully updated official bank accounts! Exactly ${bankIds.length} bank(s) are now published to all schools.`,
      data: bankAccounts,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  SUBSCRIPTION_PLANS,
  getPlans,
  getSchoolSubscription,
  initiateSubscriptionPayment,
  verifySubscriptionPayment,
  handleChapaWebhook,
  getAllSubscriptions,
  getBillingSettings,
  savePlanSettings,
  togglePlan,
  removePlan,
  publishPlansBatch,
  publishBanksBatch,
  addBankAccount,
  editBankAccount,
  toggleBankAccount,
  removeBankAccount,
};

