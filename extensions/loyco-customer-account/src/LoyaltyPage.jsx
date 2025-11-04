import {
  reactExtension,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Spinner,
  useApi,
} from '@shopify/ui-extensions-react/customer-account';
import { useState, useEffect } from 'react';

export default reactExtension('customer-account.page.render', () => <LoyaltyPage />);

function LoyaltyPage() {
  const { customer, shop } = useApi();
  const [customerStatus, setCustomerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState(null);

  console.log('🚨 LOYCO CUSTOMER ACCOUNT PAGE: Extension function called');
  console.log('Customer:', customer);
  console.log('Shop:', shop);

  // Fetch customer loyalty status
  useEffect(() => {
    const fetchCustomerStatus = async () => {
      if (!customer?.id || !shop?.domain) {
        console.log('Missing customer or shop data');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching customer status for:', customer.id);
        const url = `https://${shop.domain}/apps/loyco-rewards/api/customer/${customer.id}/status?shop=${shop.domain}&timestamp=${Date.now()}&signature=dummy`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Customer status response:', data);
        setCustomerStatus(data);
      } catch (err) {
        console.error('Error fetching customer status:', err);
        setError('Failed to load loyalty status');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerStatus();
  }, [customer?.id, shop?.domain]);

  // Handle customer enrollment
  const handleEnroll = async () => {
    if (!customer?.id || !shop?.domain || enrolling) {
      return;
    }

    setEnrolling(true);
    setError(null);

    try {
      console.log('Enrolling customer:', customer.id);
      const url = `https://${shop.domain}/apps/loyco-rewards/api/customer/enroll?shop=${shop.domain}&timestamp=${Date.now()}&signature=dummy`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopifyCustomerId: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Enrollment response:', data);

      if (data.success) {
        // Refresh customer status
        setCustomerStatus({
          enrolled: true,
          customer: data.customer,
          program: data.program,
          welcomeBonus: data.welcomeBonus,
        });
      } else {
        throw new Error(data.error || 'Enrollment failed');
      }
    } catch (err) {
      console.error('Error enrolling customer:', err);
      setError(err.message || 'Failed to join loyalty program');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <BlockStack spacing="base">
        <Text emphasis="bold" size="large">Loyalty Program</Text>
        <Spinner size="small" />
        <Text size="small">Loading loyalty information...</Text>
      </BlockStack>
    );
  }

  if (error) {
    return (
      <BlockStack spacing="base">
        <Text emphasis="bold" size="large">Loyalty Program</Text>
        <Banner status="critical">
          <Text>{error}</Text>
        </Banner>
      </BlockStack>
    );
  }

  // Customer is not enrolled - show enrollment page
  if (!customerStatus?.enrolled) {
    return (
      <BlockStack spacing="base">
        <Text emphasis="bold" size="large">{customerStatus?.program?.name || 'Loyalty Program'}</Text>

        <Banner status="info">
          <BlockStack spacing="small">
            <Text emphasis="bold">Welcome to {customerStatus?.program?.name || 'Our Loyalty Program'}!</Text>
            <Text>Join our loyalty program to start earning {customerStatus?.program?.pointsName || 'points'} on every purchase and unlock exclusive rewards.</Text>
            {customerStatus?.program?.welcomeBonus > 0 && (
              <Text>🎁 Join now and get {customerStatus.program.welcomeBonus} {customerStatus.program.pointsName} as a welcome bonus!</Text>
            )}
          </BlockStack>
        </Banner>

        <BlockStack spacing="small">
          <Text emphasis="bold">Program Benefits:</Text>
          <Text>• Earn {customerStatus?.program?.pointsName || 'points'} on every purchase</Text>
          <Text>• Redeem {customerStatus?.program?.pointsName || 'points'} for exclusive rewards</Text>
          <Text>• Access to member-only promotions</Text>
          <Text>• Birthday rewards and special offers</Text>
        </BlockStack>

        <InlineStack spacing="base">
          <Button
            kind="primary"
            onPress={handleEnroll}
            loading={enrolling}
            disabled={enrolling}
          >
            {enrolling ? 'Joining...' : 'Join Loyalty Program'}
          </Button>
        </InlineStack>
      </BlockStack>
    );
  }

  // Customer is enrolled - show full loyalty dashboard
  const { customer: loyaltyCustomer, program, tier, nextTier, availableRewards, recentTransactions } = customerStatus;

  return (
    <BlockStack spacing="base">
      <Text emphasis="bold" size="large">{program?.name}</Text>

      <Banner status="success">
        <Text emphasis="bold">Welcome back, {loyaltyCustomer?.firstName}!</Text>
      </Banner>

      <BlockStack spacing="small">
        <Text emphasis="bold" size="medium">Your Points</Text>
        <InlineStack spacing="base">
          <Text emphasis="bold">Current Balance:</Text>
          <Text>{loyaltyCustomer?.pointsBalance || 0} {program?.pointsName}</Text>
        </InlineStack>

        <InlineStack spacing="base">
          <Text emphasis="bold">Lifetime Points:</Text>
          <Text>{loyaltyCustomer?.lifetimePoints || 0} {program?.pointsName}</Text>
        </InlineStack>

        {tier && (
          <InlineStack spacing="base">
            <Text emphasis="bold">Current Tier:</Text>
            <Text>{tier.name}</Text>
          </InlineStack>
        )}

        {nextTier && (
          <InlineStack spacing="base">
            <Text emphasis="bold">Next Tier:</Text>
            <Text>{nextTier.name} ({nextTier.pointsNeeded} more {program?.pointsName})</Text>
          </InlineStack>
        )}

        {loyaltyCustomer?.referralCode && (
          <BlockStack spacing="small">
            <Text emphasis="bold">Your Referral Code:</Text>
            <Text>{loyaltyCustomer.referralCode}</Text>
            <Text size="small">Share this code with friends to earn bonus {program?.pointsName}!</Text>
          </BlockStack>
        )}
      </BlockStack>

      {availableRewards && availableRewards.length > 0 && (
        <BlockStack spacing="small">
          <Text emphasis="bold" size="medium">Available Rewards</Text>
          {availableRewards.slice(0, 3).map((reward, index) => (
            <InlineStack key={index} spacing="base">
              <Text>{reward.name}</Text>
              <Text>({reward.pointsCost} {program?.pointsName})</Text>
            </InlineStack>
          ))}
        </BlockStack>
      )}

      {recentTransactions && recentTransactions.length > 0 && (
        <BlockStack spacing="small">
          <Text emphasis="bold" size="medium">Recent Activity</Text>
          {recentTransactions.slice(0, 3).map((transaction, index) => (
            <InlineStack key={index} spacing="base">
              <Text>{transaction.type === 'EARNED' ? '+' : '-'}{transaction.points} {program?.pointsName}</Text>
              <Text size="small">{transaction.description}</Text>
            </InlineStack>
          ))}
        </BlockStack>
      )}

      {customerStatus.welcomeBonus && (
        <Banner status="success">
          <Text>🎉 Welcome bonus awarded: {customerStatus.welcomeBonus.points} {program?.pointsName}!</Text>
        </Banner>
      )}
    </BlockStack>
  );
}
