// Inside your product loop in page.tsx:
{products.map((p) => (
  <tr key={p.id}>
    <td className="border p-4 font-medium">{p.name}</td>
    <td className="border p-4 text-gray-500">{p.stock_quantity} units</td>
    <td className="border p-4 text-right">
      <button 
        onClick={() => setSelectedProduct(p)} // State to open modal
        className="bg-black text-white px-4 py-1 rounded hover:bg-gray-800 transition"
      >
        Quick Sale
      </button>
    </td>
  </tr>
))}