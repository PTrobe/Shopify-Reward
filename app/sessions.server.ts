import { createCookieSessionStorage } from "@remix-run/node";

// Create session storage for setup wizard state
const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: "__loyco_setup_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "default-secret-change-in-production"],
    secure: process.env.NODE_ENV === "production",
  },
});

export { getSession, commitSession, destroySession };