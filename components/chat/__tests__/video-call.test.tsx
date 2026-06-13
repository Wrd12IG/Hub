import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VideoCallWidget } from '../video-call';

describe('VideoCallWidget', () => {
  it('renders correctly in disconnected state', () => {
    render(<VideoCallWidget onStartCall={vi.fn()} />);
    
    // Should display a "Start Call" button
    const startBtn = screen.getByRole('button', { name: /avvia chiamata/i });
    expect(startBtn).toBeDefined();
    expect(screen.queryByTestId('local-video')).toBeNull();
  });

  it('triggers onStartCall when start button is clicked', () => {
    const handleStartCall = vi.fn();
    render(<VideoCallWidget onStartCall={handleStartCall} />);
    
    const startBtn = screen.getByRole('button', { name: /avvia chiamata/i });
    fireEvent.click(startBtn);
    
    expect(handleStartCall).toHaveBeenCalledTimes(1);
  });
});
