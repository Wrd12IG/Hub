import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import KonvaStoryEditor from '../page'

describe('KonvaStoryEditor', () => {
  it('renders the editor workspace and allows adding text', () => {
    render(<KonvaStoryEditor params={{ id: 'test-client' }} />)

    // Ensure the tools are present
    const addTextBtn = screen.getByRole('button', { name: /Testo/i })
    expect(addTextBtn).toBeInTheDocument()

    // It should not have disabled attribute (currently it has in the placeholder)
    expect(addTextBtn).not.toBeDisabled()

    // Add text element
    fireEvent.click(addTextBtn)

    // We should see properties panel for text
    expect(screen.getByText('Proprietà Testo')).toBeInTheDocument()
    
    // The placeholder text should be removed
    expect(screen.queryByText('Modulo in Costruzione')).not.toBeInTheDocument()
  })
})
