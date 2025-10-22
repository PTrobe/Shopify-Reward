import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  ButtonGroup,
  List,
  Box,
  Select,
  Toast,
  Frame,
  Banner,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const themesResponse = await admin.rest.resources.Theme.all({
      session,
    });

    const themes = themesResponse.data.map((theme: { id: number; name: string; role: string }) => ({
      id: theme.id.toString(),
      name: theme.name,
      role: theme.role,
    }));

    return json({
      themes,
      shop: session.shop,
    });
  } catch (error) {
    console.error("Error fetching themes:", error);
    return json({ themes: [], shop: session.shop });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get("action");
  const themeId = formData.get("themeId");

  // Forward to our theme API
  const themeRequest = new Request(`${new URL(request.url).origin}/api/admin/theme`, {
    method: "POST",
    body: formData,
    headers: request.headers,
  });

  const response = await fetch(themeRequest);
  const result = await response.json();

  return json(result);
};

export default function ThemeManager() {
  const { themes, shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [selectedTheme, setSelectedTheme] = useState(
    themes.find((theme: { id: string; name: string; role: string }) => theme.role === "main")?.id || themes[0]?.id || ""
  );
  const [isLoading, setIsLoading] = useState(false);

  const themeOptions = themes.map((theme: { id: string; name: string; role: string }) => ({
    label: `${theme.name} ${theme.role === "main" ? "(Published)" : ""}`,
    value: theme.id,
  }));

  const handleInstall = (action: string) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("action", action);
    formData.append("themeId", selectedTheme);

    submit(formData, { method: "post" });
    setTimeout(() => setIsLoading(false), 2000);
  };

  const selectedThemeData = themes.find((theme: { id: string; name: string; role: string }) => theme.id === selectedTheme);

  return (
    <Frame>
      <Page
        title="Theme Management"
        subtitle="Install loyalty blocks directly to your theme"
        backAction={{ content: "Dashboard", url: "/app" }}
      >
        <Layout>
          <Layout.Section>
            {actionData?.error && (
              <Banner title="Error" tone="critical">
                <p>{actionData.error}</p>
              </Banner>
            )}

            {actionData?.success && (
              <Banner title="Success" tone="success">
                <p>{actionData.message}</p>
              </Banner>
            )}
          </Layout.Section>

          <Layout.Section>
            <Card>
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  Select Theme
                </Text>
                <Box paddingBlockStart="300">
                  <Select
                    label="Choose theme to modify"
                    options={themeOptions}
                    value={selectedTheme}
                    onChange={setSelectedTheme}
                  />
                </Box>

                {selectedThemeData && (
                  <Box paddingBlockStart="400">
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Selected: <strong>{selectedThemeData.name}</strong>{" "}
                      {selectedThemeData.role === "main" && "(Published Theme)"}
                    </Text>
                  </Box>
                )}
              </Box>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  Header Points Block
                </Text>
                <Box paddingBlockStart="300">
                  <Text variant="bodyMd" tone="subdued" as="p">
                    Compact loyalty points display for your header. Shows a star icon with points count.
                  </Text>
                </Box>

                <Box paddingBlockStart="400">
                  <List type="bullet">
                    <List.Item>Compact design perfect for headers</List.Item>
                    <List.Item>Shows star ★ icon + points number only</List.Item>
                    <List.Item>Responsive for mobile devices</List.Item>
                    <List.Item>Automatically loads customer points</List.Item>
                  </List>
                </Box>

                <Box paddingBlockStart="400">
                  <ButtonGroup>
                    <Button
                      variant="primary"
                      loading={isLoading}
                      onClick={() => handleInstall("install_header_block")}
                    >
                      Install Header Block
                    </Button>
                    <Button
                      onClick={() => window.open("https://help.shopify.com/en/manual/online-store/themes/theme-structure/extend/apps#add-app-blocks", "_blank")}
                    >
                      View Instructions
                    </Button>
                  </ButtonGroup>
                </Box>

                <Box paddingBlockStart="400">
                  <Text variant="bodySm" tone="subdued" as="p">
                    After installation, go to your theme editor and add the "Loyco Header Points" block to your header section.
                  </Text>
                </Box>
              </Box>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  Customer Loyalty Page
                </Text>
                <Box paddingBlockStart="300">
                  <Text variant="bodyMd" tone="subdued" as="p">
                    Dedicated page where customers can view their loyalty points and status.
                  </Text>
                </Box>

                <Box paddingBlockStart="400">
                  <List type="bullet">
                    <List.Item>Clean points display with star icon</List.Item>
                    <List.Item>Accessible at /pages/loyalty</List.Item>
                    <List.Item>Automatically loads customer data</List.Item>
                    <List.Item>Login prompt for non-authenticated users</List.Item>
                  </List>
                </Box>

                <Box paddingBlockStart="400">
                  <Button
                    loading={isLoading}
                    onClick={() => handleInstall("install_customer_page")}
                  >
                    Install Customer Page
                  </Button>
                </Box>
              </Box>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  Bulk Actions
                </Text>
                <Box paddingBlockStart="300">
                  <ButtonGroup>
                    <Button
                      variant="primary"
                      loading={isLoading}
                      onClick={() => handleInstall("install_all")}
                    >
                      Install All Blocks
                    </Button>
                    <Button
                      variant="secondary"
                      tone="critical"
                      loading={isLoading}
                      onClick={() => handleInstall("uninstall")}
                    >
                      Remove All Blocks
                    </Button>
                  </ButtonGroup>
                </Box>

                <Box paddingBlockStart="400">
                  <Text variant="bodySm" tone="subdued" as="p">
                    Install all loyalty blocks at once, or remove all blocks if you need to uninstall the app.
                  </Text>
                </Box>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}