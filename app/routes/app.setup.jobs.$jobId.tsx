import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { findJob } from "../services/themeInstallJob.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const jobId = params.jobId;

  if (!jobId) {
    return json({ error: "Job ID is required" }, { status: 400 });
  }

  const job = await findJob(jobId);

  if (!job || job.shopId !== session.shop) {
    return json({ error: "Job not found" }, { status: 404 });
  }

  return json({
    id: job.id,
    status: job.status,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
};
