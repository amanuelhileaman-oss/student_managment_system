const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/subscriptionController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public or general: view available subscription plans
router.get('/plans', getPlans);

// Chapa Webhook listener (called asynchronously by Chapa servers)
router.post('/chapa/webhook', handleChapaWebhook);

// Verification callback (can be called by frontend return page)
router.get('/verify/:txRef', verifySubscriptionPayment);

// School Admin endpoints: View own subscription and pay
router.get('/my-subscription', authenticateToken, requireRole(['admin', 'superadmin']), getSchoolSubscription);
router.post('/initialize', authenticateToken, requireRole(['admin']), initiateSubscriptionPayment);

// Super Admin analytics: All schools subscriptions and platform revenue
router.get('/superadmin/overview', authenticateToken, requireRole(['superadmin']), getAllSubscriptions);

// Super Admin Governance: Configure Pricing Plans & Official Bank Accounts
router.get('/superadmin/settings', authenticateToken, requireRole(['superadmin']), getBillingSettings);
router.post('/superadmin/plans', authenticateToken, requireRole(['superadmin']), savePlanSettings);
router.patch('/superadmin/plans/:id/toggle', authenticateToken, requireRole(['superadmin']), togglePlan);
router.delete('/superadmin/plans/:id', authenticateToken, requireRole(['superadmin']), removePlan);
router.post('/superadmin/publish-plans', authenticateToken, requireRole(['superadmin']), publishPlansBatch);
router.post('/superadmin/publish-banks', authenticateToken, requireRole(['superadmin']), publishBanksBatch);
router.post('/superadmin/bank-accounts', authenticateToken, requireRole(['superadmin']), addBankAccount);
router.put('/superadmin/bank-accounts/:id', authenticateToken, requireRole(['superadmin']), editBankAccount);
router.patch('/superadmin/bank-accounts/:id/toggle', authenticateToken, requireRole(['superadmin']), toggleBankAccount);
router.delete('/superadmin/bank-accounts/:id', authenticateToken, requireRole(['superadmin']), removeBankAccount);


module.exports = router;
