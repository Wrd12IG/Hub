import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import MetaAdsPage from '../page'

const mockCampaigns = [
  { id: '1', name: 'Campagna Test 1', status: 'ACTIVE', spend: 150.5, cpa: 12.5, roas: 3.2 },
  { id: '2', name: 'Campagna Test 2', status: 'PAUSED', spend: 50.0, cpa: 25.0, roas: 1.1 }
]

const server = setupServer(
  http.get('/api/clients/test-client/meta-ads', () => {
    return HttpResponse.json(mockCampaigns)
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MetaAdsPage', () => {
  it('renders campaigns fetched from API', async () => {
    render(<MetaAdsPage params={{ id: 'test-client' }} />)

    // Wait for the data to load and verify the first campaign is shown
    await waitFor(() => {
      expect(screen.getByText('Campagna Test 1')).toBeInTheDocument()
    })

    // Verify campaign details
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('€150.50')).toBeInTheDocument() // spend
    
    // Verify the second campaign
    expect(screen.getByText('Campagna Test 2')).toBeInTheDocument()
    expect(screen.getByText('PAUSED')).toBeInTheDocument()
  })
})
