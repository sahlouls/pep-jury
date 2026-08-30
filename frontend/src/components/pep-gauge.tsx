// Jauge PEP (Apache ECharts) : 0..1 affiche en %, couleur selon le niveau de risque.
import type { EChartsOption } from 'echarts';

import ReactEChartsCore from 'echarts-for-react/esm/core';

import { echarts } from '../lib/echarts';

function levelColor(value: number): string {
  if (value < 0.33) {
    return '#22c55e';
  }
  if (value < 0.66) {
    return '#f59e0b';
  }
  return '#ef4444';
}

export function PepGauge({ value }: { value: number }) {
  const color = levelColor(value);
  const option: EChartsOption = {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 1,
        radius: '92%',
        progress: { show: true, width: 12, itemStyle: { color } },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 12, color: [[1, '#e2e8f0']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, 0],
          fontSize: 30,
          fontWeight: 'bolder',
          color,
          formatter: (v: number) => `${String(Math.round(v * 100))}%`,
        },
        data: [{ value }],
      },
    ],
  };
  return (
    <ReactEChartsCore echarts={echarts} option={option} style={{ height: 180, width: '100%' }} />
  );
}
