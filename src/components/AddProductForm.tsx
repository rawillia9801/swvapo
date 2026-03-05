'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

export default function AddProductForm({ onComplete }: { onComplete: () => void }) {
  const [formData, setFormData] = useState({ name: '', sku: '', price: '', stock: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('products').insert([
      { 
        name: formData.name, 
        sku: formData.sku, 
        price: parseFloat(formData.price), 
        stock_quantity: parseInt(formData.stock) 
      }
    ])

    if (error) {
      alert(error.message)
    } else {
      setFormData({ name: '', sku: '', price: '', stock: '' })
      onComplete() // Refreshes your dashboard list
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl border shadow-sm space-y-4">
      <h3 className="font-bold text-lg">Inventory Entry</h3>
      <div className="grid grid-cols-2 gap-4">
        <input 
          placeholder="Product Name" 
          className="p-2 border rounded" 
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          required 
        />
        <input 
          placeholder="SKU Barcode" 
          className="p-2 border rounded" 
          value={formData.sku}
          onChange={e => setFormData({...formData, sku: e.target.value})}
          required 
        />
        <input 
          type="number" 
          placeholder="Price" 
          className="p-2 border rounded" 
          value={formData.price}
          onChange={e => setFormData({...formData, price: e.target.value})}
          required 
        />
        <input 
          type="number" 
          placeholder="Initial Stock" 
          className="p-2 border rounded" 
          value={formData.stock}
          onChange={e => setFormData({...formData, stock: e.target.value})}
          required 
        />
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Add to Inventory'}
      </button>
    </form>
  )
}