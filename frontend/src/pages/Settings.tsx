import SettingsPanel from "../components/SettingsPanel.tsx";

export default function Settings() {
  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
      <SettingsPanel />
    </div>
  );
}
