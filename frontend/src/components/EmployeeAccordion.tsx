import * as Accordion from "@radix-ui/react-accordion";

interface Employee {
  name: string;
  trade: string;
  hours_worked?: number;
  hourly_wage?: number;
  fringe_benefits?: number;
  gross_earnings?: number;
  deductions?: number;
  net_wages?: number;
}

interface Props {
  employees: Employee[];
}

export default function EmployeeAccordion({ employees }: Props) {
  if (employees.length === 0) {
    return <p className="text-sm text-gray-400">No employee data.</p>;
  }

  return (
    <Accordion.Root type="multiple" className="space-y-2">
      {employees.map((emp, i) => (
        <Accordion.Item
          key={i}
          value={`employee-${i}`}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          <Accordion.Trigger className="w-full flex justify-between items-center px-4 py-3 text-left hover:bg-gray-50 transition-colors">
            <span className="font-medium text-sm text-gray-900">{emp.name}</span>
            <span className="text-xs text-gray-500">{emp.trade}</span>
          </Accordion.Trigger>
          <Accordion.Content className="px-4 pb-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Hours</p>
                <p className="font-mono text-gray-700">{emp.hours_worked ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Hourly Wage</p>
                <p className="font-mono text-gray-700">{emp.hourly_wage != null ? `$${emp.hourly_wage.toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Fringe</p>
                <p className="font-mono text-gray-700">{emp.fringe_benefits != null ? `$${emp.fringe_benefits.toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Gross</p>
                <p className="font-mono text-gray-700">{emp.gross_earnings != null ? `$${emp.gross_earnings.toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Deductions</p>
                <p className="font-mono text-gray-700">{emp.deductions != null ? `$${emp.deductions.toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Net</p>
                <p className="font-mono text-gray-700">{emp.net_wages != null ? `$${emp.net_wages.toFixed(2)}` : "—"}</p>
              </div>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
