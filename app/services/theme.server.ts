import fs from "node:fs/promises";
import path from "node:path";

type AdminApi = any;

export type ThemeInstallResult = {
  success: boolean;
  message: string;
  details?: Record<string, any>;
};

interface InstallOptions {
  admin: AdminApi;
  session: any;
  themeId: string;
}

const HEADER_SNIPPET_KEY = "snippets/loyco-header-points.liquid";
const CUSTOMER_TEMPLATE_KEY = "templates/customers/loyalty.liquid";
const THEME_LAYOUT_KEY = "layout/theme.liquid";
const HEADER_MARKER_START = "{% comment %} Loyco Rewards header points start {% endcomment %}";
const HEADER_MARKER_END = "{% comment %} Loyco Rewards header points end {% endcomment %}";

const assetPath = (relativePath: string) =>
  path.resolve(process.cwd(), "app", "theme", relativePath);

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as any).message === "string") {
      return (error as any).message;
    }

    if ("response" in error && typeof (error as any).response === "object") {
      const response = (error as any).response;
      if (response?.errors) {
        return JSON.stringify(response.errors);
      }
      if (typeof response?.message === "string") {
        return response.message;
      }
      if (typeof response?.body === "string") {
        return response.body;
      }
    }
  }

  return String(error);
}

async function readAssetFromDisk(relativePath: string) {
  const filePath = assetPath(relativePath);

  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(
      `Missing theme asset "${relativePath}". Ensure the file exists at ${filePath}. (${extractErrorMessage(error)})`,
    );
  }
}

function assertValidThemeId(themeId: string) {
  const numericId = Number(themeId);
  if (Number.isNaN(numericId)) {
    throw new Error(`Invalid theme id "${themeId}"`);
  }
  return numericId;
}

async function fetchAsset(admin: AdminApi, session: any, themeId: string, key: string) {
  try {
    const numericThemeId = assertValidThemeId(themeId);

    const response = await admin.rest.resources.Asset.all({
      session,
      theme_id: numericThemeId,
      asset: { key },
    });

    return response?.data?.[0]?.value ?? null;
  } catch (error) {
    console.warn(`Loyco: unable to fetch asset ${key}`, error);
    return null;
  }
}

async function upsertAsset(
  admin: AdminApi,
  session: any,
  themeId: string,
  key: string,
  value: string,
) {
  console.log('[Loyco] About to save asset:', { themeId, key, hasAdmin: !!admin });

  const numericThemeId = Number(themeId);
  if (Number.isNaN(numericThemeId)) {
    throw new Error(`Invalid theme id "${themeId}"`);
  }

  const response = await admin.rest.put({
    session,
    path: `themes/${numericThemeId}/assets.json`,
    data: {
      asset: {
        key,
        value,
      },
    },
  });

  if (!response || response.status !== 200) {
    throw new Error(`Failed to save asset ${key}: ${response?.statusText || 'Unknown error'}`);
  }
}

async function backupAsset(
  admin: AdminApi,
  session: any,
  themeId: string,
  key: string,
  backupSuffix = ".loyco-backup",
) {
  const numericThemeId = assertValidThemeId(themeId);
  const existingValue = await fetchAsset(admin, session, themeId, key);
  if (!existingValue) {
    return;
  }

  const backupKey = `${key}${backupSuffix}`;
  const backupExists = await fetchAsset(admin, session, themeId, backupKey);
  if (backupExists) {
    return;
  }

  await upsertAsset(admin, session, themeId, backupKey, existingValue);
}

function injectHeaderSnippet(layout: string) {
  if (layout.includes(HEADER_MARKER_START)) {
    return layout;
  }

  const injectionBlock = [
    HEADER_MARKER_START,
    "{% render \"loyco-header-points\" %}",
    HEADER_MARKER_END,
  ].join("\n");

  const insertionPatterns = [
    /{%\s*section\s*['"]header['"]\s*%}/i,
    /{%\s*render\s*['"]header['"]\s*%}/i,
    /<\/header[^>]*>/i,
    /<\/nav[^>]*>/i,
    /<body[^>]*>/i,
  ];

  for (const pattern of insertionPatterns) {
    if (pattern.test(layout)) {
      return layout.replace(pattern, (match) => `${match}\n${injectionBlock}`);
    }
  }

  return `${injectionBlock}\n${layout}`;
}

function removeHeaderInjection(layout: string) {
  const markerRegex = new RegExp(
    `${HEADER_MARKER_START.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[\\s\\S]*?${HEADER_MARKER_END.replace(
      /[.*+?^${}()|[\\]\\\\]/g,
      "\\$&",
    )}`,
    "g",
  );
  return layout.replace(markerRegex, "").trim();
}

export class ThemeInstaller {
  private admin: AdminApi;
  private session: any;
  private themeId: string;

  constructor({ admin, session, themeId }: InstallOptions) {
    this.admin = admin;
    this.session = session;
    this.themeId = themeId;
  }

  async installHeaderBlock(): Promise<ThemeInstallResult> {
    try {
      const snippetContent = await readAssetFromDisk("snippets/loyco-header-points.liquid");
      await upsertAsset(this.admin, this.session, this.themeId, HEADER_SNIPPET_KEY, snippetContent);

      const layoutContent = await fetchAsset(
        this.admin,
        this.session,
        this.themeId,
        THEME_LAYOUT_KEY,
      );

      if (!layoutContent) {
        return {
          success: false,
          message: "Unable to locate layout/theme.liquid on the selected theme.",
        };
      }

      await backupAsset(this.admin, this.session, this.themeId, THEME_LAYOUT_KEY);

      const updatedLayout = injectHeaderSnippet(layoutContent);
      if (updatedLayout === layoutContent) {
        return {
          success: true,
          message: "Header block already installed.",
        };
      }

      await upsertAsset(this.admin, this.session, this.themeId, THEME_LAYOUT_KEY, updatedLayout);

      return {
        success: true,
        message: "Header block installed successfully.",
      };
    } catch (error) {
      throw new Error(`Failed to install header block: ${extractErrorMessage(error)}`);
    }
  }

  async installCustomerPage(): Promise<ThemeInstallResult> {
    try {
      const templateContent = await readAssetFromDisk("templates/customers.loyalty.liquid");
      await upsertAsset(
        this.admin,
        this.session,
        this.themeId,
        CUSTOMER_TEMPLATE_KEY,
        templateContent,
      );

      return {
        success: true,
        message: "Customer loyalty page installed successfully.",
      };
    } catch (error) {
      throw new Error(`Failed to install customer loyalty page: ${extractErrorMessage(error)}`);
    }
  }

  async installAll(): Promise<ThemeInstallResult> {
    try {
      console.log(`[Loyco] Installing loyalty blocks for theme ${this.themeId}`);

      const headerResult = await this.installHeaderBlock();
      console.log("[Loyco] Header block result:", headerResult);

      const pageResult = await this.installCustomerPage();
      console.log("[Loyco] Customer page result:", pageResult);

      const successes = [headerResult, pageResult].filter((result) => result.success);
      const errors = [headerResult, pageResult].filter((result) => !result.success);

      if (errors.length) {
        return {
          success: false,
          message: errors.map((error) => error.message).join(" "),
          details: { successes, errors },
        };
      }

      console.log("[Loyco] Loyalty blocks installed successfully.");
      return {
        success: true,
        message: "All loyalty blocks installed successfully.",
        details: { header: headerResult, customerPage: pageResult },
      };
    } catch (error) {
      throw new Error(`Failed to install loyalty blocks: ${extractErrorMessage(error)}`);
    }
  }

  async uninstallAll(): Promise<ThemeInstallResult> {
    try {
      const layoutContent = await fetchAsset(
        this.admin,
        this.session,
        this.themeId,
        THEME_LAYOUT_KEY,
      );

      if (layoutContent) {
        const cleanedLayout = removeHeaderInjection(layoutContent);
        await upsertAsset(this.admin, this.session, this.themeId, THEME_LAYOUT_KEY, cleanedLayout);
      }

      await Promise.all([
        this.deleteAssetSafely(HEADER_SNIPPET_KEY),
        this.deleteAssetSafely(CUSTOMER_TEMPLATE_KEY),
      ]);

      return {
        success: true,
        message: "Loyco Rewards blocks removed from theme.",
      };
    } catch (error) {
      throw new Error(`Failed to uninstall loyalty blocks: ${extractErrorMessage(error)}`);
    }
  }

  private async deleteAssetSafely(key: string) {
    try {
      const numericThemeId = assertValidThemeId(this.themeId);
      await this.admin.rest.resources.Asset.delete({
        session: this.session,
        theme_id: numericThemeId,
        asset: { key },
      });
    } catch (error) {
      console.warn(`Loyco: attempted to remove missing asset ${key}`, error);
    }
  }
}

export async function loadThemeName(admin: AdminApi, session: any, themeId: string) {
  const numericThemeId = assertValidThemeId(themeId);
  const theme = await admin.rest.resources.Theme.find({
    session,
    id: numericThemeId,
  });

  return theme?.data?.name ?? "Selected theme";
}
