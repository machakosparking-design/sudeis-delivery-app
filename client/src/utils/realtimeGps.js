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
const THROTTLE_INTERVAL_MS = 10000; // 10 seconds minimum between GPS broadcasts

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

/**
 * Broadcasts rider GPS location.
 * Uses Pusher client trigger if enabled, or falls back to Supabase Realtime broadcast.
 */
export function broadcastRiderLocation(riderId, lat, lng, force = false) {
  if (!riderId || lat == null || lng == null) return;

  const now = Date.now();
  const lastTime = lastBroadcastTimes[riderId] || 0;
  const lastCoord = lastCoordinates[riderId];

  // If not forced, enforce minimum 10s throttle unless rider moved > 25 meters
  if (!force) {
    const elapsed = now - lastTime;
    if (elapsed < THROTTLE_INTERVAL_MS) {
      if (lastCoord) {
        const movedMeters = getDistanceMeters(lastCoord.lat, lastCoord.lng, lat, lng);
        if (movedMeters < 25) {
          // Skip redundant ping to save bandwidth and battery
          return;
        }
      } else {
        return;
      }
    }
  }

  // Update cache
  lastBroadcastTimes[riderId] = now;
  lastCoordinates[riderId] = { lat, lng };

  const payload = { riderId, lat, lng, timestamp: now };

  // 1. Try Pusher broadcast if channel is active
  let sentViaPusher = false;
  if (pusherChannel && pusherInstance) {
    try {
      sentViaPusher = pusherChannel.trigger('client-location_update', payload);
    } catch {
      sentViaPusher = false;
    }
  }

  // 2. If Pusher was not sent (or fallback needed), broadcast via Supabase channel
  if (!sentViaPusher) {
    try {
      const channel = supabase.channel('rider-gps');
      channel.send({
        type: 'broadcast',
        event: 'location_update',
        payload
      });
    } catch (err) {
      console.error('Failed to broadcast location:', err);
    }
  }
}

/**
 * Subscribes to fleet GPS updates (used by CEO Admin map).
 * Calls callback({ riderId, lat, lng }) whenever a rider moves.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToFleetGps(onLocationUpdate) {
  const cleanups = [];

  // Listen to Pusher events
  if (pusherChannel) {
    const handler = (data) => {
      onLocationUpdate(data);
    };
    pusherChannel.bind('client-location_update', handler);
    pusherChannel.bind('location_update', handler);

    cleanups.push(() => {
      pusherChannel.unbind('client-location_update', handler);
      pusherChannel.unbind('location_update', handler);
    });
  }

  // Also listen to Supabase Realtime channel as fallback
  const gpsChannel = supabase.channel('rider-gps')
    .on('broadcast', { event: 'location_update' }, ({ payload }) => {
      onLocationUpdate(payload);
    })
    .subscribe();

  cleanups.push(() => {
    supabase.removeChannel(gpsChannel);
  });

  return () => {
    cleanups.forEach(fn => fn());
  };
}
