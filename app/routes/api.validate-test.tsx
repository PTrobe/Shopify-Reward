import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { validateRequestBody, earnPointsSchema, redeemPointsSchema } from "../lib/validation";
import { formatErrorResponse } from "../lib/errors";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { testType, data } = body;

    let result;

    switch (testType) {
      case 'earnPoints':
        result = validateRequestBody(earnPointsSchema, data);
        break;
      case 'redeemPoints':
        result = validateRequestBody(redeemPointsSchema, data);
        break;
      default:
        throw new Error('Invalid test type');
    }

    return json({
      success: true,
      message: 'Validation passed',
      validatedData: result
    });

  } catch (error) {
    const errorResponse = formatErrorResponse(error as Error);
    return json(errorResponse, { status: errorResponse.statusCode });
  }
};