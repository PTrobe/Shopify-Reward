import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useLocation } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  List,
  Button,
  ButtonGroup,
  Banner,
  Box,
  Toast,
  Frame,
  Badge,
  ProgressBar,
  Tabs,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    // Get shop information
    const response = await admin.rest.resources.Shop.all({ session });
    const shop = response.data[0];

    // Mock loyalty program data (in real app, this would come from database)
    const loyaltyData = {
      programStatus: 'active',
      totalMembers: 1247,
      pointsIssued: 45678,
      pointsRedeemed: 12340,
      revenueGenerated: 5432.50,
      conversionRate: 18.5,
      avgOrderValue: 67.80,
      topRewards: [
        { name: '$5 Off', redemptions: 156, pointsCost: 500 },
        { name: '10% Off', redemptions: 89, pointsCost: 1000 },
        { name: 'Free Shipping', redemptions: 234, pointsCost: 750 }
      ],
      recentActivity: [
        { customer: 'Sarah M.', action: 'Earned 50 points', time: '2 minutes ago' },
        { customer: 'John D.', action: 'Redeemed $5 off', time: '15 minutes ago' },
        { customer: 'Emma R.', action: 'Joined program', time: '1 hour ago' },
        { customer: 'Mike L.', action: 'Earned 100 points', time: '2 hours ago' }
      ]
    };

    return json({
      shop: session.shop,
      shopInfo: shop,
      loyaltyData,
    });
  } catch (error) {
    console.error("Error loading shop data:", error);
    // Return minimal data if shop API fails
    return json({
      shop: "Unknown Shop",
      shopInfo: null,
      loyaltyData: {
        programStatus: 'inactive',
        totalMembers: 0,
        pointsIssued: 0,
        pointsRedeemed: 0,
        revenueGenerated: 0,
        conversionRate: 0,
        avgOrderValue: 0,
        topRewards: [],
        recentActivity: []
      }
    });
  }
};

export default function App() {
  const { shop, shopInfo, loyaltyData } = useLoaderData<typeof loader>();
  const location = useLocation();
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastActive(true);
  };

  const handleViewReports = () => {
    showToast("Detailed reports feature coming soon!");
  };

  const handleManageSettings = () => {
    showToast("Settings management feature coming soon!");
  };

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'customers', content: 'Customers' },
    { id: 'rewards', content: 'Rewards' },
    { id: 'settings', content: 'Settings' }
  ];

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  const redemptionRate = loyaltyData.pointsIssued > 0 ? (loyaltyData.pointsRedeemed / loyaltyData.pointsIssued) * 100 : 0;

  return (
    <Frame>
      <Page
        title="Loyco Rewards Dashboard"
        subtitle={`Loyalty program for ${shop}`}
        primaryAction={
          loyaltyData.programStatus === 'active' ? (
            <ButtonGroup>
              <Button onClick={handleViewReports}>
                📊 View Reports
              </Button>
              <Button variant="primary" onClick={handleManageSettings}>
                ⚙️ Settings
              </Button>
            </ButtonGroup>
          ) : (
            <Button
              variant="primary"
              url={`/app/setup${location.search || ""}`}
            >
              🚀 Complete Setup
            </Button>
          )
        }
      >
        {/* Program Status Banner */}
        <Layout>
          <Layout.Section>
            {loyaltyData.programStatus === 'active' ? (
              <Banner title="🎉 Your loyalty program is live!" tone="success">
                <p>Customers are earning and redeeming points. Great job on building customer loyalty!</p>
              </Banner>
            ) : (
              <Banner title="⚠️ Complete your setup to activate your loyalty program" tone="warning">
                <p>Your loyalty program is configured but not yet active. Complete the setup to start engaging customers.</p>
              </Banner>
            )}
          </Layout.Section>

          {/* Key Metrics */}
          <Layout.Section>
            <Layout>
              <Layout.Section variant="oneThird">
                <Card>
                  <Box padding="400">
                    <div style={{ textAlign: 'center' }}>
                      <Text variant="headingLg" as="h2">
                        {loyaltyData.totalMembers.toLocaleString()}
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Total Members
                      </Text>
                      <Box paddingBlockStart="200">
                        <Badge tone={loyaltyData.totalMembers > 1000 ? 'success' : 'attention'}>
                          {loyaltyData.totalMembers > 1000 ? '🎯 Growing' : '📈 Building'}
                        </Badge>
                      </Box>
                    </div>
                  </Box>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                <Card>
                  <Box padding="400">
                    <div style={{ textAlign: 'center' }}>
                      <Text variant="headingLg" as="h2">
                        ${loyaltyData.revenueGenerated.toLocaleString()}
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Revenue Generated
                      </Text>
                      <Box paddingBlockStart="200">
                        <Badge tone="success">
                          💰 This Month
                        </Badge>
                      </Box>
                    </div>
                  </Box>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                <Card>
                  <Box padding="400">
                    <div style={{ textAlign: 'center' }}>
                      <Text variant="headingLg" as="h2">
                        {loyaltyData.conversionRate.toFixed(1)}%
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Conversion Rate
                      </Text>
                      <Box paddingBlockStart="200">
                        <Badge tone={loyaltyData.conversionRate > 15 ? 'success' : 'info'}>
                          📊 Performance
                        </Badge>
                      </Box>
                    </div>
                  </Box>
                </Card>
              </Layout.Section>
            </Layout>
          </Layout.Section>

          {/* Detailed Analytics */}
          <Layout.Section>
            <Card>
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  Program Analytics
                </Text>
                <Box paddingBlockStart="400">
                  <Layout>
                    <Layout.Section variant="twoThirds">
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text variant="bodyMd" as="p">Points Issued</Text>
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                              {loyaltyData.pointsIssued.toLocaleString()}
                            </Text>
                          </div>
                          <ProgressBar progress={(loyaltyData.pointsIssued / 50000) * 100} size="small" />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text variant="bodyMd" as="p">Points Redeemed</Text>
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                              {loyaltyData.pointsRedeemed.toLocaleString()}
                            </Text>
                          </div>
                          <ProgressBar progress={redemptionRate} size="small" />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text variant="bodyMd" as="p">Average Order Value</Text>
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                              ${loyaltyData.avgOrderValue.toFixed(2)}
                            </Text>
                          </div>
                          <ProgressBar progress={(loyaltyData.avgOrderValue / 100) * 100} size="small" />
                        </div>
                      </div>
                    </Layout.Section>

                    <Layout.Section variant="oneThird">
                      <Box paddingInlineStart="400">
                        <Text variant="headingSm" as="h3">
                          Top Performing Rewards
                        </Text>
                        <Box paddingBlockStart="300">
                          <div style={{ display: 'grid', gap: '12px' }}>
                            {loyaltyData.topRewards.map((reward, index) => (
                              <div key={index} style={{
                                padding: '12px',
                                background: '#f8f9fa',
                                borderRadius: '8px',
                                border: '1px solid #e9ecef'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                                    {reward.name}
                                  </Text>
                                  <Badge tone="info">
                                    {reward.redemptions}
                                  </Badge>
                                </div>
                                <Text variant="bodySm" tone="subdued" as="p">
                                  {reward.pointsCost} points • {reward.redemptions} redemptions
                                </Text>
                              </div>
                            ))}
                          </div>
                        </Box>
                      </Box>
                    </Layout.Section>
                  </Layout>
                </Box>
              </Box>
            </Card>
          </Layout.Section>

          {/* Recent Activity & Quick Actions */}
          <Layout.Section>
            <Layout>
              <Layout.Section variant="twoThirds">
                <Card>
                  <Box padding="400">
                    <Text variant="headingMd" as="h2">
                      Recent Activity
                    </Text>
                    <Box paddingBlockStart="400">
                      {loyaltyData.recentActivity.length > 0 ? (
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {loyaltyData.recentActivity.map((activity, index) => (
                            <div key={index} style={{
                              padding: '12px',
                              background: '#f8f9fa',
                              borderRadius: '8px',
                              borderLeft: '4px solid #007ace'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text variant="bodyMd" fontWeight="semibold" as="p">
                                  {activity.customer}
                                </Text>
                                <Text variant="bodySm" tone="subdued" as="p">
                                  {activity.time}
                                </Text>
                              </div>
                              <Text variant="bodyMd" as="p">
                                {activity.action}
                              </Text>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Text variant="bodyMd" tone="subdued" as="p">
                          No recent activity. Start your loyalty program to see customer interactions here.
                        </Text>
                      )}
                    </Box>
                  </Box>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                <Card>
                  <Box padding="400">
                    <Text variant="headingMd" as="h2">
                      Quick Actions
                    </Text>
                    <Box paddingBlockStart="400">
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <Button
                          variant="primary"
                          url={`/app/setup${location.search || ""}`}
                          fullWidth
                        >
                          🎯 Configure Program
                        </Button>
                        <Button onClick={() => showToast('Customer management coming soon!')} fullWidth>
                          👥 Manage Customers
                        </Button>
                        <Button onClick={() => showToast('Reward management coming soon!')} fullWidth>
                          🎁 Edit Rewards
                        </Button>
                        <Button onClick={() => showToast('Email campaigns coming soon!')} fullWidth>
                          📧 Send Campaign
                        </Button>
                        <Button onClick={handleViewReports} fullWidth>
                          📊 Export Reports
                        </Button>
                      </div>
                    </Box>
                  </Box>
                </Card>
              </Layout.Section>
            </Layout>
          </Layout.Section>
        </Layout>
        {toastMarkup}
      </Page>
    </Frame>
  );
}
