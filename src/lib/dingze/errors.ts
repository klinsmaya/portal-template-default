export function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) return String((error as Error).message);
  return "操作失败，请稍后重试";
}
