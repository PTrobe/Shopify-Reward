import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<LoyaltyPage />, document.body);
};

function LoyaltyPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [redeeming, setRedeeming] = useState(null);
  const [redemptionSuccess, setRedemptionSuccess] = useState(null);

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
        
        const response = await shopify.customerAccount.query(query);
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

  if (loading) {
    return (
      <s-view padding="base">
        <s-stack spacing="base">
          <s-heading level={1}>{shopify.i18n.translate("loyalty.loading")}</s-heading>
          <s-text>{shopify.i18n.translate("loyalty.loadingMessage")}</s-text>
        </s-stack>
      </s-view>
    );
  }

  if (error) {
    return (
      <s-view padding="base">
        <s-banner status="critical">
          <s-stack spacing="tight">
            <s-heading level={2}>{shopify.i18n.translate("loyalty.error")}</s-heading>
            <s-text>{error}</s-text>
            <s-button onPress={() => window.location.reload()}>
              {shopify.i18n.translate("loyalty.retry")}
            </s-button>
          </s-stack>
        </s-banner>
      </s-view>
    );
  }

  return (
    <s-view padding="base">
      <s-stack spacing="large">
        {/* Header Section */}
        <s-stack spacing="base">
          <s-heading level={1}>{shopify.i18n.translate("loyalty.title")}</s-heading>
          
          {/* Points Balance Card */}
          <s-card>
            <s-stack spacing="base">
              <s-inline-stack spacing="base" blockAlignment="center">
                <s-text size="large" emphasis="bold">
                  {loyaltyData.tier.icon} {loyaltyData.tier.name} {shopify.i18n.translate("loyalty.member")}
                </s-text>
                <s-badge tone="info">{loyaltyData.pointsBalance} {shopify.i18n.translate("loyalty.points")}</s-badge>
              </s-inline-stack>
              
              <s-text>
                {shopify.i18n.translate("loyalty.tierProgress", {
                  points: loyaltyData.tier.pointsToNext,
                  tier: loyaltyData.tier.nextTier,
                })}
              </s-text>
              
              {/* Progress bar placeholder - will be styled with CSS */}
              <s-view>
                <s-text size="small">{loyaltyData.tier.progressPercent}% {shopify.i18n.translate("loyalty.toNextTier")}</s-text>
              </s-view>
            </s-stack>
          </s-card>
        </s-stack>

        {/* Member Information Section */}
        <s-stack spacing="base">
          <s-inline-stack spacing="base" blockAlignment="center">
            <s-heading level={2}>{shopify.i18n.translate("loyalty.memberInfo")}</s-heading>
            {!editingProfile && (
              <s-button onPress={() => setEditingProfile(true)} kind="plain">
                {shopify.i18n.translate("loyalty.edit")}
              </s-button>
            )}
          </s-inline-stack>
          
          <s-card>
            {editingProfile ? (
              <s-stack spacing="base">
                <s-text>{shopify.i18n.translate("loyalty.editProfile")}</s-text>
                
                <s-text-field
                  label={shopify.i18n.translate("loyalty.phone")}
                  value={editFormData.phone || customerData?.phone || ""}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, phone: value }))}
                />
                
                <s-text-field
                  label={shopify.i18n.translate("loyalty.birthDate")}
                  value={editFormData.birthDate || customerData?.birthDate || ""}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, birthDate: value }))}
                  placeholder="YYYY-MM-DD"
                />
                
                <s-inline-stack spacing="tight">
                  <s-button onPress={() => {
                    setEditingProfile(false);
                    setEditFormData({});
                  }}>
                    {shopify.i18n.translate("loyalty.cancel")}
                  </s-button>
                  <s-button onPress={handleSaveProfile} kind="primary">
                    {shopify.i18n.translate("loyalty.save")}
                  </s-button>
                </s-inline-stack>
              </s-stack>
            ) : (
              <s-stack spacing="tight">
                <s-text>
                  <s-text emphasis="bold">{shopify.i18n.translate("loyalty.name")}:</s-text> {customerData?.firstName} {customerData?.lastName}
                </s-text>
                <s-text>
                  <s-text emphasis="bold">{shopify.i18n.translate("loyalty.email")}:</s-text> {customerData?.email}
                </s-text>
                {customerData?.phone && (
                  <s-text>
                    <s-text emphasis="bold">{shopify.i18n.translate("loyalty.phone")}:</s-text> {customerData.phone}
                  </s-text>
                )}
                {customerData?.birthDate ? (
                  <s-text>
                    <s-text emphasis="bold">{shopify.i18n.translate("loyalty.birthDate")}:</s-text> {customerData.birthDate}
                  </s-text>
                ) : (
                  <s-banner status="info">
                    <s-text>{shopify.i18n.translate("loyalty.addBirthDate")}</s-text>
                  </s-banner>
                )}
              </s-stack>
            )}
          </s-card>
        </s-stack>

        {/* Available Benefits Section */}
        <s-stack spacing="base">
          <s-heading level={2}>{shopify.i18n.translate("loyalty.benefits")}</s-heading>
          
          {redemptionSuccess && (
            <s-banner status="success">
              <s-stack spacing="tight">
                <s-text emphasis="bold">{redemptionSuccess.message}</s-text>
                {redemptionSuccess.discountCode && (
                  <s-text>
                    {shopify.i18n.translate("loyalty.discountCode")}: <s-text emphasis="bold">{redemptionSuccess.discountCode}</s-text>
                  </s-text>
                )}
              </s-stack>
            </s-banner>
          )}
          
          <s-stack spacing="base">
            {loyaltyData.benefits.map((benefit) => (
              <s-card key={benefit.id}>
                <s-stack spacing="tight">
                  <s-inline-stack spacing="base" blockAlignment="center">
                    <s-heading level={3}>{benefit.title}</s-heading>
                    {benefit.eligible ? (
                      <s-badge tone="success">{shopify.i18n.translate("loyalty.eligible")}</s-badge>
                    ) : (
                      <s-badge>{benefit.minPoints} {shopify.i18n.translate("loyalty.pointsRequired")}</s-badge>
                    )}
                  </s-inline-stack>
                  
                  <s-text>{benefit.description}</s-text>
                  
                  {benefit.eligible ? (
                    <s-button 
                      kind="primary" 
                      onPress={() => handleRedeem(benefit.id)}
                      disabled={redeeming === benefit.id}
                    >
                      {redeeming === benefit.id 
                        ? shopify.i18n.translate("loyalty.redeeming")
                        : `${shopify.i18n.translate("loyalty.redeem")} (${benefit.minPoints} ${shopify.i18n.translate("loyalty.points")})`
                      }
                    </s-button>
                  ) : (
                    <s-text size="small">
                      {shopify.i18n.translate("loyalty.needMorePoints", {
                        points: benefit.minPoints - loyaltyData.pointsBalance,
                      })}
                    </s-text>
                  )}
                </s-stack>
              </s-card>
            ))}
          </s-stack>
        </s-stack>

        {/* Recent Activity Section */}
        <s-stack spacing="base">
          <s-heading level={2}>{shopify.i18n.translate("loyalty.recentActivity")}</s-heading>
          
          <s-card>
            <s-stack spacing="tight">
              {loyaltyData.recentActivity.map((activity, index) => (
                <s-inline-stack key={index} spacing="base" blockAlignment="center">
                  <s-text emphasis="bold" appearance={activity.type === "earned" ? "success" : "subdued"}>
                    {activity.points > 0 ? "+" : ""}{activity.points} {shopify.i18n.translate("loyalty.points")}
                  </s-text>
                  <s-text>{activity.description}</s-text>
                  <s-text size="small" appearance="subdued">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </s-text>
                </s-inline-stack>
              ))}
            </s-stack>
          </s-card>
        </s-stack>
      </s-stack>
    </s-view>
  );

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
      
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (err) {
      console.error("Failed to redeem benefit:", err);
      alert(err instanceof Error ? err.message : "Failed to redeem benefit. Please try again.");
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
      alert(err instanceof Error ? err.message : "Failed to update profile. Please try again.");
    }
  }
}
