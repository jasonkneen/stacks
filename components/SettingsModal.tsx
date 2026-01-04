import React, { useState } from 'react';
import { X, Settings, Palette, Zap, Grid3x3, Eye, Key, Cpu, Monitor, Server, Sliders } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type SettingsTab = 'general' | 'providers' | 'models' | 'display' | 'mcp';

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [autoSave, setAutoSave] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [autoArrangeNew, setAutoArrangeNew] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('light');

  const sectionClass = "space-y-4";
  const labelClass = "text-sm font-medium text-gray-700 flex items-center gap-2";
  const toggleClass = "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";
  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void }> = ({ enabled, onChange }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`${toggleClass} ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  const tabs = [
    { id: 'general' as SettingsTab, label: 'General', icon: <Sliders size={16} /> },
    { id: 'providers' as SettingsTab, label: 'Providers', icon: <Key size={16} /> },
    { id: 'models' as SettingsTab, label: 'Models', icon: <Cpu size={16} /> },
    { id: 'display' as SettingsTab, label: 'Display', icon: <Monitor size={16} /> },
    { id: 'mcp' as SettingsTab, label: 'MCP Servers', icon: <Server size={16} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[85vh] flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Side Tabs */}
        <div className="w-48 bg-gray-50 border-r border-gray-200 p-4 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-4 mb-4">
            <Settings size={20} className="text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          </div>

          <div className="flex-1 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-3 py-2.5 text-sm font-medium transition-all flex items-center gap-2 rounded-xl text-left ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {tabs.find(t => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className={sectionClass}>
              <div className="flex items-center justify-between py-2">
                <label className={labelClass}>
                  <Zap size={16} className="text-gray-500" />
                  Auto-save changes
                </label>
                <Toggle enabled={autoSave} onChange={setAutoSave} />
              </div>

              <div className="flex items-center justify-between py-2">
                <label className={labelClass}>
                  <Eye size={16} className="text-gray-500" />
                  Enable animations
                </label>
                <Toggle enabled={animationsEnabled} onChange={setAnimationsEnabled} />
              </div>

              <div className="flex items-center justify-between py-2">
                <label className={labelClass}>
                  <Grid3x3 size={16} className="text-gray-500" />
                  Auto-arrange new items
                </label>
                <Toggle enabled={autoArrangeNew} onChange={setAutoArrangeNew} />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Workspace Name</p>
                <input
                  type="text"
                  defaultValue="Scratchpad"
                  className={inputClass}
                  placeholder="Enter workspace name..."
                />
              </div>
            </div>
          )}

          {/* Providers Tab */}
          {activeTab === 'providers' && (
            <div className={sectionClass}>
              <p className="text-sm text-gray-600 mb-4">
                Configure API providers for AI features
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Anthropic API Key
                  </label>
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="sk-ant-..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="sk-..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Google AI API Key
                  </label>
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="AI..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Models Tab */}
          {activeTab === 'models' && (
            <div className={sectionClass}>
              <p className="text-sm text-gray-600 mb-4">
                Select default models for different tasks
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Text Generation
                  </label>
                  <select className={inputClass}>
                    <option>Claude Sonnet 4.5</option>
                    <option>GPT-4o</option>
                    <option>Gemini 2.0 Flash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Image Analysis
                  </label>
                  <select className={inputClass}>
                    <option>Claude Sonnet 4.5</option>
                    <option>GPT-4o</option>
                    <option>Gemini 2.0 Flash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Image Generation
                  </label>
                  <select className={inputClass}>
                    <option>DALL-E 3</option>
                    <option>Stable Diffusion</option>
                    <option>Midjourney</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className={sectionClass}>
              <div className="flex items-center justify-between py-2">
                <label className={labelClass}>
                  <Grid3x3 size={16} className="text-gray-500" />
                  Show grid
                </label>
                <Toggle enabled={showGrid} onChange={setShowGrid} />
              </div>

              <div className="flex items-center justify-between py-2">
                <label className={labelClass}>
                  <Grid3x3 size={16} className="text-gray-500" />
                  Snap to grid
                </label>
                <Toggle enabled={snapToGrid} onChange={setSnapToGrid} />
              </div>

              <div className="pt-4 border-t border-gray-100 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-3">
                    Theme
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', name: 'Light', bg: 'bg-gray-50', border: 'border-gray-200' },
                      { id: 'warm', name: 'Warm', bg: 'bg-orange-50', border: 'border-orange-200' },
                      { id: 'ocean', name: 'Ocean', bg: 'bg-blue-50', border: 'border-blue-200' },
                      { id: 'forest', name: 'Forest', bg: 'bg-green-50', border: 'border-green-200' },
                      { id: 'sunset', name: 'Sunset', bg: 'bg-pink-50', border: 'border-pink-200' },
                      { id: 'dark', name: 'Dark', bg: 'bg-gray-900', border: 'border-gray-700' },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setSelectedTheme(theme.id)}
                        className={`p-4 rounded-xl ${theme.bg} border-2 ${
                          selectedTheme === theme.id ? 'border-gray-900 ring-2 ring-gray-900/20' : theme.border
                        } hover:scale-105 transition-all text-xs font-medium ${
                          theme.id === 'dark' ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {theme.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-700 mb-3">
                    Wallpaper
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button className="aspect-video rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-transparent hover:border-gray-900 transition-all" />
                    <button className="aspect-video rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 border-2 border-transparent hover:border-gray-900 transition-all" />
                    <button className="aspect-video rounded-lg bg-gradient-to-br from-green-400 to-teal-500 border-2 border-transparent hover:border-gray-900 transition-all" />
                    <button className="aspect-video rounded-lg bg-gray-200 border-2 border-transparent hover:border-gray-900 transition-all flex items-center justify-center text-gray-500 text-xs">
                      None
                    </button>
                  </div>
                  <button className="w-full mt-3 p-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors text-xs font-medium">
                    Upload Custom Wallpaper
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MCP Servers Tab */}
          {activeTab === 'mcp' && (
            <div className={sectionClass}>
              <p className="text-sm text-gray-600 mb-4">
                Model Context Protocol server configuration
              </p>

              <div className="space-y-3">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">filesystem</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      Connected
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Local filesystem access</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">brave-search</span>
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">
                      Disabled
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Web search capabilities</p>
                </div>

                <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors text-sm font-medium">
                  + Add MCP Server
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
