import {
  reactExtension,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Divider,
  Heading,
  useApi,
} from '@shopify/ui-extensions-react/customer-account';
import { useState, useEffect } from 'react';

export default reactExtension('customer-account.page.render', () => <LoyaltyPage />);

function LoyaltyPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [redeeming, setRedeeming] = useState(null);
  const [redemptionSuccess, setRedemptionSuccess] = useState(null);

  const api = useApi();

  useEffect(() => {
    async function fetchCustomerData() {
      try {
        const query = `
          query {
            customer {
              firstName
              lastName
              emailAddress {
                emailAddress
              }
              phoneNumber {
                phoneNumber
              }
            }
          }
        `;
        
        const response = await api.query(query);
        const customer = response.data?.customer;
        
        if (customer) {
          setCustomerData({
            firstName: customer.firstName || "",
            lastName: customer.lastName || "",
            email: customer.emailAddress?.emailAddress || "",
            phone: customer.phoneNumber?.phoneNumber || "",
            birthDate: null,
          });
        }
      } catch (err) {
        console.error("Failed to fetch customer data:", err);
        setCustomerData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          birthDate: null,
        });
      }
    }
    fetchCustomerData();
  }, []);

  useEffect(() => {
    async function fetchLoyaltyData() {
      try {
        setLoading(true);
        
        const response = await fetch('/apps/loyco-rewards/api/loyalty-summary', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch loyalty data: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        if (!data.enrolled) {
          setError("You are not enrolled in the loyalty program yet.");
          setLoading(false);
          return;
        }
        
        setLoyaltyData({
          pointsBalance: data.pointsBalance || 0,
          tier: data.tier || {
            name: "Member",
            icon: "⭐",
            progressPercent: 0,
            nextTier: null,
            pointsToNext: 0,
          },
          benefits: data.benefits || [],
          recentActivity: data.recentActivity || [],
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch loyalty data:", err);
        setError(err instanceof Error ? err.message : "Failed to load loyalty information. Please try again.");
        setLoading(false);
      }
    }
    fetchLoyaltyData();
  }, []);

  async function handleRedeem(benefitId) {
    try {
      setRedeeming(benefitId);
      setRedemptionSuccess(null);
      
      const response = await fetch('/apps/loyco-rewards/api/redeem-benefit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ benefitId }),
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to redeem benefit');
      }
      
      setRedemptionSuccess({
        benefitId,
        discountCode: data.redemption?.discountCode,
        message: data.message,
      });
      
      setLoyaltyData(prev => ({
        ...prev,
        pointsBalance: data.newPointsBalance,
      }));
      
    } catch (err) {
      console.error("Failed to redeem benefit:", err);
      setError(err instanceof Error ? err.message : "Failed to redeem benefit. Please try again.");
    } finally {
      setRedeeming(null);
    }
  }
  
  async function handleSaveProfile() {
    try {
      const response = await fetch('/apps/loyco-rewards/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to update profile');
      }
      
      setCustomerData(prev => ({
        ...prev,
        ...data.updatedFields,
      }));
      
      setEditingProfile(false);
      setEditFormData({});
      
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError(err instanceof Error ? err.message : "Failed to update profile. Please try again.");
    }
  }

  if (loading) {
    return (
      <BlockStack spacing="base">
        <Heading level={1}>Loyalty Program</Heading>
        <Text>Loading your loyalty status...</Text>
      </BlockStack>
    );
  }

  if (error) {
    return (
      <BlockStack spacing="base">
        <Banner status="critical">
          <BlockStack spacing="tight">
            <Heading level={2}>Error</Heading>
            <Text>{error}</Text>
          </BlockStack>
        </Banner>
      </BlockStack>
    );
  }

  return (
    <BlockStack spacing="large">
      <Heading level={1}>Loyalty Program</Heading>
      
      <BlockStack spacing="base" border="base" padding="base">
        <InlineStack spacing="base" blockAlignment="center">
          <Text size="large" emphasis="bold">
            {loyaltyData.tier.icon} {loyaltyData.tier.name} Member
          </Text>
          <Text emphasis="bold">{loyaltyData.pointsBalance} points</Text>
        </InlineStack>
        
        {loyaltyData.tier.nextTier && (
          <Text>
            {loyaltyData.tier.pointsToNext} points to {loyaltyData.tier.nextTier}
          </Text>
        )}
        
        <Text size="small">{loyaltyData.tier.progressPercent}% to next tier</Text>
      </BlockStack>

      <Divider />

      <BlockStack spacing="base">
        <InlineStack spacing="base" blockAlignment="center">
          <Heading level={2}>Member Information</Heading>
          {!editingProfile && (
            <Button onPress={() => setEditingProfile(true)}>
              Edit
            </Button>
          )}
        </InlineStack>
        
        {editingProfile ? (
          <BlockStack spacing="base" border="base" padding="base">
            <Text>Edit your profile information</Text>
            
            <TextField
              label="Phone"
              value={editFormData.phone || customerData?.phone || ""}
              onChange={(value) => setEditFormData(prev => ({ ...prev, phone: value }))}
            />
            
            <TextField
              label="Birth Date (YYYY-MM-DD)"
              value={editFormData.birthDate || customerData?.birthDate || ""}
              onChange={(value) => setEditFormData(prev => ({ ...prev, birthDate: value }))}
            />
            
            <InlineStack spacing="tight">
              <Button onPress={() => {
                setEditingProfile(false);
                setEditFormData({});
              }}>
                Cancel
              </Button>
              <Button onPress={handleSaveProfile}>
                Save
              </Button>
            </InlineStack>
          </BlockStack>
        ) : (
          <BlockStack spacing="tight" border="base" padding="base">
            <Text>
              <Text emphasis="bold">Name:</Text> {customerData?.firstName} {customerData?.lastName}
            </Text>
            <Text>
              <Text emphasis="bold">Email:</Text> {customerData?.email}
            </Text>
            {customerData?.phone && (
              <Text>
                <Text emphasis="bold">Phone:</Text> {customerData.phone}
              </Text>
            )}
            {customerData?.birthDate ? (
              <Text>
                <Text emphasis="bold">Birth Date:</Text> {customerData.birthDate}
              </Text>
            ) : (
              <Banner status="info">
                <Text>Add your birth date to receive birthday rewards!</Text>
              </Banner>
            )}
          </BlockStack>
        )}
      </BlockStack>

      <Divider />

      <BlockStack spacing="base">
        <Heading level={2}>Available Benefits</Heading>
        
        {redemptionSuccess && (
          <Banner status="success">
            <BlockStack spacing="tight">
              <Text emphasis="bold">{redemptionSuccess.message}</Text>
              {redemptionSuccess.discountCode && (
                <Text>
                  Discount Code: <Text emphasis="bold">{redemptionSuccess.discountCode}</Text>
                </Text>
              )}
            </BlockStack>
          </Banner>
        )}
        
        <BlockStack spacing="base">
          {loyaltyData.benefits.map((benefit) => (
            <BlockStack key={benefit.id} spacing="tight" border="base" padding="base">
              <InlineStack spacing="base" blockAlignment="center">
                <Heading level={3}>{benefit.title}</Heading>
                {benefit.eligible ? (
                  <Text emphasis="bold">Eligible</Text>
                ) : (
                  <Text>{benefit.minPoints} points required</Text>
                )}
              </InlineStack>
              
              <Text>{benefit.description}</Text>
              
              {benefit.eligible ? (
                <Button 
                  onPress={() => handleRedeem(benefit.id)}
                  disabled={redeeming === benefit.id}
                >
                  {redeeming === benefit.id 
                    ? "Redeeming..."
                    : `Redeem (${benefit.minPoints} points)`
                  }
                </Button>
              ) : (
                <Text size="small">
                  Need {benefit.minPoints - loyaltyData.pointsBalance} more points
                </Text>
              )}
            </BlockStack>
          ))}
        </BlockStack>
      </BlockStack>

      <Divider />

      <BlockStack spacing="base">
        <Heading level={2}>Recent Activity</Heading>
        
        <BlockStack spacing="tight" border="base" padding="base">
          {loyaltyData.recentActivity.map((activity, index) => (
            <InlineStack key={index} spacing="base" blockAlignment="center">
              <Text emphasis="bold">
                {activity.points > 0 ? "+" : ""}{activity.points} points
              </Text>
              <Text>{activity.description}</Text>
              <Text size="small">
                {new Date(activity.createdAt).toLocaleDateString()}
              </Text>
            </InlineStack>
          ))}
        </BlockStack>
      </BlockStack>
    </BlockStack>
  );
}
