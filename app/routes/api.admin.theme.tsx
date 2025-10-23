import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ThemeInstaller } from "../services/theme.server";

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
      id: theme.id,
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
    const formData = await request.formData();
    const action = formData.get("action");
    const themeId = formData.get("themeId");

    if (!themeId) {
      return json({ error: "Theme ID is required" }, { status: 400 });
    }

    const installer = new ThemeInstaller({
      admin,
      session,
      themeId: themeId as string,
    });

    switch (action) {
      case "install_header_block":
        return json(await installer.installHeaderBlock());

      case "install_customer_page":
        return json(await installer.installCustomerPage());

      case "install_all":
        return json(await installer.installAll());

      case "uninstall":
        return json(await installer.uninstallAll());

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error managing theme:", error);
    return json({ error: "Failed to manage theme" }, { status: 500 });
  }
};
