import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<LoyaltyOverviewBlock />, document.body);
};

function LoyaltyOverviewBlock() {
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState(null);

  useEffect(() => {
    async function fetchLoyaltySummary() {
      try {
        setLoading(true);
        
        const response = await fetch('/apps/loyco/loyalty-summary', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch loyalty summary: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error || !data.enrolled) {
          setLoading(false);
          return;
        }
        
        setLoyaltyData({
          pointsBalance: data.pointsBalance || 0,
          tier: data.tier || {
            name: "Member",
            icon: "⭐",
          },
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch loyalty summary:", err);
        setLoading(false);
      }
    }
    fetchLoyaltySummary();
  }, []);

  if (loading) {
    return (
      <s-banner>
        <s-text>{shopify.i18n.translate("loyalty.loading")}</s-text>
      </s-banner>
    );
  }

  if (!loyaltyData) {
    return null;
  }

  return (
    <s-banner status="info">
      <s-stack spacing="tight">
        <s-inline-stack spacing="tight" blockAlignment="center">
          <s-text emphasis="bold">
            {loyaltyData.tier.icon} {loyaltyData.tier.name} {shopify.i18n.translate("loyalty.member")}
          </s-text>
          <s-text>•</s-text>
          <s-text emphasis="bold">
            {loyaltyData.pointsBalance} {shopify.i18n.translate("loyalty.points")}
          </s-text>
        </s-inline-stack>
        
        <s-text>{shopify.i18n.translate("loyalty.overviewMessage")}</s-text>
        
        <s-link to="/account/loyalty">
          {shopify.i18n.translate("loyalty.viewRewards")}
        </s-link>
      </s-stack>
    </s-banner>
  );
}
