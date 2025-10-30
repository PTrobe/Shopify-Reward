import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { SimpleSetupWizard } from "../components/setup/SimpleSetupWizard";
import { ThemeInstaller, type ThemeInstallResult } from "../services/theme.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
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

    return json({
      shop: session.shop,
      themes: [],
      error: "Unable to fetch themes. Please ensure the app has read_themes and write_themes permissions and reinstall if needed.",
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "launch") {
      return redirect("/app");
    }

    const actionType = formData.get("action");
    const themeId = formData.get("themeId");

    if (!themeId || typeof themeId !== "string") {
      return json({ success: false, message: "Theme ID is required." }, { status: 200 });
    }

    if (!actionType || typeof actionType !== "string") {
      return json({ success: false, message: "Theme action is required." }, { status: 200 });
    }

    const numericThemeId = Number(themeId);
    if (Number.isNaN(numericThemeId)) {
      return json({ 
        success: false, 
        message: "Invalid theme ID. Please ensure the app has read_themes and write_themes permissions. You may need to reinstall the app to grant these permissions." 
      }, { status: 200 });
    }

    const installer = new ThemeInstaller({ admin, session, themeId });

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

    return json({
      success: false,
      message: formatThemeError(error),
    }, { status: 200 });
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
