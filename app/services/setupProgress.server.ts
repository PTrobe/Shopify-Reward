import { prisma } from "../lib/prisma.server";

interface PersistSetupStateInput {
  shopId: string;
  currentStep: number;
  state: Record<string, unknown>;
  installationStatus?: string;
  installationMessage?: string | null;
}

export async function loadSetupProgress(shopId: string) {
  // shopId is actually shopifyDomain, we need to find the actual Shop record first
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopId },
  });

  if (!shop) {
    return null;
  }

  return prisma.setupProgress.findUnique({
    where: { shopId: shop.id },
  });
}

export async function persistSetupProgress({
  shopId,
  currentStep,
  state,
  installationStatus,
  installationMessage,
}: PersistSetupStateInput) {
  // shopId is actually shopifyDomain, we need to find the actual Shop record
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopId },
  });

  if (!shop) {
    throw new Error(`Shop not found for domain: ${shopId}`);
  }

  return prisma.setupProgress.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      currentStep,
      persistedState: state,
      installationStatus: installationStatus ?? "pending",
      installationMessage: installationMessage ?? null,
    },
    update: {
      currentStep,
      persistedState: state,
      installationStatus: installationStatus ?? undefined,
      installationMessage:
        installationMessage === undefined ? undefined : installationMessage,
    },
  });
}

export async function clearSetupProgress(shopId: string) {
  // shopId is actually shopifyDomain, we need to find the actual Shop record
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopId },
  });

  if (!shop) {
    return; // Nothing to clear if shop doesn't exist
  }

  await prisma.setupProgress.deleteMany({
    where: { shopId: shop.id },
  });
}
