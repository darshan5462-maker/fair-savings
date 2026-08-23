export function homeRouteForRole(role: "ADMIN" | "MEMBER" | "BORROWER"): string {
  if (role === "ADMIN") return "/admin";
  if (role === "BORROWER") return "/borrower";
  return "/member";
}
