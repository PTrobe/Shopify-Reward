import {
  reactExtension,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Divider,
  useCustomer,
  useTotalAmount,
  useShop,
} from '@shopify/ui-extensions-react/checkout';
import {useState, useEffect} from 'react';

export default reactExtension('purchase.checkout.block.render', () => <LoyaltyCheckoutExtension />);

function LoyaltyCheckoutExtension() {
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const customer = useCustomer();
  const totalAmount = useTotalAmount();
  const shop = useShop();

  const customerId = customer?.id;
  const shopDomain = shop?.myshopifyDomain;
  const orderTotal = totalAmount?.amount;

  useEffect(() => {
    if (customerId && shopDomain && orderTotal) {
      loadLoyaltyData();
    } else {
      setLoading(false);
    }
  }, [customerId, shopDomain, orderTotal]);

  const loadLoyaltyData = async () => {
    try {
      setLoading(true);

      // Call our app proxy API to get customer loyalty status
      const url = `https://${shopDomain}/apps/loyco-rewards/api/loyalty-summary?logged_in_customer_id=${customerId}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch loyalty data: ${response.statusText}`);
      }
      
      const data = await response.json();

      if (data.enrolled && data.pointsBalance !== undefined) {
        // Calculate points that will be earned
        const amount = parseFloat(orderTotal);
        const pointsPerDollar = 1; // Default, should come from program settings
        const basePoints = Math.floor(amount * pointsPerDollar);

        setLoyaltyData({
          ...data,
          pointsToEarn: basePoints,
          basePoints,
          bonusPoints: 0
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

  if (!customerId) {
    return (
      <Banner title="🎁 Join Our Loyalty Program">
        <BlockStack spacing="tight">
          <Text>
            Sign in to earn points on every purchase and unlock exclusive rewards!
          </Text>
        </BlockStack>
      </Banner>
    );
  }

  if (loading) {
    return (
      <Banner title="🎁 Loyalty Rewards">
        <Text>Loading your loyalty status...</Text>
      </Banner>
    );
  }

  if (error) {
    return (
      <Banner status="warning">
        <Text>{error}</Text>
      </Banner>
    );
  }

  // Show enrollment prompt for non-enrolled customers
  if (!loyaltyData?.enrolled) {
    return (
      <Banner title="🎁 Join Our Loyalty Program" status="info">
        <BlockStack spacing="tight">
          <Text>
            Start earning points on every purchase and unlock exclusive rewards!
          </Text>
          {orderTotal && (
            <Text appearance="subdued">
              Earn {Math.floor(parseFloat(orderTotal))} points on this order when you join!
            </Text>
          )}
        </BlockStack>
      </Banner>
    );
  }

  // Show loyalty benefits for enrolled customers
  return (
    <Banner title="🎁 Loyalty Rewards" status="success">
      <BlockStack spacing="base">
        {/* Points to earn */}
        {loyaltyData.pointsToEarn > 0 && (
          <BlockStack spacing="tight">
            <Text emphasis="bold">
              You'll earn {loyaltyData.pointsToEarn.toLocaleString()} points
            </Text>

            {loyaltyData.bonusPoints > 0 && (
              <Text size="small" appearance="subdued">
                {loyaltyData.basePoints.toLocaleString()} base + {loyaltyData.bonusPoints.toLocaleString()} tier bonus
              </Text>
            )}

            <Text size="small" appearance="subdued">
              New balance: {(loyaltyData.pointsBalance + loyaltyData.pointsToEarn).toLocaleString()} points
            </Text>
          </BlockStack>
        )}

        {/* Available rewards */}
        {loyaltyData.benefits && loyaltyData.benefits.length > 0 && (
          <>
            <Divider />
            <BlockStack spacing="tight">
              <Text size="small" emphasis="bold">
                🏆 You can redeem:
              </Text>
              {loyaltyData.benefits.slice(0, 2).map((benefit, index) => (
                <InlineStack key={index} spacing="tight" blockAlignment="center">
                  <Text size="small">{benefit.title}</Text>
                  <Text size="small" appearance="subdued">
                    ({benefit.minPoints.toLocaleString()} pts)
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </>
        )}
      </BlockStack>
    </Banner>
  );
}
