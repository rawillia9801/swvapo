export default function DogCard({ name, status, registry }: { name: string, status: string, registry: string }) {
  // Logic for the status color badge
  const statusColor = status.toLowerCase() === 'available' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="aspect-square bg-slate-100 rounded-lg mb-4 flex items-center justify-center text-slate-400">
        [Photo Placeholder]
      </div>
      <h3 className="text-xl font-bold text-slate-900">{name}</h3>
      <div className="flex gap-2 mt-3">
        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${statusColor}`}>
          {status}
        </span>
        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-semibold">
          {registry}
        </span>
      </div>
    </div>
  );
}