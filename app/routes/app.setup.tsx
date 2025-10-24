import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
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
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "launch") {
    return redirect("/app");
  }

  return json({ success: false, message: "Unsupported setup action." }, { status: 400 });
};

export default function Setup() {
  return <SimpleSetupWizard />;
}
