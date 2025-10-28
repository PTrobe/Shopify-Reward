import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { SimpleSetupWizard } from "../components/setup/SimpleSetupWizard";
import { ThemeInstaller, type ThemeInstallResult } from "../services/theme.server";
import { getSession, commitSession } from "../sessions.server";

// Session-based setup state interface
interface SetupState {
  currentStep: number;
  selectedTheme?: {
    id: string;
    name: string;
  };
  installationStatus?: "idle" | "running" | "complete" | "error";
  installationMessage?: string;
  completed?: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Get setup state from session
  const userSession = await getSession(request.headers.get("Cookie"));
  const setupState: SetupState = userSession.get("setupState") || {
    currentStep: 1,
    installationStatus: "idle",
  };

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
      setupState,
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
      setupState,
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const userSession = await getSession(request.headers.get("Cookie"));
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Handle navigation and state updates
  if (intent === "launch") {
    return redirect("/app");
  }

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

  // Handle theme installation
  const actionType = formData.get("action");
  const themeId = formData.get("themeId");
  const themeName = formData.get("themeName");

  if (!themeId || typeof themeId !== "string") {
    return json({ success: false, message: "Theme ID is required." }, { status: 400 });
  }

  if (!actionType || typeof actionType !== "string") {
    return json({ success: false, message: "Theme action is required." }, { status: 400 });
  }

  // Get current setup state
  const currentState: SetupState = userSession.get("setupState") || {
    currentStep: 1,
    installationStatus: "idle",
  };

  // Update state to show installation is running
  const runningState: SetupState = {
    ...currentState,
    selectedTheme: { id: themeId, name: themeName as string || "Selected theme" },
    installationStatus: "running",
    installationMessage: "Installing loyalty blocks...",
  };
  userSession.set("setupState", runningState);

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

    // Update state with installation result
    const finalState: SetupState = {
      ...runningState,
      installationStatus: result.success ? "complete" : "error",
      installationMessage: result.message,
      completed: result.success,
    };
    userSession.set("setupState", finalState);

    return json(
      {
        ...result,
        setupState: finalState,
      },
      {
        status: result.success ? 200 : 422,
        headers: {
          "Set-Cookie": await commitSession(userSession),
        },
      }
    );
  } catch (error) {
    const message = formatThemeError(error);

    console.error("Setup theme installation error:", {
      shop: session.shop,
      themeId,
      actionType,
      error,
    });

    // Update state with error
    const errorState: SetupState = {
      ...runningState,
      installationStatus: "error",
      installationMessage: message,
    };
    userSession.set("setupState", errorState);

    return json(
      {
        success: false,
        message,
        setupState: errorState,
      },
      {
        status: 500,
        headers: {
          "Set-Cookie": await commitSession(userSession),
        },
      }
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