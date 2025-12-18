import { context } from "@botpress/runtime";

/**
 * Get the current user ID from context.
 * Returns "anonymous" if no user is available.
 */
export function getCurrentUserId(): string {
  const user = context.get("user");
  return user?.id || "anonymous";
}
