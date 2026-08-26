import React, { useState } from 'react';
import CEOAdminPanel from './components/CEOAdminPanel';
import RiderApp from './components/RiderApp';
import './index.css';
import { Truck } from 'lucide-react';

export default function App() {
  const [currentRole, setCurrentRole] = useState('ceo'); // 'ceo', 'rider_1', 'rider_2', 'rider_3'
  
  return (
    <div className="app-container">
      {/* Top Navigation / Role Switcher */}
      <header className="header">
        <div className="flex items-center gap-2 text-xl font-bold">
          <Truck /> Falcon Delivery
        </div>
        <div className="role-selector">
          <button 
            className={`btn ${currentRole === 'ceo' ? 'btn-outline' : ''}`}
            onClick={() => setCurrentRole('ceo')}
            style={currentRole !== 'ceo' ? { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', border: 'none' } : {}}
          >
            CEO Admin
          </button>
          {['rider_1', 'rider_2', 'rider_3'].map(riderId => (
            <button 
              key={riderId}
              className={`btn ${currentRole === riderId ? 'btn-outline' : ''}`}
              onClick={() => setCurrentRole(riderId)}
              style={currentRole !== riderId ? { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', border: 'none' } : {}}
            >
              {riderId === 'rider_1' ? 'Rider 1' : riderId === 'rider_2' ? 'Rider 2' : 'Rider 3'}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      {currentRole === 'ceo' ? (
        <CEOAdminPanel />
      ) : (
        <RiderApp riderCode={currentRole} />
      )}
    </div>
  );
}
