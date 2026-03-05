'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

export default function QuickSaleModal({ product, onClose, onRefresh }: any) {
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSale = async () => {
    setLoading(true)
    setError('')

    // Use the RPC function we created earlier
    const { error: stockError } = await supabase.rpc('decrement_stock', {
      row_id: product.id,
      count: quantity
    })

    if (stockError) {
      setError(stockError.message || 'Insufficient stock!')
      setLoading(false)
      return
    }

    // Log the sale in the sales table
    await supabase.from('sales').insert([
      { 
        product_id: product.id, 
        quantity, 
        total_price: quantity * product.price 
      }
    ])

    onRefresh() // Updates the dashboard list
    onClose()   // Closes the modal
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold mb-2">New Sale: {product.name}</h2>
        <p className="text-gray-500 mb-4">Current Stock: <span className="font-bold">{product.stock_quantity}</span></p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Quantity to Sell</label>
            <input 
              type="number" 
              min="1" 
              max={product.stock_quantity}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleSale}
              disabled={loading || quantity > product.stock_quantity}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}