import { prisma } from "../lib/prisma.server";

interface PersistSetupStateInput {
  shopId: string;
  currentStep: number;
  state: Record<string, unknown>;
  installationStatus?: string;
  installationMessage?: string | null;
}

export async function loadSetupProgress(shopId: string) {
  return prisma.setupProgress.findUnique({
    where: { shopId },
  });
}

export async function persistSetupProgress({
  shopId,
  currentStep,
  state,
  installationStatus,
  installationMessage,
}: PersistSetupStateInput) {
  return prisma.setupProgress.upsert({
    where: { shopId },
    create: {
      shopId,
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
  await prisma.setupProgress.deleteMany({
    where: { shopId },
  });
}
