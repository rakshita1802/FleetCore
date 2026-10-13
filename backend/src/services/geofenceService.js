const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const socketService = require('../socket');

// Point-in-polygon ray casting algorithm
function isPointInPolygon(lat, lng, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Haversine distance in meters
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// In-memory cooldown cache to prevent spamming breach alerts for the same vehicle
const breachCooldowns = new Map(); // key: `${vehicleId}:${geofenceId}:${breachType}`, value: timestamp

class GeofenceService {
  constructor() {
    this.cooldownSeconds = 60; // 1-minute alert cooldown per breach condition
  }

  // Pre-seed Coimbatore default geofences for a company
  async ensureDefaultGeofences(companyId) {
    try {
      const existingCount = await prisma.geofence.count({ where: { companyId } });
      if (existingCount > 0) return;

      const defaults = [
        {
          companyId,
          name: 'Coimbatore Airport Security Perimeter',
          description: 'Restricted high-security aviation tarmac corridor. Unauthorized commercial fleet entry strictly prohibited.',
          type: 'POLYGON',
          rule: 'NO_ENTRY',
          color: '#EF4444', // Red
          coordinates: [
            [11.0350, 77.0390],
            [11.0420, 77.0450],
            [11.0320, 77.0560],
            [11.0260, 77.0480]
          ],
          isActive: true
        },
        {
          companyId,
          name: 'Gandhipuram Pedestrian Congestion Zone',
          description: 'High-density commercial market district with heavy pedestrian foot traffic.',
          type: 'POLYGON',
          rule: 'SPEED_LIMIT',
          speedLimitKph: 30.0,
          color: '#F59E0B', // Amber
          coordinates: [
            [11.0220, 76.9610],
            [11.0240, 76.9720],
            [11.0140, 76.9740],
            [11.0130, 76.9620]
          ],
          isActive: true
        },
        {
          companyId,
          name: 'CIT Logistics Safe Depot Hub',
          description: 'CIT Peelamedu main campus charging depot, maintenance docks, and safe operating terminal.',
          type: 'POLYGON',
          rule: 'NO_ENTRY', // Sample rule or boundary
          color: '#10B981', // Emerald
          coordinates: [
            [11.0295, 77.0260],
            [11.0310, 77.0310],
            [11.0260, 77.0325],
            [11.0245, 77.0270]
          ],
          isActive: false // Inactive by default so vehicles leaving CIT don't trigger unless enabled
        },
        {
          companyId,
          name: 'TIDEL Park IT Special Economic Zone',
          description: 'IT Corridor transit zone. Monitored commercial fleet boundary.',
          type: 'POLYGON',
          rule: 'NO_ENTRY',
          color: '#06B6D4', // Cyan
          coordinates: [
            [11.0220, 77.0120],
            [11.0280, 77.0190],
            [11.0230, 77.0220],
            [11.0180, 77.0150]
          ],
          isActive: false
        }
      ];

      for (const gf of defaults) {
        await prisma.geofence.create({ data: gf });
      }
      console.log(`🗺️ Seeded ${defaults.length} Coimbatore geofences for company ${companyId}`);
    } catch (err) {
      console.error('Failed to seed default geofences:', err);
    }
  }

  // Get all geofences for company
  async getGeofences(companyId) {
    await this.ensureDefaultGeofences(companyId);
    return prisma.geofence.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { breaches: { where: { resolved: false } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Create custom geofence
  async createGeofence(companyId, data) {
    return prisma.geofence.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        type: data.type || 'POLYGON',
        rule: data.rule || 'NO_ENTRY',
        coordinates: data.coordinates,
        radiusMeters: data.radiusMeters ? parseFloat(data.radiusMeters) : null,
        speedLimitKph: data.speedLimitKph ? parseFloat(data.speedLimitKph) : null,
        color: data.color || '#EF4444',
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });
  }

  // Update geofence
  async updateGeofence(companyId, id, data) {
    return prisma.geofence.update({
      where: { id, companyId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type && { type: data.type }),
        ...(data.rule && { rule: data.rule }),
        ...(data.coordinates && { coordinates: data.coordinates }),
        ...(data.radiusMeters !== undefined && { radiusMeters: data.radiusMeters ? parseFloat(data.radiusMeters) : null }),
        ...(data.speedLimitKph !== undefined && { speedLimitKph: data.speedLimitKph ? parseFloat(data.speedLimitKph) : null }),
        ...(data.color && { color: data.color }),
        ...(data.isActive !== undefined && { isActive: data.isActive })
      }
    });
  }

  // Delete geofence
  async deleteGeofence(companyId, id) {
    return prisma.geofence.delete({
      where: { id, companyId }
    });
  }

  // Get active breach logs
  async getBreaches(companyId, options = {}) {
    const { vehicleId, resolved, limit = 50 } = options;
    const where = { companyId };
    if (vehicleId) where.vehicleId = vehicleId;
    if (resolved !== undefined) where.resolved = resolved === 'true' || resolved === true;

    return prisma.geofenceBreach.findMany({
      where,
      include: {
        geofence: { select: { name: true, rule: true, color: true } },
        vehicle: { select: { registrationNumber: true, make: true, model: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10)
    });
  }

  // Resolve a breach
  async resolveBreach(companyId, id) {
    return prisma.geofenceBreach.update({
      where: { id, companyId },
      data: { resolved: true }
    });
  }

  // Evaluate incoming vehicle telemetry for breaches
  async evaluateTelemetry(companyId, telemetryPacket) {
    try {
      const activeGeofences = await prisma.geofence.findMany({
        where: { companyId, isActive: true }
      });

      if (!activeGeofences || activeGeofences.length === 0) return;

      const { vehicleId, latitude, longitude, speedKph } = telemetryPacket;
      if (latitude == null || longitude == null) return;

      for (const gf of activeGeofences) {
        let isInside = false;

        if (gf.type === 'POLYGON') {
          isInside = isPointInPolygon(latitude, longitude, gf.coordinates);
        } else if (gf.type === 'CIRCLE' && gf.coordinates) {
          const centerLat = gf.coordinates.lat || gf.coordinates[0];
          const centerLng = gf.coordinates.lng || gf.coordinates[1];
          const dist = getDistanceMeters(latitude, longitude, centerLat, centerLng);
          isInside = dist <= (gf.radiusMeters || 500);
        }

        let breachType = null;
        let breachTitle = null;
        let breachMessage = null;

        if (gf.rule === 'NO_ENTRY' && isInside) {
          breachType = 'ENTERED_UNAUTHORIZED_ZONE';
          breachTitle = `🚨 Geofence Intrusion: ${gf.name}`;
          breachMessage = `Vehicle entered restricted zone '${gf.name}' at (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        } else if (gf.rule === 'NO_EXIT' && !isInside) {
          breachType = 'EXITED_OPERATIONAL_BOUNDARY';
          breachTitle = `⚠️ Perimeter Breach: ${gf.name}`;
          breachMessage = `Vehicle departed designated operational boundary '${gf.name}' at (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        } else if (gf.rule === 'SPEED_LIMIT' && isInside && speedKph > (gf.speedLimitKph || 40)) {
          breachType = 'ZONE_SPEEDING';
          breachTitle = `⚡ Zone Speed Violation: ${gf.name}`;
          breachMessage = `Vehicle traveling at ${speedKph.toFixed(0)} km/h inside '${gf.name}' (Limit: ${gf.speedLimitKph} km/h)`;
        }

        if (breachType) {
          // Check cooldown
          const cooldownKey = `${vehicleId}:${gf.id}:${breachType}`;
          const lastTime = breachCooldowns.get(cooldownKey) || 0;
          const now = Date.now();

          if (now - lastTime > this.cooldownSeconds * 1000) {
            breachCooldowns.set(cooldownKey, now);

            // 1. Record Breach in Database
            const breach = await prisma.geofenceBreach.create({
              data: {
                companyId,
                geofenceId: gf.id,
                vehicleId,
                breachType,
                latitude,
                longitude,
                speedKph,
                resolved: false
              },
              include: {
                vehicle: { select: { registrationNumber: true } },
                geofence: { select: { name: true, color: true } }
              }
            });

            // 2. Create Alert
            const alert = await prisma.alert.create({
              data: {
                companyId,
                vehicleId,
                type: 'GEOFENCE_BREACH',
                severity: 'CRITICAL',
                title: breachTitle,
                message: breachMessage,
                status: 'OPEN',
                metadata: {
                  geofenceId: gf.id,
                  geofenceName: gf.name,
                  breachId: breach.id,
                  breachType,
                  latitude,
                  longitude,
                  speedKph
                }
              }
            });

            console.warn(`🚨 [GEOFENCE BREACH] ${breachTitle} by Vehicle ${vehicleId} (${speedKph} km/h)`);

            // 3. Emit Real-time WebSocket Alert & Breach Notifications
            socketService.emitAlertCreated(companyId, alert);
            try {
              const io = socketService.getIo();
              if (io) {
                io.to(`company:${companyId}`).emit('geofence:breach', {
                  breach,
                  alert
                });
              }
            } catch (err) {
              // Ignore socket broadcast errors
            }
          }
        }
      }
    } catch (err) {
      console.error('Error evaluating geofence telemetry:', err);
    }
  }
}

const geofenceServiceInstance = new GeofenceService();
module.exports = geofenceServiceInstance;
