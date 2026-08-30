// Import ECharts tree-shake : on n'enregistre que ce qu'on utilise (Gauge + Line + composants),
// au lieu du bundle complet -> reduit fortement la taille livree.
import { GaugeChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  GaugeChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  LegendComponent,
  CanvasRenderer,
]);

export { echarts };
