import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Quote from '../Quote'
import { api } from '../../api/client'

vi.mock('../../api/client', () => ({
  api: {
    submitQuote: vi.fn(),
    createCheckoutSession: vi.fn(),
  },
  trackEvent: vi.fn(),
}))

test('submits the quote flow successfully', async () => {
  api.submitQuote.mockResolvedValue({
    status: 'received',
    lead_id: 99,
    lead_score: 'HOT',
    follow_up_sla: 'Follow-up in 1 hour',
  })

  render(<Quote />)

  await userEvent.click(screen.getByRole('button', { name: /asphalt paving/i }))
  await userEvent.click(screen.getByRole('button', { name: /Property Details/i }))
  await userEvent.click(screen.getByRole('button', { name: /Contact Info/i }))

  await userEvent.type(screen.getByPlaceholderText('John Smith'), 'Jane Doe')
  await userEvent.type(screen.getByPlaceholderText('john@example.com'), 'jane@example.com')
  await userEvent.type(screen.getByPlaceholderText('(555) 555-5555'), '5551231234')

  await userEvent.click(screen.getByRole('button', { name: /Review & Submit/i }))
  await userEvent.click(screen.getByRole('button', { name: /Submit Request/i }))

  expect(await screen.findByText(/Quote Request Received/i)).toBeInTheDocument()
  expect(api.submitQuote).toHaveBeenCalledTimes(1)
})

test('shows API error on failed quote submit', async () => {
  api.submitQuote.mockRejectedValue(new Error('backend down'))

  render(<Quote />)

  await userEvent.click(screen.getByRole('button', { name: /asphalt paving/i }))
  await userEvent.click(screen.getByRole('button', { name: /Property Details/i }))
  await userEvent.click(screen.getByRole('button', { name: /Contact Info/i }))
  await userEvent.type(screen.getByPlaceholderText('John Smith'), 'Jane Doe')
  await userEvent.type(screen.getByPlaceholderText('john@example.com'), 'jane@example.com')
  await userEvent.type(screen.getByPlaceholderText('(555) 555-5555'), '5551231234')
  await userEvent.click(screen.getByRole('button', { name: /Review & Submit/i }))
  await userEvent.click(screen.getByRole('button', { name: /Submit Request/i }))

  expect(await screen.findByText(/backend down/i)).toBeInTheDocument()
})
