import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    // Get shop information
    const response = await admin.rest.resources.Shop.all({ session });
    const shop = response.data[0];

    return json({
      shop: session.shop,
      shopInfo: shop,
    });
  } catch (error) {
    console.error("Error loading shop data:", error);
    // Return minimal data if shop API fails
    return json({
      shop: "Unknown Shop",
      shopInfo: null,
    });
  }
};

export default function App() {
  const { shop, shopInfo } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Loyco Rewards"
      subtitle={`Loyalty program for ${shop}`}
      primaryAction={
        <Button variant="primary">
          Launch Program
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Banner title="Welcome to Loyco Rewards!" tone="success">
            <p>Your loyalty program is ready to be configured. Follow the quick setup steps below to get started.</p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h2">
                Quick Setup
              </Text>
              <Box paddingBlockStart="300">
                <Text variant="bodyMd" color="subdued">
                  Get started with your loyalty program in just a few minutes:
                </Text>
              </Box>
              <Box paddingBlockStart="400">
                <List type="number">
                  <List.Item>Configure your points system</List.Item>
                  <List.Item>Set up rewards</List.Item>
                  <List.Item>Customize your widget</List.Item>
                  <List.Item>Launch your program</List.Item>
                </List>
              </Box>
              <Box paddingBlockStart="500">
                <ButtonGroup>
                  <Button variant="primary">
                    Start Setup
                  </Button>
                  <Button>
                    View Documentation
                  </Button>
                </ButtonGroup>
              </Box>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h2">
                Shop Information
              </Text>
              <Box paddingBlockStart="300">
                {shopInfo ? (
                  <List>
                    <List.Item><strong>Name:</strong> {shopInfo.name}</List.Item>
                    <List.Item><strong>Domain:</strong> {shopInfo.myshopify_domain}</List.Item>
                    <List.Item><strong>Owner:</strong> {shopInfo.shop_owner}</List.Item>
                    <List.Item><strong>Currency:</strong> {shopInfo.currency}</List.Item>
                    <List.Item><strong>Plan:</strong> {shopInfo.plan_display_name}</List.Item>
                  </List>
                ) : (
                  <Text variant="bodyMd" color="subdued">
                    Unable to load shop information
                  </Text>
                )}
              </Box>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}