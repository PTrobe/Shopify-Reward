import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { SimpleSetupWizard } from "../components/setup/SimpleSetupWizard";
import { ThemeInstaller, type ThemeInstallResult } from "../services/theme.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    // Fetch themes server-side where authentication works properly
    const themesResponse = await admin.rest.resources.Theme.all({
      session,
    });

    const themes = themesResponse.data.map((theme: any) => ({
      id: String(theme.id),
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

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "launch") {
    return redirect("/app");
  }

  const actionType = formData.get("action");
  const themeId = formData.get("themeId");

  if (!themeId || typeof themeId !== "string") {
    return json({ success: false, message: "Theme ID is required." }, { status: 400 });
  }

  if (!actionType || typeof actionType !== "string") {
    return json({ success: false, message: "Theme action is required." }, { status: 400 });
  }

  const installer = new ThemeInstaller({ admin, session, themeId });

  try {
    let result: ThemeInstallResult;

    switch (actionType) {
      case "install_header_block":
        result = await installer.installHeaderBlock();
        break;
      case "install_customer_page":
        result = await installer.installCustomerPage();
        break;
      case "install_all":
        result = await installer.installAll();
        break;
      case "uninstall":
        result = await installer.uninstallAll();
        break;
      default:
        return json({ success: false, message: "Unsupported theme action." }, { status: 400 });
    }

    return json(result, { status: result.success ? 200 : 422 });
  } catch (error) {
    console.error("Setup theme installation error:", error);
    return json(
      {
        success: false,
        message: formatThemeError(error),
      },
      { status: 500 },
    );
  }
};

function formatThemeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Unexpected error while installing loyalty blocks.";
}

export default function Setup() {
  return <SimpleSetupWizard />;
}
