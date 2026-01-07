import React, { useState } from 'react';
import { X, Settings, Palette, Zap, Grid3x3, Eye, Key, Cpu, Monitor, Server, Sliders, Plus, Trash2, RefreshCw, Power, PowerOff, Wrench } from 'lucide-react';
import { useMCPClient } from '../hooks/useMCPClient';

interface Props {
  onClose: () => void;
  onThemeChange?: (theme: string) => void;
  onShaderChange?: (shader: string) => void;
  onShaderPerformanceChange?: (performance: string) => void;
}

type SettingsTab = 'general' | 'providers' | 'models' | 'display' | 'mcp';

export const SettingsModal: React.FC<Props> = ({ onClose, onThemeChange, onShaderChange, onShaderPerformanceChange }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [autoSave, setAutoSave] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [autoArrangeNew, setAutoArrangeNew] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(localStorage.getItem('theme') || 'dark');

  const [anthropicKey, setAnthropicKey] = useState(localStorage.getItem('anthropic-api-key') || '');
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai-api-key') || '');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini-api-key') || '');

  // MCP Client
  const mcp = useMCPClient({ autoConnect: true });
  const [newServerId, setNewServerId] = useState('');
  const [newServerCommand, setNewServerCommand] = useState('');
  const [newServerArgs, setNewServerArgs] = useState('');
  const [showAddServer, setShowAddServer] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  const saveKey = (keyName: string, value: string) => {
    if (value.trim()) {
      localStorage.setItem(keyName, value.trim());
    } else {
      localStorage.removeItem(keyName);
    }
  };

  const sectionClass = "space-y-4";
  const labelClass = "text-sm font-medium text-gray-900 flex items-center gap-2";
  const toggleClass = "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";
  const inputClass = "w-full px-3 py-2 bg-white/60 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900";

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
        className="bg-white/40 backdrop-blur-md border border-white/60 rounded-3xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[85vh] flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Side Tabs */}
        <div className="w-48 bg-white/30 border-r border-white/40 p-4 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-4 mb-4">
            <Settings size={20} className="text-gray-900" />
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
                    : 'text-gray-800 hover:bg-white/50 hover:text-gray-900'
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
          <div className="px-6 py-5 border-b border-white/40 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {tabs.find(t => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-800" />
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
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    onBlur={() => saveKey('anthropic-api-key', anthropicKey)}
                  />
                  {anthropicKey && (
                    <p className="text-xs text-green-600 mt-1">✓ Key saved</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    onBlur={() => saveKey('openai-api-key', openaiKey)}
                  />
                  {openaiKey && (
                    <p className="text-xs text-green-600 mt-1">✓ Key saved</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Google AI API Key (Gemini)
                  </label>
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="AIza..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    onBlur={() => saveKey('gemini-api-key', geminiKey)}
                  />
                  {geminiKey && (
                    <p className="text-xs text-green-600 mt-1">✓ Key saved</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Models Tab */}
          {activeTab === 'models' && (
            <div className={sectionClass}>
              <p className="text-sm text-gray-600 mb-4">
                Select default provider and models for different tasks
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Default AI Provider
                  </label>
                  <select
                    className={inputClass}
                    value={localStorage.getItem('ai-provider') || 'google'}
                    onChange={(e) => localStorage.setItem('ai-provider', e.target.value)}
                  >
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="google">Google (Gemini)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Text Generation
                  </label>
                  <select
                    className={inputClass}
                    value={localStorage.getItem('text-model') || 'gemini-2.5-flash'}
                    onChange={(e) => localStorage.setItem('text-model', e.target.value)}
                  >
                    <optgroup label="Anthropic Claude">
                      <option value="claude-opus-4-5-20251101">claude-opus-4-5-20251101</option>
                      <option value="claude-sonnet-4-5-20250929">claude-sonnet-4-5-20250929</option>
                      <option value="claude-haiku-4-5-20251015">claude-haiku-4-5-20251015</option>
                      <option value="claude-opus-4-1-20250805">claude-opus-4-1-20250805</option>
                    </optgroup>
                    <optgroup label="OpenAI GPT">
                      <option value="gpt-5.2">gpt-5.2</option>
                      <option value="gpt-5.2-thinking">gpt-5.2-thinking</option>
                      <option value="gpt-5.2-pro">gpt-5.2-pro</option>
                      <option value="gpt-5-mini">gpt-5-mini</option>
                      <option value="gpt-4.1">gpt-4.1</option>
                      <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                      <option value="o3">o3</option>
                      <option value="o3-mini">o3-mini</option>
                    </optgroup>
                    <optgroup label="Google Gemini">
                      <option value="gemini-3-pro">gemini-3-pro</option>
                      <option value="gemini-3-flash">gemini-3-flash</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                      <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Image Analysis
                  </label>
                  <select
                    className={inputClass}
                    value={localStorage.getItem('image-analysis-model') || 'gemini-3-flash'}
                    onChange={(e) => localStorage.setItem('image-analysis-model', e.target.value)}
                  >
                    <optgroup label="Anthropic Claude">
                      <option value="claude-opus-4-5-20251101">claude-opus-4-5-20251101</option>
                      <option value="claude-sonnet-4-5-20250929">claude-sonnet-4-5-20250929</option>
                    </optgroup>
                    <optgroup label="Google Gemini">
                      <option value="gemini-3-flash">gemini-3-flash</option>
                      <option value="gemini-3-pro">gemini-3-pro</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Image Generation
                  </label>
                  <select
                    className={inputClass}
                    value={localStorage.getItem('image-generation-model') || 'gemini-3-pro-image-preview'}
                    onChange={(e) => localStorage.setItem('image-generation-model', e.target.value)}
                  >
                    <optgroup label="Google Gemini">
                      <option value="gemini-2.5-flash-image">gemini-2.5-flash-image (Nano Banana)</option>
                      <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview (Nano Banana Pro)</option>
                    </optgroup>
                    <optgroup label="OpenAI">
                      <option value="gpt-image-1.5">gpt-image-1.5</option>
                    </optgroup>
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
                        onClick={() => {
                          setSelectedTheme(theme.id);
                          localStorage.setItem('theme', theme.id);
                          onThemeChange?.(theme.id);
                        }}
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

                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-3">
                      Background Shader
                    </label>
                    <select
                      className={inputClass}
                      value={localStorage.getItem('background-shader') || 'neuro-noise'}
                      onChange={(e) => {
                        localStorage.setItem('background-shader', e.target.value);
                        onShaderChange?.(e.target.value);
                      }}
                    >
                      <option value="none">None</option>
                      <optgroup label="Static (Battery Friendly)">
                        <option value="paper-texture">Paper Texture</option>
                        <option value="static-mesh-gradient">Static Mesh Gradient</option>
                        <option value="static-radial-gradient">Static Radial Gradient</option>
                      </optgroup>
                      <optgroup label="Subtle Animation">
                        <option value="grain-gradient">Grain Gradient</option>
                        <option value="dithering">Dithering</option>
                        <option value="dot-grid">Dot Grid</option>
                        <option value="simplex-noise">Simplex Noise</option>
                        <option value="perlin-noise">Perlin Noise</option>
                      </optgroup>
                      <optgroup label="Dynamic (Higher GPU)">
                        <option value="neuro-noise">Neuro Noise</option>
                        <option value="waves">Waves</option>
                        <option value="water">Water</option>
                        <option value="smoke-ring">Smoke Ring</option>
                        <option value="dot-orbit">Dot Orbit</option>
                        <option value="metaballs">Metaballs</option>
                        <option value="voronoi">Voronoi</option>
                        <option value="liquid-metal">Liquid Metal</option>
                        <option value="mesh-gradient">Mesh Gradient</option>
                        <option value="fluted-glass">Fluted Glass</option>
                        <option value="god-rays">God Rays</option>
                        <option value="spiral">Spiral</option>
                        <option value="swirl">Swirl</option>
                        <option value="warp">Warp</option>
                        <option value="color-panels">Color Panels</option>
                        <option value="pulsing-border">Pulsing Border</option>
                        <option value="halftone-dots">Halftone Dots</option>
                        <option value="heatmap">Heatmap</option>
                      </optgroup>
                    </select>
                  </div>

                  {localStorage.getItem('background-shader') !== 'none' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-3">
                        Performance
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'battery', name: 'Battery Saver', desc: 'Low res, paused when hidden' },
                          { id: 'balanced', name: 'Balanced', desc: 'Medium res, smooth' },
                          { id: 'quality', name: 'Quality', desc: 'Full res, always on' },
                        ].map((preset) => {
                          const currentPreset = localStorage.getItem('shader-performance') || 'balanced';
                          return (
                            <button
                              key={preset.id}
                              onClick={() => {
                                localStorage.setItem('shader-performance', preset.id);
                                onShaderPerformanceChange?.(preset.id);
                              }}
                              className={`p-2.5 rounded-xl border-2 transition-all text-left ${
                                currentPreset === preset.id 
                                  ? 'border-gray-900 ring-2 ring-gray-900/20 bg-gray-50' 
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <span className="block text-xs font-medium text-gray-900">{preset.name}</span>
                              <span className="block text-[10px] text-gray-500 mt-0.5 leading-tight">{preset.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MCP Servers Tab */}
          {activeTab === 'mcp' && (
            <div className={sectionClass}>
              {/* Proxy Connection Status */}
              <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${mcp.connected ? 'bg-green-500' : mcp.connecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium text-gray-700">
                    MCP Proxy {mcp.connected ? 'Connected' : mcp.connecting ? 'Connecting...' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => mcp.refresh()}
                    className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={14} className="text-gray-500" />
                  </button>
                  {!mcp.connected && (
                    <button
                      onClick={() => mcp.connect()}
                      className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {mcp.error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {mcp.error}. Make sure the proxy is running: <code className="bg-red-100 px-1 rounded">npm run mcp:proxy</code>
                </div>
              )}

              <p className="text-sm text-gray-600 mb-4">
                Connect to MCP servers to extend AI capabilities with external tools and resources.
              </p>

              {/* Server List */}
              <div className="space-y-3">
                {mcp.servers.map((server) => (
                  <div key={server.id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => setExpandedServer(expandedServer === server.id ? null : server.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Server size={16} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{server.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {server.connected ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                              <Power size={10} /> Connected
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full flex items-center gap-1">
                              <PowerOff size={10} /> Disconnected
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-mono">{server.command}</p>
                      {server.connected && (
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Wrench size={10} /> {server.toolCount} tools</span>
                        </div>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {expandedServer === server.id && (
                      <div className="px-4 pb-4 border-t border-gray-200 pt-3">
                        <div className="flex gap-2 mb-3">
                          {server.connected ? (
                            <button
                              onClick={() => mcp.disconnectServer(server.id)}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300"
                            >
                              Disconnect
                            </button>
                          ) : (
                            <button
                              onClick={() => mcp.connectServer(server.id)}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                            >
                              Connect
                            </button>
                          )}
                          <button
                            onClick={() => mcp.removeServer(server.id)}
                            className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>

                        {/* Tools from this server */}
                        {server.connected && server.toolCount > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-2">Available Tools:</p>
                            <div className="flex flex-wrap gap-1">
                              {mcp.tools
                                .filter(t => t.serverId === server.id)
                                .map(tool => (
                                  <span
                                    key={tool.name}
                                    className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                                    title={tool.description}
                                  >
                                    {tool.name}
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {mcp.servers.length === 0 && mcp.connected && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No MCP servers configured yet
                  </div>
                )}

                {/* Add Server Form */}
                {showAddServer ? (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Server ID</label>
                      <input
                        type="text"
                        className={inputClass}
                        placeholder="e.g., filesystem"
                        value={newServerId}
                        onChange={(e) => setNewServerId(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Command</label>
                      <input
                        type="text"
                        className={inputClass}
                        placeholder="e.g., npx or node"
                        value={newServerCommand}
                        onChange={(e) => setNewServerCommand(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Arguments (space-separated)</label>
                      <input
                        type="text"
                        className={inputClass}
                        placeholder="e.g., -y @anthropic/mcp-server-filesystem /path"
                        value={newServerArgs}
                        onChange={(e) => setNewServerArgs(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (newServerId && newServerCommand) {
                            const args = newServerArgs.split(' ').filter(a => a.trim());
                            await mcp.addServer(newServerId, newServerCommand, args);
                            setNewServerId('');
                            setNewServerCommand('');
                            setNewServerArgs('');
                            setShowAddServer(false);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Add Server
                      </button>
                      <button
                        onClick={() => setShowAddServer(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddServer(true)}
                    className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    disabled={!mcp.connected}
                  >
                    <Plus size={16} /> Add MCP Server
                  </button>
                )}
              </div>

              {/* Summary */}
              {mcp.connected && mcp.tools.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Total: {mcp.tools.length} tools, {mcp.resources.length} resources, {mcp.prompts.length} prompts available
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
