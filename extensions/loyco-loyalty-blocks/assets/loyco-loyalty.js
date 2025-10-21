/**
 * Loyco Loyalty System - Global JavaScript
 * Provides shared functionality for all loyalty blocks
 */

(function() {
  'use strict';

  // Global Loyco namespace
  window.Loyco = window.Loyco || {};

  // Customer data cache
  let customerData = null;
  let programData = null;

  // Configuration
  const config = {
    appProxyPath: '/apps/loyco-rewards/api',
    shopDomain: window.Shopify?.shop || document.querySelector('meta[name="shop-domain"]')?.content,
    debug: false
  };

  /**
   * Initialize Loyco loyalty system
   */
  function init() {
    if (!config.shopDomain) {
      console.warn('Loyco: Shop domain not found');
      return;
    }

    loadProgramData();

    if (isCustomerLoggedIn()) {
      loadCustomerData();
    }

    // Set up event listeners
    document.addEventListener('loycoReload', handleReload);
    document.addEventListener('loycoCustomerUpdate', handleCustomerUpdate);
  }

  /**
   * Check if customer is logged in
   */
  function isCustomerLoggedIn() {
    return window.Shopify?.checkout?.customer_id ||
           document.querySelector('meta[name="customer-id"]')?.content ||
           document.body.classList.contains('customer-logged-in');
  }

  /**
   * Get current customer ID
   */
  function getCustomerId() {
    return window.Shopify?.checkout?.customer_id ||
           document.querySelector('meta[name="customer-id"]')?.content;
  }

  /**
   * Load loyalty program data
   */
  async function loadProgramData() {
    try {
      const response = await apiRequest('/program');
      programData = response;

      // Dispatch event
      document.dispatchEvent(new CustomEvent('loycoProgramLoaded', {
        detail: programData
      }));

      log('Program data loaded:', programData);
    } catch (error) {
      console.error('Failed to load program data:', error);
    }
  }

  /**
   * Load customer loyalty data
   */
  async function loadCustomerData() {
    const customerId = getCustomerId();
    if (!customerId) return;

    try {
      const response = await apiRequest(`/customer/${customerId}/status`);
      customerData = response;

      // Make available globally
      window.loycoCustomerData = customerData;

      // Dispatch event
      document.dispatchEvent(new CustomEvent('loycoCustomerLoaded', {
        detail: customerData
      }));

      log('Customer data loaded:', customerData);
    } catch (error) {
      console.error('Failed to load customer data:', error);
    }
  }

  /**
   * Make API request to loyalty system
   */
  async function apiRequest(endpoint, options = {}) {
    const url = `${config.appProxyPath}${endpoint}`;
    const params = new URLSearchParams({
      shop: config.shopDomain,
      timestamp: Date.now(),
      signature: 'temp' // In production, this should be properly signed
    });

    const fullUrl = `${url}?${params}`;

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const response = await fetch(fullUrl, { ...defaultOptions, ...options });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Earn points for customer
   */
  async function earnPoints(points, activityType, description, metadata = {}) {
    const customerId = getCustomerId();
    if (!customerId) return null;

    try {
      const response = await apiRequest(`/customer/${customerId}/earn`, {
        method: 'POST',
        body: JSON.stringify({
          points,
          activityType,
          description,
          ...metadata
        })
      });

      if (response.success) {
        // Update customer data
        await loadCustomerData();

        // Show notification
        showNotification(`You earned ${points} points!`, 'success');

        return response;
      }
    } catch (error) {
      console.error('Failed to earn points:', error);
      showNotification('Failed to award points', 'error');
    }

    return null;
  }

  /**
   * Redeem reward
   */
  async function redeemReward(rewardId, quantity = 1) {
    const customerId = getCustomerId();
    if (!customerId) return null;

    try {
      const response = await apiRequest(`/customer/${customerId}/redeem`, {
        method: 'POST',
        body: JSON.stringify({
          rewardId,
          quantity
        })
      });

      if (response.success) {
        // Update customer data
        await loadCustomerData();

        // Show success notification
        const message = response.redemption.code
          ? `Reward redeemed! Code: ${response.redemption.code}`
          : 'Reward redeemed successfully!';
        showNotification(message, 'success');

        return response;
      } else {
        showNotification(response.error || 'Failed to redeem reward', 'error');
      }
    } catch (error) {
      console.error('Failed to redeem reward:', error);
      showNotification('Failed to redeem reward', 'error');
    }

    return null;
  }

  /**
   * Enroll customer in loyalty program
   */
  async function enrollCustomer(customerInfo) {
    try {
      const response = await apiRequest('/customer/enroll', {
        method: 'POST',
        body: JSON.stringify(customerInfo)
      });

      if (response.success) {
        await loadCustomerData();
        showNotification('Welcome to our loyalty program!', 'success');
        return response;
      } else {
        showNotification(response.error || 'Failed to join loyalty program', 'error');
      }
    } catch (error) {
      console.error('Failed to enroll customer:', error);
      showNotification('Failed to join loyalty program', 'error');
    }

    return null;
  }

  /**
   * Show notification to user
   */
  function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `loyco-notification loyco-notification-${type}`;
    notification.innerHTML = `
      <div class="loyco-notification-content">
        <span class="loyco-notification-icon">${getNotificationIcon(type)}</span>
        <span class="loyco-notification-message">${message}</span>
        <button class="loyco-notification-close">&times;</button>
      </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Close button
    notification.querySelector('.loyco-notification-close').addEventListener('click', () => {
      notification.remove();
    });

    // Auto remove
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);
  }

  /**
   * Get notification icon by type
   */
  function getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  /**
   * Handle reload event
   */
  function handleReload() {
    loadProgramData();
    if (isCustomerLoggedIn()) {
      loadCustomerData();
    }
  }

  /**
   * Handle customer update event
   */
  function handleCustomerUpdate() {
    if (isCustomerLoggedIn()) {
      loadCustomerData();
    }
  }

  /**
   * Debug logging
   */
  function log(...args) {
    if (config.debug) {
      console.log('[Loyco]', ...args);
    }
  }

  /**
   * Format number with locale
   */
  function formatNumber(number) {
    return new Intl.NumberFormat().format(number);
  }

  /**
   * Format currency
   */
  function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount / 100);
  }

  // Public API
  window.Loyco = {
    init,
    isCustomerLoggedIn,
    getCustomerId,
    loadCustomerData,
    loadProgramData,
    earnPoints,
    redeemReward,
    enrollCustomer,
    showNotification,
    formatNumber,
    formatCurrency,
    apiRequest,

    // Data getters
    get customerData() { return customerData; },
    get programData() { return programData; },
    get config() { return config; }
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// Global CSS for notifications
const loycoStyles = document.createElement('style');
loycoStyles.textContent = `
  .loyco-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    max-width: 400px;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    animation: loyco-slide-in 0.3s ease-out;
  }

  .loyco-notification-success {
    background: #10b981;
    color: white;
  }

  .loyco-notification-error {
    background: #ef4444;
    color: white;
  }

  .loyco-notification-warning {
    background: #f59e0b;
    color: white;
  }

  .loyco-notification-info {
    background: #3b82f6;
    color: white;
  }

  .loyco-notification-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .loyco-notification-message {
    flex: 1;
  }

  .loyco-notification-close {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0;
    margin-left: 8px;
  }

  @keyframes loyco-slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  /* Utility classes */
  .loyco-loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #f3f4f6;
    border-top: 2px solid #6366f1;
    border-radius: 50%;
    animation: loyco-spin 1s linear infinite;
  }

  @keyframes loyco-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

document.head.appendChild(loycoStyles);