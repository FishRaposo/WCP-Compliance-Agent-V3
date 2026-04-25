import type { Citation } from "../types/api.ts";

interface Props {
  citations: Citation[];
  traceId?: string;
}

export default function AuditTrail({ citations, traceId }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Regulation Citations</p>
      <ul className="space-y-1">
        {citations.map((c, i) => (
          <li key={i} className="text-xs text-gray-600">
            <span className="font-mono bg-gray-100 px-1 rounded">{c.regulation}</span>
            {c.section && <span className="ml-1 text-gray-400">§ {c.section}</span>}
          </li>
        ))}
      </ul>
      {traceId && (
        <p className="text-xs text-gray-400">
          Trace: <span className="font-mono">{traceId}</span>
        </p>
      )}
    </div>
  );
}
