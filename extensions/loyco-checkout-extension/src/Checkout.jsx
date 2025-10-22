import '@shopify/ui-extensions/preact';
import {useState, useEffect} from "preact/hooks";
import {render} from "preact";

// 1. Export the extension
export default async () => {
  render(<LoyaltyCheckoutExtension />, document.body)
};

function LoyaltyCheckoutExtension() {
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get checkout data
  const totalAmount = shopify.cost.totalAmount.amount;
  const customerId = shopify.customer?.id;
  const shop = shopify.shop.domain;

  useEffect(() => {
    if (customerId && shop) {
      loadLoyaltyData();
    } else {
      setLoading(false);
    }
  }, [customerId, shop, totalAmount]);

  const loadLoyaltyData = async () => {
    try {
      setLoading(true);

      // Call our app proxy API to get customer loyalty status
      const response = await fetch(`/apps/loyco_rewards/api/customer/${customerId}/status?shop=${shop}`);
      const data = await response.json();

      if (data.enrolled && data.program) {
        // Calculate points that will be earned
        const orderTotal = parseFloat(totalAmount);
        const pointsPerDollar = data.program.pointsPerDollar || 1;
        const tierMultiplier = data.tier?.pointsMultiplier || 1;
        const basePoints = Math.floor(orderTotal * pointsPerDollar);
        const totalPoints = Math.floor(basePoints * tierMultiplier);

        setLoyaltyData({
          ...data,
          pointsToEarn: totalPoints,
          basePoints,
          bonusPoints: totalPoints - basePoints
        });
      } else {
        setLoyaltyData(data);
      }
    } catch (err) {
      console.error('Failed to load loyalty data:', err);
      setError('Unable to load loyalty information');
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if customer is not logged in
  if (!customerId) {
    return null;
  }

  if (loading) {
    return (
      <s-banner heading="🎁 Loyalty Rewards">
        <s-text>Loading your loyalty status...</s-text>
      </s-banner>
    );
  }

  if (error) {
    return (
      <s-banner tone="subdued">
        <s-text>{error}</s-text>
      </s-banner>
    );
  }

  // Show enrollment prompt for non-enrolled customers
  if (!loyaltyData?.enrolled) {
    return (
      <s-banner heading="🎁 Join Our Loyalty Program" tone="info">
        <s-stack gap="tight">
          <s-text>
            Start earning points on every purchase and unlock exclusive rewards!
          </s-text>
          {loyaltyData?.program && (
            <s-text appearance="subdued">
              Earn {Math.floor(parseFloat(totalAmount) * (loyaltyData.program.pointsPerDollar || 1))} points on this order when you join!
            </s-text>
          )}
        </s-stack>
      </s-banner>
    );
  }

  // Show loyalty benefits for enrolled customers
  return (
    <s-banner heading="🎁 Loyalty Rewards" tone="success">
      <s-stack gap="base">
        {/* Points to earn */}
        {loyaltyData.pointsToEarn > 0 && (
          <s-stack gap="tight">
            <s-text type="emphasis">
              You'll earn {loyaltyData.pointsToEarn.toLocaleString()} {loyaltyData.program.pointsName || 'points'}
            </s-text>

            {loyaltyData.bonusPoints > 0 && (
              <s-text appearance="subdued" size="small">
                {loyaltyData.basePoints.toLocaleString()} base + {loyaltyData.bonusPoints.toLocaleString()} tier bonus
              </s-text>
            )}

            <s-text appearance="subdued" size="small">
              New balance: {(loyaltyData.customer.pointsBalance + loyaltyData.pointsToEarn).toLocaleString()} {loyaltyData.program.pointsName || 'points'}
            </s-text>
          </s-stack>
        )}

        {/* Available rewards */}
        {loyaltyData.availableRewards && loyaltyData.availableRewards.length > 0 && (
          <>
            <s-divider />
            <s-stack gap="tight">
              <s-text size="small" type="emphasis">
                🏆 You can redeem:
              </s-text>
              {loyaltyData.availableRewards.slice(0, 2).map((reward, index) => (
                <s-inline-stack key={index} gap="tight" block-alignment="center">
                  <s-text size="small">{reward.name}</s-text>
                  <s-text size="small" appearance="subdued">
                    ({reward.pointsCost.toLocaleString()} pts)
                  </s-text>
                </s-inline-stack>
              ))}
            </s-stack>
          </>
        )}
      </s-stack>
    </s-banner>
  );
}