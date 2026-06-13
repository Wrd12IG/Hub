import React from 'react';
import { Video } from 'lucide-react';

interface VideoCallWidgetProps {
  onStartCall: () => void;
}

export function VideoCallWidget({ onStartCall }: VideoCallWidgetProps) {
  return (
    <div className="flex flex-col items-center p-4 border rounded-lg bg-card">
      <button 
        onClick={onStartCall}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        <Video size={18} />
        Avvia Chiamata
      </button>
    </div>
  );
}
