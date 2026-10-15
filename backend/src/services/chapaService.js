require('dotenv').config();

const CHAPA_API_URL = 'https://api.chapa.co/v1';

/**
 * Initialize a transaction with Chapa using native fetch
 * @param {Object} paymentData
 * @returns {Promise<Object>}
 */
const initializePayment = async ({
  amount,
  currency = 'ETB',
  email,
  firstName,
  lastName,
  phone,
  txRef,
  callbackUrl,
  returnUrl,
  customization,
}) => {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CHAPA_SECRET_KEY is not configured in environment variables.');
  }

  // Chapa strictly requires title <= 16 chars and only letters, numbers, hyphens, underscores, spaces, dots
  const cleanTitle = (customization?.title || 'School License')
    .replace(/[^a-zA-Z0-9\s._-]/g, '')
    .slice(0, 16)
    .trim() || 'School License';

  const cleanDescription = (customization?.description || 'License Renewal')
    .replace(/[^a-zA-Z0-9\s._-]/g, '')
    .slice(0, 50)
    .trim() || 'License Renewal';

  const payload = {
    amount: String(amount),
    currency: currency || 'ETB',
    email: email || 'admin@school.com',
    first_name: (firstName || 'School').replace(/[^a-zA-Z0-9]/g, '') || 'School',
    last_name: (lastName || 'Admin').replace(/[^a-zA-Z0-9]/g, '') || 'Admin',
    tx_ref: txRef,
    callback_url: callbackUrl || process.env.CHAPA_CALLBACK_URL,
    return_url: returnUrl || process.env.CHAPA_RETURN_URL,
    customization: {
      title: cleanTitle,
      description: cleanDescription,
    },
  };

  // Only pass phone_number if it is a valid format (e.g. 09... or +2519...)
  if (phone) {
    const cleanPhone = phone.replace(/\s+/g, '');
    if (/^(\+2519|09|2519)\d{8}$/.test(cleanPhone)) {
      payload.phone_number = cleanPhone;
    }
  }

  try {
    const response = await fetch(`${CHAPA_API_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data && data.status === 'success') {
      return {
        success: true,
        checkoutUrl: data.data.checkout_url,
        data: data.data,
      };
    } else {
      let formattedMsg = 'Chapa initialization failed.';
      if (typeof data?.message === 'object' && data.message !== null) {
        formattedMsg = Object.entries(data.message)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('; ');
      } else if (typeof data?.message === 'string') {
        formattedMsg = data.message;
      }
      throw new Error(formattedMsg);
    }
  } catch (error) {
    console.error('[Chapa Service] Initialization Error:', error.message);
    throw new Error(`Chapa payment initialization error: ${error.message}`);
  }
};

/**
 * Verify a completed transaction with Chapa API using native fetch
 * @param {string} txRef - Unique transaction reference
 * @returns {Promise<Object>}
 */
const verifyPayment = async (txRef) => {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CHAPA_SECRET_KEY is not configured in environment variables.');
  }

  try {
    const response = await fetch(`${CHAPA_API_URL}/transaction/verify/${txRef}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const data = await response.json();

    if (response.ok && data && data.status === 'success') {
      return {
        success: true,
        status: data.data?.status || 'success',
        reference: data.data?.reference,
        amount: data.data?.amount,
        currency: data.data?.currency,
        paymentMethod: data.data?.payment_method || 'chapa',
        raw: data.data,
      };
    } else {
      let formattedMsg = 'Verification returned non-success status';
      if (typeof data?.message === 'object' && data.message !== null) {
        formattedMsg = Object.entries(data.message)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('; ');
      } else if (typeof data?.message === 'string') {
        formattedMsg = data.message;
      }
      return {
        success: false,
        status: 'failed',
        message: formattedMsg,
      };
    }
  } catch (error) {
    console.error('[Chapa Service] Verification Error:', error.message);
    return {
      success: false,
      status: 'error',
      message: error.message,
    };
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
};
