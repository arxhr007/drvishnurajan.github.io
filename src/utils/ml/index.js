import { runAgricultureModel } from './agricultureModel.js';
import { runWaterModel } from './waterModel.js';
import { runEnergyModel } from './energyModel.js';
import { sortAlerts } from './core.js';

/**
 * Run the three domain models on a village's hourly series + current readings.
 * `hourly` is the merged synthetic + live series (see buildHourlySeries).
 */
export const runVillageModels = ({ hourly, readings, now = Date.now() }) => {
    const input = { hourly, readings, now };
    const agriculture = runAgricultureModel(input);
    const water = runWaterModel(input);
    const energy = runEnergyModel(input);

    const alerts = sortAlerts([
        ...agriculture.alerts.map((a) => ({ ...a, group: 'agriculture' })),
        ...water.alerts.map((a) => ({ ...a, group: 'water' })),
        ...energy.alerts.map((a) => ({ ...a, group: 'energy' }))
    ]).map((a, i) => ({ ...a, id: `${a.group}-${a.metricKey}-${i}`, source: 'model' }));

    const predictions = [
        ...agriculture.predictions.map((p) => ({ ...p, group: 'agriculture' })),
        ...water.predictions.map((p) => ({ ...p, group: 'water' })),
        ...energy.predictions.map((p) => ({ ...p, group: 'energy' }))
    ];

    return { agriculture, water, energy, alerts, predictions, computedAt: now };
};

export { runAgricultureModel, runWaterModel, runEnergyModel };
