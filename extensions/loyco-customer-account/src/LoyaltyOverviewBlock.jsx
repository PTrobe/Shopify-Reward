import {
  reactExtension,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Link,
} from '@shopify/ui-extensions-react/customer-account';
import { useState, useEffect } from 'react';

export default reactExtension('customer-account.block.render', () => <LoyaltyOverviewBlock />);

function LoyaltyOverviewBlock() {
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [showTestBanner] = useState(true);

  useEffect(() => {
    async function fetchLoyaltySummary() {
      try {
        setLoading(true);
        
        const response = await fetch('/apps/loyco-rewards/api/loyalty-summary', {
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
      <BlockStack spacing="tight">
        {showTestBanner && (
          <Banner status="info">
            <Text>✅ Loyco overview block loaded</Text>
          </Banner>
        )}
        <Banner>
          <Text>Loading loyalty information...</Text>
        </Banner>
      </BlockStack>
    );
  }

  if (!loyaltyData) {
    return showTestBanner ? (
      <Banner status="info">
        <Text>✅ Loyco overview block loaded (no data)</Text>
      </Banner>
    ) : null;
  }

  return (
    <BlockStack spacing="tight">
      {showTestBanner && (
        <Banner status="info">
          <Text>✅ Loyco overview block loaded</Text>
        </Banner>
      )}
      <Banner status="info">
        <BlockStack spacing="tight">
        <InlineStack spacing="tight" blockAlignment="center">
          <Text emphasis="bold">
            {loyaltyData.tier.icon} {loyaltyData.tier.name} Member
          </Text>
          <Text>•</Text>
          <Text emphasis="bold">
            {loyaltyData.pointsBalance} points
          </Text>
        </InlineStack>
        
        <Text>View and redeem your loyalty rewards</Text>
        
        <Link to="/account/loyalty">
          View Rewards
        </Link>
      </BlockStack>
    </Banner>
    </BlockStack>
  );
}
