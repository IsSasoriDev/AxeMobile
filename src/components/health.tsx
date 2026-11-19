import { ArrowUpCircle, CheckCircle2 } from "lucide-react";
import { openExternal, type FirmwareUpdate, type Issue, type MinerHealth } from "@/api";
import { num } from "@/format";

export const levelTone = (l: string) => (l === "bad" ? "bad" : l === "warn" ? "warn" : "good");

/** Score out of 100, coloured by the worst problem. */
export function ScoreBadge({ h }: { h: MinerHealth | undefined }) {
  if (!h) return <span className="meta">–</span>;
  return (
    <span className={`score ${levelTone(h.level)}`} title={h.issues.filter((i) => i.level !== "info").map((i) => i.title).join(", ") || "No problems"}>
      {h.score}
    </span>
  );
}

export function IssueList({ issues, empty = "No problems found." }: { issues: Issue[]; empty?: string }) {
  if (!issues.length) {
    return (
      <div className="allgood">
        <CheckCircle2 size={18} /> {empty}
      </div>
    );
  }
  return (
    <ul className="issues">
      {issues.map((i) => (
        <li key={i.code + i.title} className={`lv-${i.level}`}>
          <i />
          <div>
            <b>{i.title}</b>
            <span>{i.detail}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function UpdateTag({ u }: { u: FirmwareUpdate | null | undefined }) {
  if (!u) return null;
  return (
    <button
      type="button"
      className="tag upd"
      title={`${u.latest} is out. Opens the release notes.`}
      onClick={(e) => {
        e.stopPropagation();
        openExternal(u.url);
      }}
    >
      <ArrowUpCircle size={11} /> {u.latest}
    </button>
  );
}

export const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "–" : `${num(v * 100, d)}%`);

export const availTone = (v: number | null | undefined) => (v === null || v === undefined ? "dim" : v >= 0.99 ? "good" : v >= 0.95 ? "warn" : "bad");
