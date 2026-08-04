"use client";

import { DocumentTextIcon, TableCellsIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ReportsPage() {
  const { t } = useLanguage();

  return (
    <>
      <Navbar title={t("reports")} />
      <main className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div className="glass-card p-6">
          <TableCellsIcon className="h-8 w-8 text-brand-500" />
          <h3 className="mt-3 font-display font-semibold">Collection Report (Excel)</h3>
          <p className="mt-1 text-sm text-ink-500">Every weekly collection record across all members, exportable as .xlsx.</p>
          <a href={`${API_URL}/reports/collections.xlsx`} target="_blank" rel="noreferrer" className="btn-secondary mt-4 inline-flex">
            Download Excel
          </a>
        </div>

        <div className="glass-card p-6">
          <DocumentTextIcon className="h-8 w-8 text-brand-500" />
          <h3 className="mt-3 font-display font-semibold">Member Statement (PDF)</h3>
          <p className="mt-1 text-sm text-ink-500">
            Open a member's profile from the Members page and use "Download Statement", or fetch directly:
          </p>
          <code className="mt-2 block rounded-lg bg-ink-900/5 p-2 text-xs dark:bg-white/5">
            GET /api/reports/member/:id/statement.pdf
          </code>
        </div>

        <div className="glass-card p-6 sm:col-span-2">
          <h3 className="font-display font-semibold">Coming soon</h3>
          <p className="mt-1 text-sm text-ink-500">
            Savings Report, Loan Report, and Yearly Report follow the same PDF/Excel pattern as above — add routes in{" "}
            <code>backend/src/routes/reports.routes.ts</code> using the existing PDFKit/ExcelJS setup.
          </p>
        </div>
      </main>
    </>
  );
}
