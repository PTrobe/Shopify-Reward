import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

interface ThemeAsset {
  key: string;
  value: string;
}

interface Theme {
  id: number;
  name: string;
  role: string;
}

// Get available themes
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const themesResponse = await admin.rest.resources.Theme.all({
      session,
    });

    const themes = themesResponse.data.map((theme: any) => ({
      id: theme.id,
      name: theme.name,
      role: theme.role,
    }));

    return json({ themes });
  } catch (error) {
    console.error("Error fetching themes:", error);
    return json({ error: "Failed to fetch themes" }, { status: 500 });
  }
};

// Install theme blocks and assets
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const action = formData.get("action");
    const themeId = formData.get("themeId");

    if (!themeId) {
      return json({ error: "Theme ID is required" }, { status: 400 });
    }

    switch (action) {
      case "install_header_block":
        await installHeaderBlock(admin, session, themeId as string);
        return json({ success: true, message: "Header block installed successfully" });

      case "install_customer_page":
        await installCustomerPage(admin, session, themeId as string);
        return json({ success: true, message: "Customer page installed successfully" });

      case "install_all":
        await installHeaderBlock(admin, session, themeId as string);
        await installCustomerPage(admin, session, themeId as string);
        return json({ success: true, message: "All loyalty blocks installed successfully" });

      case "uninstall":
        await uninstallLoyaltyBlocks(admin, session, themeId as string);
        return json({ success: true, message: "Loyalty blocks removed successfully" });

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error managing theme:", error);
    return json({ error: "Failed to manage theme" }, { status: 500 });
  }
};

async function installHeaderBlock(admin: any, session: any, themeId: string) {
  // Header points block
  const headerBlockLiquid = `{% comment %}
  Compact header block for displaying customer loyalty points
  Designed for small header spaces with star icon + points number only
{% endcomment %}

{% assign customer_points = 0 %}
{% assign customer_id = customer.id %}

{% comment %} Get customer points from app API {% endcomment %}
{% if customer_id %}
  {% assign api_url = 'https://shopify-reward-production.up.railway.app/apps/loyco-rewards/api/customer/' | append: customer_id | append: '/points' %}
  {% capture points_fetch %}{{ api_url }}{% endcapture %}
  {% comment %} Use JavaScript for dynamic loading {% endcomment %}
{% endif %}

{% comment %} Only show if customer is logged in {% endcomment %}
{% if customer %}
<div id="loyco-header-points" class="loyco-header-points" style="
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #B8860B;
  white-space: nowrap;
  max-width: 60px;
  overflow: hidden;
">
  <span class="loyco-star-icon" style="
    font-size: 14px;
    color: #FFD700;
    line-height: 1;
    display: flex;
    align-items: center;
  ">★</span>

  <span class="loyco-points-count" style="
    font-size: 11px;
    font-weight: 700;
    color: #B8860B;
    min-width: 0;
  " data-customer-id="{{ customer.id }}">0</span>
</div>

<script>
(function() {
  const pointsEl = document.querySelector('.loyco-points-count');
  const customerId = pointsEl?.getAttribute('data-customer-id');

  if (customerId && pointsEl) {
    fetch('/apps/loyco-rewards/api/customer/' + customerId + '/points')
      .then(response => response.json())
      .then(data => {
        if (data.points !== undefined) {
          pointsEl.textContent = data.points;
        }
      })
      .catch(error => console.log('Loyco: Could not load points'));
  }
})();
</script>

<style>
.loyco-header-points {
  transition: all 0.2s ease;
  cursor: pointer;
}

.loyco-header-points:hover {
  background: rgba(255, 215, 0, 0.2);
  transform: scale(1.05);
}

@media (max-width: 768px) {
  .loyco-header-points {
    font-size: 11px;
    padding: 1px 4px;
    gap: 3px;
    max-width: 50px;
  }

  .loyco-star-icon {
    font-size: 12px;
  }

  .loyco-points-count {
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .loyco-header-points {
    max-width: 40px;
    padding: 1px 3px;
  }
}
</style>
{% endif %}`;

  // Install the snippet
  await admin.rest.resources.Asset.save({
    session,
    theme_id: themeId,
    key: "snippets/loyco-header-points.liquid",
    value: headerBlockLiquid,
  });

  // Now inject the snippet into the theme layout
  try {
    // Get the current theme.liquid file
    const themeAsset = await admin.rest.resources.Asset.all({
      session,
      theme_id: themeId,
      asset: { key: "layout/theme.liquid" },
    });

    if (themeAsset.data && themeAsset.data[0]) {
      let themeContent = themeAsset.data[0].value;

      // Check if our snippet is already included
      if (!themeContent.includes('loyco-header-points')) {
        // Find a good place to insert our header points - typically after site-nav or header
        const insertPatterns = [
          /<\/header>/i,
          /<\/nav>/i,
          /{%\s*section\s*'header'\s*%}/i,
          /{%\s*render\s*'header'\s*%}/i,
          /<body[^>]*>/i
        ];

        let inserted = false;
        for (const pattern of insertPatterns) {
          if (pattern.test(themeContent)) {
            themeContent = themeContent.replace(pattern, (match) => {
              return match + '\n{% render "loyco-header-points" %}';
            });
            inserted = true;
            break;
          }
        }

        // If no suitable location found, add it right after <body>
        if (!inserted) {
          themeContent = themeContent.replace(/<body[^>]*>/i, (match) => {
            return match + '\n{% render "loyco-header-points" %}';
          });
        }

        // Save the updated theme.liquid
        await admin.rest.resources.Asset.save({
          session,
          theme_id: themeId,
          key: "layout/theme.liquid",
          value: themeContent,
        });

        console.log("Header block injected into theme.liquid successfully");
      }
    }
  } catch (error) {
    console.error("Error injecting header block into theme:", error);
  }

  console.log("Header block installed successfully");
}

async function installCustomerPage(admin: any, session: any, themeId: string) {
  // Customer loyalty page template
  const customerPageLiquid = `{% comment %}
  Customer loyalty points page
{% endcomment %}

<div class="loyco-customer-page">
  <h1>Your Loyalty Points</h1>

  {% if customer %}
    <div id="loyco-points-display">
      <div class="points-summary">
        <span class="star">★</span>
        <span class="points" data-customer-id="{{ customer.id }}">Loading...</span>
        <span class="label">points</span>
      </div>
    </div>

    <script>
      const customerId = '{{ customer.id }}';
      if (customerId) {
        fetch('/apps/loyco-rewards/api/customer/' + customerId + '/points')
          .then(response => response.json())
          .then(data => {
            document.querySelector('.points').textContent = data.points || 0;
          })
          .catch(error => {
            document.querySelector('.points').textContent = '0';
          });
      }
    </script>
  {% else %}
    <p>Please log in to view your loyalty points.</p>
  {% endif %}
</div>

<style>
.loyco-customer-page {
  padding: 20px;
  text-align: center;
}

.points-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 24px;
  margin: 20px 0;
}

.star {
  color: #FFD700;
  font-size: 28px;
}

.points {
  font-weight: bold;
  color: #B8860B;
}
</style>`;

  // Install customer page template
  await admin.rest.resources.Asset.save({
    session,
    theme_id: themeId,
    key: "templates/customers/loyalty.liquid",
    value: customerPageLiquid,
  });

  console.log("Customer loyalty page installed successfully");
}

async function uninstallLoyaltyBlocks(admin: any, session: any, themeId: string) {
  const assetsToRemove = [
    "snippets/loyco-header-points.liquid",
    "templates/customers/loyalty.liquid",
  ];

  for (const assetKey of assetsToRemove) {
    try {
      await admin.rest.resources.Asset.delete({
        session,
        theme_id: themeId,
        asset: { key: assetKey },
      });
    } catch (error) {
      console.log(`Asset ${assetKey} not found or already removed`);
    }
  }

  console.log("Loyalty blocks uninstalled successfully");
}