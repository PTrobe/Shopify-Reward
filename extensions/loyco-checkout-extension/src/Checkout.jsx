import {
  reactExtension,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  TextBlock,
  Divider,
  SkeletonText,
  useSettings,
  useCustomer,
  useCartLines,
  useTotalAmount,
  useShop,
  useExtensionApi,
} from '@shopify/ui-extensions-react/checkout';
import { useState, useEffect } from 'react';

// Define the checkout UI extension
export default reactExtension(
  'purchase.checkout.block.render',
  () => <LoyaltyCheckoutExtension />
);

function LoyaltyCheckoutExtension() {
  const settings = useSettings();
  const customer = useCustomer();
  const cartLines = useCartLines();
  const totalAmount = useTotalAmount();
  const shop = useShop();
  const { query } = useExtensionApi();

  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const showPointsEarned = settings.show_points_earned ?? true;
  const showTierProgress = settings.show_tier_progress ?? true;
  const showAvailableRewards = settings.show_available_rewards ?? true;
  const primaryColor = settings.primary_color || '#6366f1';
  const welcomeMessage = settings.welcome_message || 'Join our loyalty program to earn points on every purchase!';

  useEffect(() => {
    if (customer?.id && shop?.domain) {
      loadLoyaltyData();
    } else {
      setLoading(false);
    }
  }, [customer?.id, shop?.domain, totalAmount]);

  const loadLoyaltyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate order total in cents
      const orderTotal = Math.round(totalAmount.amount * 100);

      // Fetch customer loyalty status and program data
      const [customerResponse, programResponse] = await Promise.all([
        fetchLoyaltyData(`/customer/${customer.id}/status`),
        fetchLoyaltyData('/program')
      ]);

      if (customerResponse.enrolled && programResponse.active) {
        // Calculate points that will be earned
        const basePoints = Math.floor((orderTotal / 100) * programResponse.pointsPerDollar);
        const tierMultiplier = customerResponse.tier?.pointsMultiplier || 1;
        const bonusPoints = Math.floor(basePoints * (tierMultiplier - 1));
        const totalPoints = basePoints + bonusPoints;

        // Calculate future balance and check for tier upgrade
        const futureBalance = customerResponse.customer.pointsBalance + totalPoints;
        const futureLifetimePoints = customerResponse.customer.lifetimePoints + totalPoints;

        let tierUpgrade = null;
        if (customerResponse.nextTier &&
            futureLifetimePoints >= customerResponse.nextTier.requiredPoints) {
          tierUpgrade = customerResponse.nextTier;
        }

        setLoyaltyData({
          customer: customerResponse,
          program: programResponse,
          points: {
            base: basePoints,
            bonus: bonusPoints,
            total: totalPoints,
            futureBalance,
            futureLifetimePoints
          },
          tierUpgrade
        });
      } else {
        setLoyaltyData({
          enrolled: false,
          program: programResponse
        });
      }
    } catch (err) {
      console.error('Failed to load loyalty data:', err);
      setError('Unable to load loyalty information');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoyaltyData = async (endpoint) => {
    // In a real implementation, this would use the app proxy or API
    // For now, we'll simulate the API call structure
    const response = await query(
      `query LoyaltyData($endpoint: String!) {
        loyaltyData(endpoint: $endpoint)
      }`,
      { variables: { endpoint } }
    );

    return response.data.loyaltyData;
  };

  if (loading) {
    return (
      <BlockStack spacing="base">
        <SkeletonText inlineSize="large" />
        <SkeletonText inlineSize="small" />
      </BlockStack>
    );
  }

  if (error) {
    return (
      <Banner status="warning">
        <Text>{error}</Text>
      </Banner>
    );
  }

  // Guest checkout - show enrollment prompt
  if (!customer?.id || !loyaltyData?.enrolled) {
    return (
      <BlockStack spacing="base">
        <Banner status="info">
          <BlockStack spacing="tight">
            <Text emphasis="bold">🎁 Earn Loyalty Points</Text>
            <TextBlock>{welcomeMessage}</TextBlock>
            {loyaltyData?.program?.active && (
              <Text size="small">
                Create an account to earn {Math.floor((totalAmount.amount * loyaltyData.program.pointsPerDollar))} points on this order!
              </Text>
            )}
          </BlockStack>
        </Banner>
      </BlockStack>
    );
  }

  // Customer checkout - show loyalty benefits
  return (
    <BlockStack spacing="base">
      <Banner status="success">
        <BlockStack spacing="tight">
          <Text emphasis="bold">🎁 Loyalty Rewards</Text>

          {/* Points Earned Section */}
          {showPointsEarned && loyaltyData.points.total > 0 && (
            <BlockStack spacing="extraTight">
              <InlineStack spacing="tight" blockAlignment="center">
                <Text>You'll earn:</Text>
                <Text emphasis="bold" appearance="accent">
                  {loyaltyData.points.total.toLocaleString()} {loyaltyData.program.pointsName || 'points'}
                </Text>
              </InlineStack>

              {loyaltyData.points.bonus > 0 && (
                <Text size="small" appearance="subdued">
                  {loyaltyData.points.base.toLocaleString()} base + {loyaltyData.points.bonus.toLocaleString()} tier bonus
                </Text>
              )}

              <Text size="small" appearance="subdued">
                New balance: {loyaltyData.points.futureBalance.toLocaleString()} {loyaltyData.program.pointsName || 'points'}
              </Text>
            </BlockStack>
          )}

          {/* Tier Upgrade Section */}
          {showTierProgress && loyaltyData.tierUpgrade && (
            <>
              <Divider />
              <BlockStack spacing="extraTight">
                <Text emphasis="bold" appearance="accent">
                  🎉 Tier Upgrade!
                </Text>
                <Text size="small">
                  This order will upgrade you to {loyaltyData.tierUpgrade.name}!
                </Text>
              </BlockStack>
            </>
          )}

          {/* Current Tier Progress */}
          {showTierProgress && !loyaltyData.tierUpgrade && loyaltyData.customer.nextTier && (
            <>
              <Divider />
              <BlockStack spacing="extraTight">
                <Text size="small" appearance="subdued">
                  Tier Progress: {loyaltyData.customer.tier?.name || 'Bronze'} → {loyaltyData.customer.nextTier.name}
                </Text>
                <Text size="small">
                  {Math.max(0, loyaltyData.customer.nextTier.requiredPoints - loyaltyData.points.futureLifetimePoints).toLocaleString()} more points to next tier
                </Text>
              </BlockStack>
            </>
          )}

          {/* Available Rewards Section */}
          {showAvailableRewards && loyaltyData.customer.availableRewards?.length > 0 && (
            <>
              <Divider />
              <BlockStack spacing="extraTight">
                <Text size="small" emphasis="bold">
                  🏆 You can redeem:
                </Text>
                {loyaltyData.customer.availableRewards
                  .filter(reward => reward.pointsCost <= loyaltyData.points.futureBalance)
                  .slice(0, 3)
                  .map((reward, index) => (
                    <InlineStack key={index} spacing="tight" blockAlignment="center">
                      <Text size="small">{reward.name}</Text>
                      <Text size="small" appearance="subdued">
                        ({reward.pointsCost.toLocaleString()} pts)
                      </Text>
                    </InlineStack>
                  ))
                }
              </BlockStack>
            </>
          )}
        </BlockStack>
      </Banner>
    </BlockStack>
  );
}