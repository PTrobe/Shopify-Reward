import {
  reactExtension,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Spinner,
  useApi,
} from '@shopify/ui-extensions-react/checkout';
import { useState, useEffect } from 'react';

export default reactExtension('purchase.checkout.block.render', () => <CheckoutLoyaltyBlock />);

function CheckoutLoyaltyBlock() {
  const { customer, shop } = useApi();
  const [customerStatus, setCustomerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState(null);

  console.log('🚨 LOYCO CHECKOUT: Extension function called');
  console.log('Customer:', customer);
  console.log('Shop:', shop);

  // Fetch customer loyalty status
  useEffect(() => {
    const fetchCustomerStatus = async () => {
      if (!customer?.id) {
        console.log('No customer logged in');
        setLoading(false);
        return;
      }

      try {
        const numericCustomerId = customer.id.split('/').pop();
        console.log('Fetching customer status for:', numericCustomerId);
        
        const shopDomain = shop?.myshopifyDomain || shop?.domain;
        const url = `/apps/loyco-rewards/api/loyalty-summary?logged_in_customer_id=${numericCustomerId}&shop=${shopDomain}&timestamp=${Date.now()}`;

        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
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
  }, [customer?.id, shop?.myshopifyDomain, shop?.domain]);

  // Handle customer enrollment
  const handleEnroll = async () => {
    if (!customer?.id || enrolling) {
      return;
    }

    setEnrolling(true);
    setError(null);

    try {
      const numericCustomerId = customer.id.split('/').pop();
      console.log('Enrolling customer:', numericCustomerId);
      
      const shopDomain = shop?.myshopifyDomain || shop?.domain;
      const url = `/apps/loyco-rewards/api/customer/enroll?shop=${shopDomain}&timestamp=${Date.now()}`;

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopifyCustomerId: numericCustomerId,
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
        <Spinner size="small" />
        <Text size="small">Loading loyalty information...</Text>
      </BlockStack>
    );
  }

  if (error) {
    return (
      <BlockStack spacing="base">
        <Banner status="critical">
          <Text>{error}</Text>
        </Banner>
      </BlockStack>
    );
  }

  // Customer is not enrolled - show enrollment option
  if (!customerStatus?.enrolled) {
    return (
      <BlockStack spacing="base">
        <Banner status="info">
          <BlockStack spacing="small">
            <Text emphasis="bold">💝 Join {customerStatus?.program?.name || 'Our Loyalty Program'} and earn points on this order!</Text>
            <Text>Earn {customerStatus?.program?.pointsName || 'points'} on every purchase and unlock exclusive rewards.</Text>
            {customerStatus?.program?.welcomeBonus > 0 && (
              <Text>Welcome bonus: {customerStatus.program.welcomeBonus} {customerStatus.program.pointsName}!</Text>
            )}
          </BlockStack>
        </Banner>

        <InlineStack spacing="base">
          <Button
            kind="primary"
            onPress={handleEnroll}
            loading={enrolling}
            disabled={enrolling}
          >
            {enrolling ? 'Joining...' : 'Join & Earn Points'}
          </Button>
        </InlineStack>
      </BlockStack>
    );
  }

  // Customer is enrolled - show loyalty info
  const { customer: loyaltyCustomer, program } = customerStatus;

  return (
    <BlockStack spacing="base">
      <Banner status="success">
        <BlockStack spacing="small">
          <Text emphasis="bold">🎉 You're earning {program?.pointsName} with {program?.name}!</Text>
          <Text>Current balance: {loyaltyCustomer?.pointsBalance || 0} {program?.pointsName}</Text>
        </BlockStack>
      </Banner>

      {customerStatus.welcomeBonus && (
        <Banner status="success">
          <Text>Welcome bonus awarded: {customerStatus.welcomeBonus.points} {program?.pointsName}!</Text>
        </Banner>
      )}
    </BlockStack>
  );
}
