"use client";
import React, { useState } from 'react';

export default function InventoryPage() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Example products - these should match your DB later
  const products = [
    { id: 1, name: "Chihuahua Puppy Kit", stock_quantity: 5 },
    { id: 2, name: "Premium Travel Crate", stock_quantity: 12 }
  ];

  return (
    <main className="p-8">
      <h1 className="font-serif text-3xl font-bold mb-6 text-brand-900">Inventory</h1>
      <div className="card-luxury bg-white overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-brand-50">
            <tr>
              <th className="p-4 text-xs font-black uppercase text-brand-500">Product</th>
              <th className="p-4 text-xs font-black uppercase text-brand-500">Stock</th>
              <th className="p-4 text-xs font-black uppercase text-brand-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-brand-100">
                <td className="border p-4 font-medium">{p.name}</td>
                <td className="border p-4 text-gray-500">{p.stock_quantity} units</td>
                <td className="border p-4 text-right">
                  <button 
                    onClick={() => setSelectedProduct(p)} 
                    className="bg-brand-800 text-white px-4 py-1 rounded-xl text-xs font-black uppercase transition hover:bg-brand-700"
                  >
                    Quick Sale
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Sale: {selectedProduct.name}</h2>
            <button 
              onClick={() => setSelectedProduct(null)}
              className="w-full bg-brand-800 text-white py-2 rounded-lg font-bold"
            >
              Confirm Sale
            </button>
          </div>
        </div>
      )}
    </main>
  );
}