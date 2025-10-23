import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { SimpleSetupWizard } from "../components/setup/SimpleSetupWizard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    // Fetch themes server-side where authentication works properly
    const themesResponse = await admin.rest.resources.Theme.all({
      session,
    });

    const themes = themesResponse.data.map((theme: any) => ({
      id: theme.id,
      name: theme.name,
      role: theme.role,
    }));

    return json({
      shop: session.shop,
      themes,
    });
  } catch (error) {
    console.error("Error fetching themes in setup loader:", error);
    // Return fallback themes if API fails
    return json({
      shop: session.shop,
      themes: [
        { id: 'dawn', name: 'Dawn', role: 'main' },
        { id: 'refresh', name: 'Refresh', role: 'unpublished' },
      ],
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const actionType = formData.get("action");
    const themeId = formData.get("themeId");

    if (actionType === "install_all" && themeId) {
      // Use the theme service directly
      const { installAll } = await import("../services/theme.server");

      const result = await installAll(admin, session, String(themeId));

      if (result.success) {
        return json({
          success: true,
          message: result.message,
        });
      } else {
        return json({
          success: false,
          error: result.error,
        }, { status: 400 });
      }
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Setup action error:", error);
    return json({
      success: false,
      error: "Installation failed: " + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
};

export default function Setup() {
  return <SimpleSetupWizard />;
}
