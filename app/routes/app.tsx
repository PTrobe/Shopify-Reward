import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);

    return json({
      shop: session.shop,
      authenticated: true,
    });
  } catch (error) {
    // If authentication fails, let the auth system handle it
    console.error("Authentication error:", error);
    throw error;
  }
};

export default function App() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <AppProvider
      i18n={{
        Polaris: {
          Avatar: {
            label: 'Avatar',
            labelWithInitials: 'Avatar with initials {initials}',
          },
          ContextualSaveBar: {
            save: 'Save',
            discard: 'Discard',
          },
          TextField: {
            characterCount: '{count} characters',
          },
          TopBar: {
            toggleMenuLabel: 'Toggle menu',
            SearchField: {
              clearButtonLabel: 'Clear',
              search: 'Search',
            },
          },
          Modal: {
            iFrameTitle: 'body markup',
          },
          Frame: {
            skipToContent: 'Skip to content',
            Navigation: {
              closeMobileNavigationLabel: 'Close navigation',
            },
          },
        },
      }}
    >
      <Outlet />
    </AppProvider>
  );
}