import { useEffect, useState } from 'react'

declare global {
  interface Window { Paddle: any }
}

interface PaddleCheckoutProps {
  orgId: string
  priceId: string
  userEmail: string
  onSuccess?: () => void
  label?: string
}

export function PaddleCheckoutButton({ orgId, priceId, userEmail, onSuccess, label = 'Upgrade Now' }: PaddleCheckoutProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (window.Paddle) {
      setLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.onload = () => {
      window.Paddle.Initialize({
        token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN || 'test_token',
        environment: import.meta.env.VITE_PADDLE_ENV || 'sandbox',
      })
      setLoaded(true)
    }
    document.body.appendChild(script)
  }, [])

  const handleCheckout = () => {
    if (!loaded) return
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: userEmail },
      customData: { orgId },
      settings: {
        theme: 'dark',
        displayMode: 'overlay',
        successUrl: window.location.origin + '/billing',
      },
      eventCallback: (event: any) => {
        if (event.name === 'checkout.completed' && onSuccess) {
          onSuccess()
        }
      },
    })
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={!loaded}
      className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loaded ? label : 'Loading...'}
    </button>
  )
}
