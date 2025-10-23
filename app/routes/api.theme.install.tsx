import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json();
    const { selectedTheme, autoInstallBlocks, backupBeforeInstall } = body;

    console.log("Installing loyalty blocks to theme:", selectedTheme);

    // Step 1: Get the selected theme
    const theme = await admin.rest.resources.Theme.find({
      session,
      id: selectedTheme,
    });

    if (!theme) {
      return json({ error: "Theme not found" }, { status: 404 });
    }

    // Step 2: Create backup if requested
    if (backupBeforeInstall) {
      console.log("Creating theme backup...");
      try {
        await admin.rest.resources.Theme.save({
          session,
          name: `${theme.name} - Backup ${new Date().toISOString().split('T')[0]}`,
          src_theme_id: theme.id,
          role: "unpublished",
        });
      } catch (backupError) {
        console.warn("Backup creation failed, continuing with installation:", backupError);
      }
    }

    // Step 3: Install loyalty program blocks/snippets
    const installationResults = [];

    if (autoInstallBlocks) {
      // Install header snippet for points display
      try {
        console.log("Installing header loyalty snippet...");

        // Get theme's layout/theme.liquid file
        const themeAsset = await admin.rest.resources.Asset.find({
          session,
          theme_id: theme.id,
          key: "layout/theme.liquid",
        });

        if (themeAsset && themeAsset.value) {
          // Inject loyalty script just before closing </head>
          const loyaltyScript = `
  <!-- Loyco Rewards Integration -->
  <script>
    window.loycoRewards = {
      customerId: {{ customer.id | json }},
      customerEmail: {{ customer.email | json }},
      shopDomain: {{ shop.permanent_domain | json }}
    };
  </script>
  <script src="{{ 'loyco-rewards.js' | asset_url }}" defer></script>`;

          let updatedContent = themeAsset.value;

          // Check if already installed
          if (!updatedContent.includes('<!-- Loyco Rewards Integration -->')) {
            // Insert before closing head tag
            updatedContent = updatedContent.replace(
              '</head>',
              `${loyaltyScript}\n</head>`
            );

            // Save the updated theme file
            await admin.rest.resources.Asset.save({
              session,
              theme_id: theme.id,
              key: "layout/theme.liquid",
              value: updatedContent,
            });

            installationResults.push({
              type: "header_integration",
              status: "success",
              message: "Header loyalty script installed successfully"
            });
          } else {
            installationResults.push({
              type: "header_integration",
              status: "skipped",
              message: "Header integration already exists"
            });
          }
        }

        // Install loyco-rewards.js asset
        const loyaltyJs = `
// Loyco Rewards Frontend Integration
(function() {
  'use strict';

  const LoycoRewards = {
    apiUrl: 'https://' + window.loycoRewards.shopDomain + '/apps/loyco-rewards/api',
    customerId: window.loycoRewards.customerId,

    init() {
      this.loadCustomerPoints();
      this.injectPointsDisplay();
      this.bindEvents();
    },

    async loadCustomerPoints() {
      if (!this.customerId) return;

      try {
        const response = await fetch(this.apiUrl + '/customer/' + this.customerId + '/points');
        const data = await response.json();
        this.customerPoints = data.points || 0;
        this.updatePointsDisplay();
      } catch (error) {
        console.warn('Loyco: Could not load customer points', error);
        this.customerPoints = 0;
      }
    },

    injectPointsDisplay() {
      // Create header points display
      if (this.customerId) {
        this.createHeaderPoints();
        this.createProductPagePoints();
      }
    },

    createHeaderPoints() {
      const header = document.querySelector('header, .header, .site-header');
      if (!header) return;

      const pointsEl = document.createElement('div');
      pointsEl.className = 'loyco-header-points';
      pointsEl.innerHTML = \`
        <span class="loyco-star">★</span>
        <span class="loyco-points">\${this.customerPoints || 0}</span>
      \`;

      // Add styles
      pointsEl.style.cssText = \`
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        background: rgba(255, 215, 0, 0.1);
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        color: #B8860B;
        margin-left: 8px;
        cursor: pointer;
      \`;

      pointsEl.querySelector('.loyco-star').style.cssText = \`
        color: #FFD700;
        font-size: 14px;
      \`;

      // Try to insert in common header locations
      const nav = header.querySelector('nav, .navigation, .main-nav');
      const account = header.querySelector('.account, .customer, .login');

      if (account) {
        account.appendChild(pointsEl);
      } else if (nav) {
        nav.appendChild(pointsEl);
      } else {
        header.appendChild(pointsEl);
      }
    },

    createProductPagePoints() {
      const productForm = document.querySelector('form[action*="/cart/add"], .product-form');
      if (!productForm) return;

      const priceEl = productForm.querySelector('.price, .product-price');
      if (!priceEl) return;

      const earnPointsEl = document.createElement('div');
      earnPointsEl.className = 'loyco-earn-points';
      earnPointsEl.innerHTML = 'Earn points with this purchase!';
      earnPointsEl.style.cssText = \`
        margin-top: 8px;
        padding: 8px 12px;
        background: rgba(255, 215, 0, 0.1);
        border-radius: 6px;
        font-size: 13px;
        color: #B8860B;
      \`;

      priceEl.insertAdjacentElement('afterend', earnPointsEl);
    },

    updatePointsDisplay() {
      const pointsDisplays = document.querySelectorAll('.loyco-points');
      pointsDisplays.forEach(el => {
        el.textContent = this.customerPoints || 0;
      });
    },

    bindEvents() {
      // Add click handler for header points
      document.addEventListener('click', (e) => {
        if (e.target.closest('.loyco-header-points')) {
          this.showPointsModal();
        }
      });
    },

    showPointsModal() {
      alert(\`You have \${this.customerPoints || 0} loyalty points!\`);
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => LoycoRewards.init());
  } else {
    LoycoRewards.init();
  }

  // Expose globally
  window.LoycoRewards = LoycoRewards;
})();`;

        await admin.rest.resources.Asset.save({
          session,
          theme_id: theme.id,
          key: "assets/loyco-rewards.js",
          value: loyaltyJs,
        });

        installationResults.push({
          type: "javascript_integration",
          status: "success",
          message: "Loyalty JavaScript integration installed successfully"
        });

      } catch (error) {
        console.error("Error installing theme blocks:", error);
        installationResults.push({
          type: "installation_error",
          status: "error",
          message: `Installation failed: ${error.message}`
        });
      }
    }

    // Step 4: Return installation results
    return json({
      success: true,
      theme: {
        id: theme.id,
        name: theme.name,
        role: theme.role
      },
      installationResults,
      message: "Theme installation completed successfully"
    });

  } catch (error) {
    console.error("Theme installation error:", error);
    return json(
      {
        error: "Theme installation failed",
        details: error.message
      },
      { status: 500 }
    );
  }
};