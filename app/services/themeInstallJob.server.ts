import { prisma } from "../lib/prisma.server";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export async function enqueueThemeInstallJob({
  shopId,
  themeId,
  action,
  payload,
}: {
  shopId: string;
  themeId: string;
  action: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.themeInstallJob.create({
    data: {
      shopId,
      themeId,
      action,
      status: "queued",
      payload,
    },
  });
}

export async function markJobRunning(jobId: string) {
  return prisma.themeInstallJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: new Date(),
    },
  });
}

export async function markJobSucceeded(jobId: string) {
  return prisma.themeInstallJob.update({
    where: { id: jobId },
    data: {
      status: "succeeded",
      completedAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function markJobFailed(jobId: string, message: string) {
  return prisma.themeInstallJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage: message,
    },
  });
}

export function findJob(jobId: string) {
  return prisma.themeInstallJob.findUnique({ where: { id: jobId } });
}
