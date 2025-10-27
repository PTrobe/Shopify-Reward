import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { SimpleSetupWizard } from "../components/setup/SimpleSetupWizard";
import { ThemeInstaller, type ThemeInstallResult } from "../services/theme.server";
import {
  clearSetupProgress,
  loadSetupProgress,
  persistSetupProgress,
} from "../services/setupProgress.server";
import {
  enqueueThemeInstallJob,
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
} from "../services/themeInstallJob.server";

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

    const progress = await loadSetupProgress(session.shop);

    return json({
      shop: session.shop,
      themes,
      progress,
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
      progress: null,
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

  if (intent === "reset") {
    await clearSetupProgress(session.shop);
    return json({ success: true });
  }

  if (intent === "persist") {
    const step = Number(formData.get("currentStep") ?? 1);
    const serializedState = formData.get("state");
    let parsedState: Record<string, unknown> = {};

    if (typeof serializedState === "string" && serializedState.trim().length > 0) {
      try {
        parsedState = JSON.parse(serializedState);
      } catch (error) {
        console.warn("Failed to parse persisted setup state JSON", error);
      }
    }

    await persistSetupProgress({
      shopId: session.shop,
      currentStep: Number.isNaN(step) ? 1 : step,
      state: parsedState,
      installationStatus:
        typeof formData.get("installationStatus") === "string"
          ? (formData.get("installationStatus") as string)
          : undefined,
      installationMessage:
        typeof formData.get("installationMessage") === "string"
          ? (formData.get("installationMessage") as string)
          : undefined,
    });

    return json({ success: true });
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
  const existingProgress = await loadSetupProgress(session.shop);
  const stateSnapshot = (existingProgress?.persistedState ?? {}) as Record<string, unknown>;

  const job = await enqueueThemeInstallJob({
    shopId: session.shop,
    themeId,
    action: actionType,
  });

  await markJobRunning(job.id);

  await persistSetupProgress({
    shopId: session.shop,
    currentStep: existingProgress?.currentStep ?? 5,
    state: stateSnapshot,
    installationStatus: "running",
    installationMessage: "Installing loyalty blocks...",
  });

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

    if (result.success) {
      await markJobSucceeded(job.id);
    } else {
      await markJobFailed(job.id, result.message ?? "Installation failed");
    }

    await persistSetupProgress({
      shopId: session.shop,
      currentStep: existingProgress?.currentStep ?? 5,
      state: stateSnapshot,
      installationStatus: result.success ? "complete" : "error",
      installationMessage: result.message ?? null,
    });

    return json(
      {
        ...result,
        jobId: job.id,
        jobStatus: result.success ? "succeeded" : "failed",
      },
      { status: result.success ? 200 : 422 },
    );
  } catch (error) {
    const message = formatThemeError(error);

    console.error("Setup theme installation error:", {
      shop: session.shop,
      themeId,
      actionType,
      error,
    });

    await markJobFailed(job.id, message);
    await persistSetupProgress({
      shopId: session.shop,
      currentStep: existingProgress?.currentStep ?? 5,
      state: stateSnapshot,
      installationStatus: "error",
      installationMessage: message,
    });

    return json({
      success: false,
      message,
      jobId: job.id,
      jobStatus: "failed",
    });
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
