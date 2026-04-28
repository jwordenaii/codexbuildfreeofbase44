import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CRMPanel from '../CRMPanel'
import { api } from '../../../api/client'

vi.mock('../../../api/client', () => ({
  api: {
    getCRMLeads: vi.fn(),
    getCRMFunnel: vi.fn(),
    updateLeadStage: vi.fn(),
  },
}))

function renderWithQuery(ui) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

test('shows API error and retry action', async () => {
  api.getCRMLeads.mockRejectedValueOnce(new Error('Boom'))
  api.getCRMFunnel.mockRejectedValueOnce(new Error('Boom'))

  renderWithQuery(<CRMPanel />)

  expect(await screen.findByText(/CRM unavailable:/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
})

test('loads leads and allows stage update', async () => {
  api.getCRMLeads.mockResolvedValue({
    leads: [
      {
        id: 1,
        name: 'Test Lead',
        email: 'x@y.com',
        phone: '555',
        service_type: 'paving',
        score_label: 'HOT',
        pipeline_stage: 'new',
      },
    ],
  })
  api.getCRMFunnel.mockResolvedValue({ total: 1, funnel: [{ stage: 'new', count: 1 }] })
  api.updateLeadStage.mockResolvedValue({ status: 'updated' })

  renderWithQuery(<CRMPanel />)

  expect(await screen.findByText('Test Lead')).toBeInTheDocument()
  const select = screen.getByDisplayValue('new')
  await userEvent.selectOptions(select, 'contacted')

  await waitFor(() => expect(api.updateLeadStage).toHaveBeenCalledWith(1, 'contacted'))
})
