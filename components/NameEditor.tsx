import React, { useState, useEffect, useRef } from 'react';

interface Props {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

export const NameEditor: React.FC<Props> = ({ initialName, onSave, onCancel }) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus and select all text
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    } else {
      onCancel();
    }
  };

  const handleBlur = () => {
    if (name.trim()) {
      onSave(name.trim());
    } else {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="animate-in fade-in zoom-in-95 duration-200"
      >
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          className="bg-gray-900/95 text-white text-lg font-medium px-6 py-3 rounded-full border border-white/10 shadow-2xl outline-none focus:ring-2 focus:ring-white/20 min-w-[300px] text-center placeholder-white/40"
          placeholder="Enter name..."
        />
      </form>
    </div>
  );
};
