import { supabase } from '../supabase';
import Pusher from 'pusher-js';

// Configuration: load Pusher credentials from environment variables
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || null;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';
const PUSHER_SECRET = import.meta.env.VITE_PUSHER_SECRET || null;

/**
 * Signs Pusher private channel subscription using HMAC-SHA256 (Web Crypto API)
 */
async function generatePusherChannelAuth(socketId, channelName, key, secret) {
  const message = `${socketId}:${channelName}`;
  const enc = new TextEncoder();
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  const hashHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return { auth: `${key}:${hashHex}` };
}

let pusherInstance = null;
let pusherChannel = null;

if (PUSHER_KEY) {
  try {
    const pusherConfig = {
      cluster: PUSHER_CLUSTER,
    };

    if (PUSHER_SECRET) {
      pusherConfig.channelAuthorization = {
        customHandler: (params, callback) => {
          generatePusherChannelAuth(params.socketId, params.channelName, PUSHER_KEY, PUSHER_SECRET)
            .then(authData => callback(null, authData))
            .catch(err => {
              console.error('Pusher channel authorization error:', err);
              callback(err, null);
            });
        }
      };
      pusherConfig.authorizer = (channel) => ({
        authorize: (socketId, callback) => {
          generatePusherChannelAuth(socketId, channel.name, PUSHER_KEY, PUSHER_SECRET)
            .then(authData => callback(null, authData))
            .catch(err => {
              console.error('Pusher legacy authorizer error:', err);
              callback(err, null);
            });
        }
      });
    }

    pusherInstance = new Pusher(PUSHER_KEY, pusherConfig);
    // Subscribe to private channel (required by Pusher for client events)
    pusherChannel = pusherInstance.subscribe('private-falcon-fleet');
    
    pusherChannel.bind('pusher:subscription_succeeded', () => {
      console.log('⚡ Pusher: Authenticated & connected to private-falcon-fleet! (Sub-50ms peer-to-peer live tracking ACTIVE)');
    });
    pusherChannel.bind('pusher:subscription_error', (status) => {
      console.warn('Pusher subscription warning:', status);
    });
  } catch (err) {
    console.warn('Failed to initialize Pusher, falling back to Supabase Realtime:', err);
  }
} else {
  console.log('📡 Realtime GPS: Using Supabase Realtime with intelligent throttling');
}

// Memory cache to throttle location broadcasts per rider
const lastBroadcastTimes = {};
const lastCoordinates = {};
const lastDbPersistTimes = {};
const THROTTLE_INTERVAL_MS = 4000; // 4 seconds between regular Pusher broadcasts

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

// Persistent Supabase Realtime channel for fleet GPS (secondary fallback)
let persistentGpsChannel = null;
function getGpsChannel() {
  if (!persistentGpsChannel) {
    persistentGpsChannel = supabase.channel('fleet-gps-realtime', {
      config: { broadcast: { self: false } }
    });
    persistentGpsChannel.subscribe((status) => {
      console.log('📡 Fleet GPS Supabase broadcast channel status:', status);
    });
  }
  return persistentGpsChannel;
}

/**
 * Broadcasts rider GPS location.
 * 1. Primary: Instant sub-50ms peer-to-peer Pusher client event on private-falcon-fleet.
 * 2. Fallback: Supabase Realtime broadcast channel.
 * 3. Persistence: Updates riders table (current_lat, current_lng) on force or every 16s so pins persist on refresh.
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
      if (movedMeters < 8) {
        // Skip redundant ping to save battery and messages
        return;
      }
    }
  }

  // Update memory cache
  lastBroadcastTimes[riderId] = now;
  lastCoordinates[riderId] = { lat, lng };

  const payload = { riderId, lat, lng, timestamp: now };

  // 1. Pusher instant peer-to-peer broadcast (private channel client event)
  if (pusherChannel && pusherInstance) {
    try {
      pusherChannel.trigger('client-location_update', payload);
    } catch (err) {
      console.warn('Pusher client trigger failed:', err);
    }
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

  // 3. Database persistence (riders table)
  // Saved immediately when force = true (e.g. going online), or throttled to every 16s for normal riding
  const lastDbTime = lastDbPersistTimes[riderId] || 0;
  if (force || (now - lastDbTime) >= 16000) {
    lastDbPersistTimes[riderId] = now;
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
  }
}

/**
 * Subscribes to fleet GPS updates (used by CEO Admin map).
 * Listens to Pusher private channel first, and falls back to Supabase broadcast.
 */
export function subscribeToFleetGps(onLocationUpdate) {
  const cleanups = [];

  // 1. Listen to Pusher client events on private-falcon-fleet
  if (pusherChannel) {
    const handler = (data) => {
      if (data && data.riderId && data.lat && data.lng) {
        onLocationUpdate(data);
      }
    };
    pusherChannel.bind('client-location_update', handler);

    cleanups.push(() => {
      pusherChannel.unbind('client-location_update', handler);
    });
  }

  // 2. Also listen on Supabase Realtime channel
  const channel = getGpsChannel();
  const subHandler = ({ payload }) => {
    if (payload && payload.riderId && payload.lat && payload.lng) {
      onLocationUpdate(payload);
    }
  };
  channel.on('broadcast', { event: 'location_update' }, subHandler);

  return () => {
    cleanups.forEach(fn => fn());
  };
}
