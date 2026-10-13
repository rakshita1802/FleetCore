const Redis = require('ioredis');

let redisClient = null;

const connect = () => {
  if (!process.env.REDIS_URL) {
    console.warn("REDIS_URL is not defined. Redis will not be available.");
    return null;
  }
  
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 20) return 5000;
        return Math.min(times * 200, 3000);
      }
    });

    redisClient.on('error', (err) => {
      // Avoid unhandled crash on transient reconnects
    });

    redisClient.on('ready', () => {
      console.log('Redis connected successfully.');
    });
  }
  return redisClient;
};

const getClient = () => {
  if (!redisClient && process.env.REDIS_URL) {
    return connect();
  }
  return redisClient;
};

// Deterministic tenant-safe keys
const getVehicleStateKey = (companyId, vehicleId) => `fleetcore:company:${companyId}:vehicle:${vehicleId}:state`;

const getVehicleState = async (companyId, vehicleId) => {
  const client = getClient();
  if (!client || client.status !== 'ready') return null;

  try {
    const key = getVehicleStateKey(companyId, vehicleId);
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Redis getVehicleState Error:", error);
    return null;
  }
};

const setVehicleState = async (companyId, vehicleId, state) => {
  const client = getClient();
  if (!client || client.status !== 'ready') return false;

  try {
    const key = getVehicleStateKey(companyId, vehicleId);
    await client.set(key, JSON.stringify(state), 'EX', 86400);
    return true;
  } catch (error) {
    console.error("Redis setVehicleState Error:", error);
    return false;
  }
};

const updateStateIfNewer = async (companyId, vehicleId, state) => {
  const client = getClient();
  if (!client || client.status !== 'ready') return false;

  const script = `
    local current = redis.call('GET', KEYS[1])
    if current then
      local decoded = cjson.decode(current)
      if ARGV[1] <= decoded.timestamp then
        return 0
      end
    end
    redis.call('SETEX', KEYS[1], 86400, ARGV[2])
    return 1
  `;

  try {
    const key = getVehicleStateKey(companyId, vehicleId);
    const result = await client.eval(script, 1, key, state.timestamp, JSON.stringify(state));
    return result === 1; // Returns true if it updated, false if it was rejected due to older timestamp
  } catch (error) {
    console.error("Redis updateStateIfNewer Error:", error);
    return false;
  }
};

const checkHealth = async () => {
  const client = getClient();
  if (!client) return false;
  try {
    const res = await client.ping();
    return res === 'PONG';
  } catch (error) {
    return false;
  }
};

module.exports = {
  connect,
  getClient,
  getVehicleState,
  setVehicleState,
  updateStateIfNewer,
  checkHealth
};
