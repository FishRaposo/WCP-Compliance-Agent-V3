// TODO: implement decision volume chart and approval rate summary.
export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Decisions", value: "—" },
          { label: "Approval Rate", value: "—" },
          { label: "Avg. Trust Score", value: "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
