import { useContext } from 'react';
import { VillageSensorsContext } from '../context/VillageSensorsContext';

export const useVillageSensors = () => {
    const context = useContext(VillageSensorsContext);
    if (!context) {
        throw new Error('useVillageSensors must be used within a VillageSensorsProvider');
    }
    return context;
};
