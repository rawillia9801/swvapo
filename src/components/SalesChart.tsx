'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function SalesChart() {
  const [data, setData] = useState([])

  useEffect(() => {
    const fetchSales = async () => {
      // Get sales from the last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: sales } = await supabase
        .from('sales')
        .select('created_at, total_price')
        .gte('created_at', sevenDaysAgo.toISOString())

      // Group by date for the chart
      const chartMap = sales?.reduce((acc: any, sale: any) => {
        const date = new Date(sale.created_at).toLocaleDateString('en-US', { weekday: 'short' })
        acc[date] = (acc[date] || 0) + Number(sale.total_price)
        return acc
      }, {})

      const formattedData = Object.keys(chartMap || {}).map(date => ({
        name: date,
        revenue: chartMap[date]
      }))

      setData(formattedData as any)
    }

    fetchSales()
  }, [])

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border mb-8">
      <h3 className="text-lg font-bold mb-4 text-gray-800">Weekly Revenue Trend</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
            <Tooltip 
              contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
            />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#2563eb" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#2563eb' }} 
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}