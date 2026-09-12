import { supabase } from '../supabase';
import Pusher from 'pusher-js';

// Configuration: load Pusher credentials from environment variables
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || null;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';

let pusherInstance = null;
let pusherChannel = null;

if (PUSHER_KEY) {
  try {
    pusherInstance = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
    });
    // Subscribe to fleet channel
    pusherChannel = pusherInstance.subscribe('falcon-fleet');
    console.log('📡 Realtime GPS: Connected via Pusher (6,000,000 free message tier active, cluster: ' + PUSHER_CLUSTER + ')');
  } catch (err) {
    console.warn('Failed to initialize Pusher, falling back to Supabase Realtime:', err);
  }
} else {
  console.log('📡 Realtime GPS: Using Supabase Realtime with intelligent 10s throttling');
}

// Memory cache to throttle location broadcasts per rider
const lastBroadcastTimes = {};
const lastCoordinates = {};
const THROTTLE_INTERVAL_MS = 8000; // 8 seconds between regular GPS broadcasts

/**
 * Calculates distance in meters between two lat/lng points using Haversine formula
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Persistent Supabase Realtime channel for fleet GPS
let persistentGpsChannel = null;
function getGpsChannel() {
  if (!persistentGpsChannel) {
    persistentGpsChannel = supabase.channel('fleet-gps-realtime', {
      config: { broadcast: { self: false } }
    });
    persistentGpsChannel.subscribe((status) => {
      console.log('📡 Fleet GPS broadcast channel status:', status);
    });
  }
  return persistentGpsChannel;
}

/**
 * Broadcasts rider GPS location.
 * 1. Always writes to Supabase database (riders.current_lat / current_lng) so it's instantly visible.
 * 2. Broadcasts via Supabase Realtime WebSocket for sub-second updates on the CEO map.
 */
export async function broadcastRiderLocation(riderId, lat, lng, force = false) {
  if (!riderId || lat == null || lng == null) return;

  const now = Date.now();
  const lastTime = lastBroadcastTimes[riderId] || 0;
  const lastCoord = lastCoordinates[riderId];

  // If not forced and we already have a previous coordinate, throttle
  if (!force && lastCoord) {
    const elapsed = now - lastTime;
    if (elapsed < THROTTLE_INTERVAL_MS) {
      const movedMeters = getDistanceMeters(lastCoord.lat, lastCoord.lng, lat, lng);
      if (movedMeters < 15) {
        // Skip redundant ping to save battery
        return;
      }
    }
  }

  // Update memory cache
  lastBroadcastTimes[riderId] = now;
  lastCoordinates[riderId] = { lat, lng };

  const payload = { riderId, lat, lng, timestamp: now };

  // 1. Immediately persist to database (riders table)
  // This triggers Supabase Postgres changes on every CEO screen & saves coords permanently
  try {
    supabase
      .from('riders')
      .update({
        current_lat: lat,
        current_lng: lng,
        status: 'online',
        updated_at: new Date().toISOString()
      })
      .eq('id', riderId)
      .then(() => {})
      .catch((err) => console.warn('DB GPS update error:', err));
  } catch (err) {
    console.warn('Failed to update DB location:', err);
  }

  // 2. High-speed WebSocket broadcast via persistent Supabase channel
  try {
    const channel = getGpsChannel();
    channel.send({
      type: 'broadcast',
      event: 'location_update',
      payload
    });
  } catch (err) {
    console.error('Failed to broadcast location via Supabase:', err);
  }

  // 3. Also try Pusher if configured
  if (pusherChannel && pusherInstance) {
    try {
      pusherChannel.trigger('client-location_update', payload);
    } catch {
      // Ignored if client triggers not enabled
    }
  }
}

/**
 * Subscribes to fleet GPS updates (used by CEO Admin map).
 * Calls callback({ riderId, lat, lng }) whenever a rider broadcasts their location.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToFleetGps(onLocationUpdate) {
  const cleanups = [];

  // Listen on persistent Supabase Realtime channel
  const channel = getGpsChannel();
  channel.on('broadcast', { event: 'location_update' }, ({ payload }) => {
    if (payload && payload.riderId && payload.lat && payload.lng) {
      onLocationUpdate(payload);
    }
  });

  // Listen to Pusher events if active
  if (pusherChannel) {
    const handler = (data) => {
      if (data && data.riderId && data.lat && data.lng) {
        onLocationUpdate(data);
      }
    };
    pusherChannel.bind('client-location_update', handler);
    pusherChannel.bind('location_update', handler);

    cleanups.push(() => {
      pusherChannel.unbind('client-location_update', handler);
      pusherChannel.unbind('location_update', handler);
    });
  }

  return () => {
    cleanups.forEach(fn => fn());
  };
}
