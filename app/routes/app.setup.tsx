import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { SimpleSetupWizard } from "../components/setup/SimpleSetupWizard";
import { getSession, commitSession } from "../sessions.server";

// Session-based setup state interface
interface SetupState {
  currentStep: number;
  completed?: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get setup state from session
  const userSession = await getSession(request.headers.get("Cookie"));
  const setupState: SetupState = userSession.get("setupState") || {
    currentStep: 1,
  };

  return json({
    shop: session.shop,
    setupState,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const formData = await request.formData();
    const intent = formData.get("intent");

    // Handle launch intent before authentication (no admin context needed)
    if (intent === "launch") {
      return redirect("/app");
    }

    const { session } = await authenticate.admin(request);
    const userSession = await getSession(request.headers.get("Cookie"));

    if (intent === "reset") {
      userSession.unset("setupState");
      return json(
        { success: true },
        {
          headers: {
            "Set-Cookie": await commitSession(userSession),
          },
        }
      );
    }

    if (intent === "updateState") {
      const stateJson = formData.get("state");
      if (typeof stateJson === "string") {
        try {
          const newState: SetupState = JSON.parse(stateJson);
          userSession.set("setupState", newState);
          return json(
            { success: true },
            {
              headers: {
                "Set-Cookie": await commitSession(userSession),
              },
            }
          );
        } catch (error) {
          console.warn("Failed to parse setup state JSON", error);
          return json({ success: false, message: "Invalid state data" }, { status: 400 });
        }
      }
      return json({ success: false, message: "State data required" }, { status: 400 });
    }

    // For any other actions, just return success
    // Theme App Extensions are automatically deployed via Shopify CLI
    return json({ success: true, message: "Theme App Extensions are automatically available" });
  } catch (error) {
    console.error("Setup action error:", error);
    return json({
      success: false,
      message: "An error occurred during setup",
    }, { status: 500 });
  }
};


export default function Setup() {
  return <SimpleSetupWizard />;
}
