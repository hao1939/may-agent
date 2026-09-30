/** Reporting and Task control must address the same Host installation. */
export function hostReportUrl(path: string): URL {
  return new URL(
    path,
    process.env.MAY_REPORT_BASE_URL?.trim() || "http://localhost:8080",
  );
}
