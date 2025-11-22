import React from 'react';

const MOCK_DATA = [
  { name: 'Alex S.', hours: 40 },
  { name: 'Samantha R.', hours: 38 },
  { name: 'John D.', hours: 42 },
  { name: 'Jane S.', hours: 35 },
];

const BarChart: React.FC = () => {
  const maxHours = Math.max(...MOCK_DATA.map((d) => d.hours), 0);

  return (
    <div className="bg-slate-800 p-6 rounded-2xl shadow-xl">
      <h3 className="text-lg font-bold mb-4">Weekly Hours</h3>
      <div className="flex justify-between items-end h-48">
        {MOCK_DATA.map((data) => (
          <div key={data.name} className="flex flex-col items-center">
            <div
              className="w-10 bg-blue-500 rounded-t-lg"
              style={{ height: `${(data.hours / maxHours) * 100}%` }}
            />
            <p className="text-xs mt-2">{data.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BarChart;
