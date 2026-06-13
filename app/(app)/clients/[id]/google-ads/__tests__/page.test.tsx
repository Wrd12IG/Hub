import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import GoogleAdsPage from '../page'

const mockCampaigns = [
  { id: '1', name: 'Search Brand', status: 'ENABLED', spend: 320.5, conversions: 15, costPerConversion: 21.36 },
  { id: '2', name: 'Performance Max', status: 'PAUSED', spend: 100.0, conversions: 2, costPerConversion: 50.0 }
]

const server = setupServer(
  http.get('/api/clients/test-client/google-ads', () => {
    return HttpResponse.json(mockCampaigns)
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('GoogleAdsPage', () => {
  it('renders campaigns fetched from API', async () => {
    render(<GoogleAdsPage params={{ id: 'test-client' }} />)

    // Wait for the data to load and verify the first campaign is shown
    await waitFor(() => {
      expect(screen.getByText('Search Brand')).toBeInTheDocument()
    })

    // Verify campaign details
    expect(screen.getByText('ENABLED')).toBeInTheDocument()
    expect(screen.getByText('€320.50')).toBeInTheDocument() // spend
    expect(screen.getByText('15')).toBeInTheDocument() // conversions
    
    // Verify the second campaign
    expect(screen.getByText('Performance Max')).toBeInTheDocument()
    expect(screen.getByText('PAUSED')).toBeInTheDocument()
  })
})
