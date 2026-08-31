import Link from "next/link";

const OPTIONS = ["all", "running", "completed", "failed"];

export function RunFilters({ current }: { current: string }) {
  return (
    <div className="mb-4 flex gap-2 text-sm">
      {OPTIONS.map((opt) => (
        <Link
          key={opt}
          href={opt === "all" ? "/runs" : `/runs?status=${opt}`}
          className={`rounded-full px-3 py-1 ${opt === current ? "bg-accent text-accent-foreground" : "bg-surface text-muted hover:text-foreground"}`}
        >
          {opt}
        </Link>
      ))}
    </div>
  );
}
