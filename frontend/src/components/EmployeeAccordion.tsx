// TODO: implement multi-employee accordion using Radix Accordion.

interface Employee {
  name: string;
  trade: string;
  verdict: string;
  trust_score: number;
}

interface Props {
  employees: Employee[];
}

export default function EmployeeAccordion({ employees }: Props) {
  return (
    <div className="space-y-2">
      {employees.map((emp, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between">
            <span className="font-medium text-sm">{emp.name}</span>
            <span className="text-xs text-gray-500">{emp.trade}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
