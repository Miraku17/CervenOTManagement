import React from 'react';

const MOCK_DATA = [
  { name: 'Engineering', value: 400, color: '#3b82f6' },
  { name: 'Management', value: 300, color: '#10b981' },
  { name: 'Design', value: 300, color: '#f97316' },
  { name: 'QA', value: 200, color: '#ef4444' },
];

const PieChart: React.FC = () => {
  const total = MOCK_DATA.reduce((acc, data) => acc + data.value, 0);

  let cumulative = 0;
  const pieSlices = MOCK_DATA.map((data) => {
    const percentage = (data.value / total) * 100;
    const startAngle = (cumulative / total) * 360;
    const endAngle = ((cumulative + data.value) / total) * 360;
    cumulative += data.value;

    const largeArcFlag = percentage > 50 ? 1 : 0;
    const x1 = 50 + 40 * Math.cos((Math.PI / 180) * startAngle);
    const y1 = 50 + 40 * Math.sin((Math.PI / 180) * startAngle);
    const x2 = 50 + 40 * Math.cos((Math.PI / 180) * endAngle);
    const y2 = 50 + 40 * Math.sin((Math.PI / 180) * endAngle);

    return <path key={data.name} d={`M 50,50 L ${x1},${y1} A 40,40 0 ${largeArcFlag},1 ${x2},${y2} Z`} fill={data.color} />;
  });

  return (
    <div className="bg-slate-800 p-6 rounded-2xl shadow-xl">
      <h3 className="text-lg font-bold mb-4">Department Distribution</h3>
      <div className="flex items-center">
        <svg viewBox="0 0 100 100" className="w-40 h-40">
          {pieSlices}
        </svg>
        <div className="ml-8 space-y-2">
          {MOCK_DATA.map((data) => (
            <div key={data.name} className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-2"
                style={{ backgroundColor: data.color }}
              />
              <p className="text-sm">{data.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PieChart;
