import {
  reactExtension,
  BlockStack,
  InlineStack,
  Text,
  TextBlock,
  Card,
  ProgressBar,
  Button,
  Badge,
  Divider,
  SkeletonText,
  Grid,
  GridItem,
  useSettings,
  useCustomer,
  useShop,
  useExtensionApi,
} from '@shopify/ui-extensions-react/customer-account';
import { useState, useEffect } from 'react';

// Define the customer account UI extension
export default reactExtension(
  'customer-account.order-status.block.render',
  () => <LoyaltyCustomerAccount />
);

function LoyaltyCustomerAccount() {
  const settings = useSettings();
  const customer = useCustomer();
  const shop = useShop();
  const { query } = useExtensionApi();

  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const primaryColor = settings.primary_color || '#6366f1';
  const showTransactionHistory = settings.show_transaction_history ?? true;
  const transactionsLimit = settings.transactions_limit || 10;

  useEffect(() => {
    if (customer?.id && shop?.domain) {
      loadLoyaltyData();
    } else {
      setLoading(false);
    }
  }, [customer?.id, shop?.domain]);

  const loadLoyaltyData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchLoyaltyData(`/customer/${customer.id}/status`);

      if (response.enrolled) {
        setLoyaltyData(response);
      } else {
        setLoyaltyData({ enrolled: false });
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
      <Card>
        <BlockStack spacing="base">
          <SkeletonText inlineSize="large" />
          <SkeletonText inlineSize="small" />
          <SkeletonText inlineSize="medium" />
        </BlockStack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <BlockStack spacing="base">
          <Text emphasis="bold">Loyalty Program</Text>
          <Text appearance="critical">{error}</Text>
        </BlockStack>
      </Card>
    );
  }

  if (!loyaltyData?.enrolled) {
    return (
      <Card>
        <BlockStack spacing="base">
          <Text emphasis="bold">🎁 Join Our Loyalty Program</Text>
          <TextBlock>
            Start earning points on every purchase and unlock exclusive rewards!
          </TextBlock>
          <Button
            kind="primary"
            accessibilityLabel="Join loyalty program"
          >
            Join Now
          </Button>
        </BlockStack>
      </Card>
    );
  }

  const { customer: customerInfo, tier, nextTier, program, availableRewards, recentTransactions } = loyaltyData;

  return (
    <BlockStack spacing="base">
      {/* Header Card */}
      <Card>
        <BlockStack spacing="base">
          <InlineStack spacing="base" blockAlignment="center">
            <Text emphasis="bold" size="large">🎁 Loyalty Status</Text>
            {tier && (
              <Badge tone="info">
                {tier.icon} {tier.name}
              </Badge>
            )}
          </InlineStack>

          <Grid
            columns={['oneThird', 'oneThird', 'oneThird']}
            spacing="base"
          >
            <GridItem>
              <BlockStack spacing="extraTight">
                <Text appearance="subdued" size="small">Current Balance</Text>
                <Text emphasis="bold" size="large">
                  {customerInfo.pointsBalance.toLocaleString()}
                </Text>
                <Text size="small">{program.pointsName || 'points'}</Text>
              </BlockStack>
            </GridItem>

            <GridItem>
              <BlockStack spacing="extraTight">
                <Text appearance="subdued" size="small">Lifetime Points</Text>
                <Text emphasis="bold" size="large">
                  {customerInfo.lifetimePoints.toLocaleString()}
                </Text>
                <Text size="small">total earned</Text>
              </BlockStack>
            </GridItem>

            <GridItem>
              <BlockStack spacing="extraTight">
                <Text appearance="subdued" size="small">Member Since</Text>
                <Text emphasis="bold">
                  {new Date(customerInfo.enrolledAt).toLocaleDateString()}
                </Text>
              </BlockStack>
            </GridItem>
          </Grid>
        </BlockStack>
      </Card>

      {/* Tier Progress Card */}
      {nextTier && (
        <Card>
          <BlockStack spacing="base">
            <Text emphasis="bold">🏆 Tier Progress</Text>

            <BlockStack spacing="tight">
              <InlineStack spacing="tight" blockAlignment="center">
                <Text>Progress to {nextTier.name}:</Text>
                <Text emphasis="bold">
                  {Math.max(0, nextTier.requiredPoints - customerInfo.lifetimePoints).toLocaleString()} points to go
                </Text>
              </InlineStack>

              <ProgressBar
                progress={Math.min((customerInfo.lifetimePoints / nextTier.requiredPoints) * 100, 100)}
                tone="primary"
              />

              <InlineStack spacing="base">
                <Text size="small" appearance="subdued">
                  {customerInfo.lifetimePoints.toLocaleString()} / {nextTier.requiredPoints.toLocaleString()}
                </Text>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>
      )}

      {/* Available Rewards Card */}
      {availableRewards && availableRewards.length > 0 && (
        <Card>
          <BlockStack spacing="base">
            <InlineStack spacing="base" blockAlignment="center">
              <Text emphasis="bold">🏅 Available Rewards</Text>
              <Badge tone="success">{availableRewards.length}</Badge>
            </InlineStack>

            <BlockStack spacing="tight">
              {availableRewards.slice(0, 5).map((reward, index) => (
                <InlineStack key={index} spacing="base" blockAlignment="center">
                  <BlockStack spacing="none">
                    <Text>{reward.name}</Text>
                    {reward.description && (
                      <Text size="small" appearance="subdued">
                        {reward.description}
                      </Text>
                    )}
                  </BlockStack>
                  <InlineStack spacing="tight" blockAlignment="center">
                    <Text emphasis="bold" appearance="accent">
                      {reward.pointsCost.toLocaleString()}
                    </Text>
                    <Text size="small">pts</Text>
                  </InlineStack>
                </InlineStack>
              ))}
            </BlockStack>

            {availableRewards.length > 5 && (
              <Button
                kind="plain"
                accessibilityLabel="View all rewards"
              >
                View All {availableRewards.length} Rewards
              </Button>
            )}
          </BlockStack>
        </Card>
      )}

      {/* Referral Card */}
      {customerInfo.referralCode && (
        <Card>
          <BlockStack spacing="base">
            <Text emphasis="bold">📢 Invite Friends</Text>
            <TextBlock>
              Share your referral code and earn bonus points when friends make their first purchase!
            </TextBlock>

            <InlineStack spacing="base" blockAlignment="center">
              <Text emphasis="bold" size="large">
                {customerInfo.referralCode}
              </Text>
              <Button
                kind="secondary"
                accessibilityLabel="Copy referral code"
              >
                Copy Code
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      )}

      {/* Transaction History Card */}
      {showTransactionHistory && recentTransactions && recentTransactions.length > 0 && (
        <Card>
          <BlockStack spacing="base">
            <Text emphasis="bold">📋 Recent Activity</Text>

            <BlockStack spacing="tight">
              {recentTransactions.slice(0, transactionsLimit).map((transaction, index) => (
                <div key={index}>
                  <InlineStack spacing="base" blockAlignment="center">
                    <BlockStack spacing="none">
                      <Text>{transaction.description}</Text>
                      <Text size="small" appearance="subdued">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </Text>
                    </BlockStack>

                    <Text
                      emphasis="bold"
                      appearance={transaction.points > 0 ? "success" : "critical"}
                    >
                      {transaction.points > 0 ? '+' : ''}{transaction.points.toLocaleString()}
                    </Text>
                  </InlineStack>
                  {index < recentTransactions.slice(0, transactionsLimit).length - 1 && (
                    <Divider />
                  )}
                </div>
              ))}
            </BlockStack>

            {recentTransactions.length > transactionsLimit && (
              <Button
                kind="plain"
                accessibilityLabel="View all transactions"
              >
                View All Transactions
              </Button>
            )}
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}