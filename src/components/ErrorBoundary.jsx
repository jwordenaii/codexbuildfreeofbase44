import { Component } from 'react'
import { Link } from 'react-router-dom'

/**
 * React class-based Error Boundary.
 * Catches any unhandled render errors and shows a graceful fallback
 * instead of a blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-brand-navy flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="font-display font-black text-white text-3xl mb-3">Something went wrong</h1>
          <p className="text-white/60 mb-8">
            An unexpected error occurred. Please refresh the page or return home.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => window.location.reload()} className="btn-primary">
              Refresh Page
            </button>
            <Link to="/" className="btn-outline">
              Back to Home
            </Link>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-8 bg-red-900/30 border border-red-700/30 rounded-lg p-4 text-red-300 text-xs text-left overflow-auto max-h-48">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      </div>
    )
  }
}
