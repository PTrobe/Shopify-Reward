import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ThemeInstaller, type ThemeInstallResult } from "../services/theme.server";

interface ThemeAsset {
  key: string;
  value: string;
}

interface Theme {
  id: number;
  name: string;
  role: string;
}

// Get available themes
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

    return json({ themes });
  } catch (error) {
    console.error("Error fetching themes:", error);
    return json({ error: "Failed to fetch themes" }, { status: 500 });
  }
};

// Install theme blocks and assets
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const contentType = request.headers.get("content-type") || "";
    let actionType: string | null = null;
    let themeId: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      actionType = typeof body?.action === "string" ? body.action : null;
      themeId = typeof body?.themeId === "string" ? body.themeId : null;
    } else {
      const formData = await request.formData();
      const actionValue = formData.get("action");
      const themeValue = formData.get("themeId");
      actionType = typeof actionValue === "string" ? actionValue : null;
      themeId = typeof themeValue === "string" ? themeValue : null;
    }

    if (!themeId) {
      return json({ success: false, message: "Theme ID is required." }, { status: 400 });
    }

    const installer = new ThemeInstaller({
      admin,
      session,
      themeId: themeId as string,
    });

    switch (actionType) {
      case "install_header_block":
        return respondWithResult(await installer.installHeaderBlock());

      case "install_customer_page":
        return respondWithResult(await installer.installCustomerPage());

      case "install_all":
        return respondWithResult(await installer.installAll());

      case "uninstall":
        return respondWithResult(await installer.uninstallAll());

      default:
        return json({ success: false, message: "Invalid theme action." }, { status: 400 });
    }
  } catch (error) {
    console.error("Error managing theme:", error);
    return json({
      success: false,
      message: formatThemeError(error),
    });
  }
};

function formatThemeError(error: unknown): string {
  if (error instanceof Response) {
    return `Theme API responded with status ${error.status}.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    return String((error as any).message);
  }

  return "Unexpected error while installing loyalty blocks.";
}

function respondWithResult(result: ThemeInstallResult) {
  return json(result, { status: result.success ? 200 : 422 });
}
