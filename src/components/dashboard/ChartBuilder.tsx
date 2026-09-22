"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = ["#2563EB", "#10B981", "#7C3AED", "#F59E0B", "#EF4444", "#06B6D4"];

type ChartType = "bar" | "line" | "pie";

export default function ChartBuilder({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, any>[];
}) {
  const numericColumns = useMemo(() => {
    return columns.filter((col) =>
      rows.every((r) => r[col] === "" || !isNaN(Number(r[col])))
    );
  }, [columns, rows]);

  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xColumn, setXColumn] = useState(columns[0] || "");
  const [yColumn, setYColumn] = useState(numericColumns[0] || "");

  const chartData = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      [yColumn]: Number(r[yColumn]) || 0,
    }));
  }, [rows, yColumn]);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#111827] p-5">
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Chart Type
          </label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-[#111827] dark:text-white"
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="pie">Pie Chart</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            X Axis (Category)
          </label>
          <select
            value={xColumn}
            onChange={(e) => setXColumn(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-[#111827] dark:text-white"
          >
            {columns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Y Axis (Value)
          </label>
          <select
            value={yColumn}
            onChange={(e) => setYColumn(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-[#111827] dark:text-white"
          >
            {numericColumns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      </div>

      {numericColumns.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No numeric columns found in this dataset to chart.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          {chartType === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey={xColumn} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey={yColumn} fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey={xColumn} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={yColumn} stroke="#2563EB" strokeWidth={2} />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData}
                dataKey={yColumn}
                nameKey={xColumn}
                cx="50%"
                cy="50%"
                outerRadius={140}
                label
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}