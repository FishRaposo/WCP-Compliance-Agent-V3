import { usePromptVersions } from "../hooks/usePromptVersions.ts";

// TODO: implement full settings panel with prompt version selector and model picker.
export default function SettingsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-gray-700">Prompt Version</label>
        <p className="text-xs text-gray-400 mt-1">Connect Langfuse to enable prompt version selection.</p>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Model</label>
        <p className="text-xs text-gray-400 mt-1">gpt-4o-mini (default)</p>
      </div>
    </div>
  );
}
