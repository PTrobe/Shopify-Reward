import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Layout, Page, Card, Text, Box } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return json({
    shop: session.shop,
  });
};

export default function Setup() {
  return (
    <Page
      title="Program Setup"
      subtitle="Walk through the key steps to configure Loyco Rewards for your shop."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h2">
                Coming soon
              </Text>
              <Box paddingBlockStart="300">
                <Text tone="subdued" as="p">
                  We&apos;re still building out the guided setup experience. In the meantime,
                  you can manage your loyalty program from the dashboard sections.
                </Text>
              </Box>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
