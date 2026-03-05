'use client'
import { useState } from 'react'
import Scanner from '@/components/Scanner'
import AddProductForm from '@/components/AddProductForm'
import QuickSaleModal from '@/components/QuickSaleModal'

export default function Dashboard() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [showScanner, setShowScanner] = useState(false)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Warehouse Management</h1>
        <button 
          onClick={() => setShowScanner(!showScanner)}
          className="px-4 py-2 bg-black text-white rounded-full text-sm"
        >
          {showScanner ? 'Close Scanner' : 'Open Scanner'}
        </button>
      </header>

      {/* 1. Barcode Scanner Section */}
      {showScanner && (
        <Scanner onScanSuccess={(product: any) => setSelectedProduct(product)} />
      )}

      {/* 2. Add Product Form */}
      <AddProductForm onComplete={() => window.location.reload()} />

      {/* 3. Quick Sale Modal (Triggers when Scanner finds a match) */}
      {selectedProduct && (
        <QuickSaleModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onRefresh={() => window.location.reload()} 
        />
      )}
    </div>
  )
}