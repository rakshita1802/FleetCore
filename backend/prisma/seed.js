const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const Redis = require('ioredis');

// Fallback for host execution if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://fleetuser:fleetpassword@localhost:3307/fleetcore';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6380';
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('🌱 Seeding FleetCore database with operational demo data...');

  // 1. Password Hash for demo accounts
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);
  const adminPasswordHash = await bcrypt.hash('Admin@12345', salt);

  // 2. Company
  let company = await prisma.company.findFirst({
    where: { name: 'Coimbatore Institute of Technology' }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Coimbatore Institute of Technology'
      }
    });
    console.log(`✅ Created Company: ${company.name} (${company.id})`);
  } else {
    console.log(`ℹ️ Using Existing Company: ${company.name} (${company.id})`);
  }

  const companyId = company.id;

  // 3. Users
  const userSeeds = [
    {
      name: 'Executive Admin',
      email: 'admin@cit.edu',
      role: 'ADMIN',
      status: 'ACTIVE',
      hash: adminPasswordHash
    },
    {
      name: 'Fleet Manager',
      email: 'manager@cit.edu',
      role: 'FLEET_MANAGER',
      status: 'ACTIVE',
      hash: adminPasswordHash
    },
    {
      name: 'Rakshita N',
      email: '2403717672622040@cit.edu.in',
      role: 'ADMIN',
      status: 'ACTIVE',
      hash: passwordHash
    },
    {
      name: 'Suresh Kumar',
      email: 'suresh.kumar@cit.edu.in',
      role: 'FLEET_MANAGER',
      status: 'ACTIVE',
      hash: passwordHash
    },
    {
      name: 'Murugan Palanisamy',
      email: 'murugan.driver@cit.edu.in',
      role: 'DRIVER',
      status: 'ACTIVE',
      hash: passwordHash
    },
    {
      name: 'Campus Operations',
      email: 'operations@cit.edu.in',
      role: 'VIEWER',
      status: 'ACTIVE',
      hash: passwordHash
    }
  ];

  const userMap = {};
  for (const u of userSeeds) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        companyId,
        name: u.name,
        role: u.role,
        status: u.status,
        passwordHash: u.hash || passwordHash
      },
      create: {
        companyId,
        name: u.name,
        email: u.email,
        passwordHash: u.hash || passwordHash,
        role: u.role,
        status: u.status
      }
    });
    userMap[u.email] = user;
    console.log(`   👤 User: ${user.name} (${user.email}) [${user.role}]`);
  }

  // 4. Drivers
  const driverSeeds = [
    {
      employeeCode: 'DRV-101',
      name: 'Murugan Palanisamy',
      licenseNumber: 'TN37-2018-0045129',
      licenseExpiry: new Date('2028-12-31'),
      phone: '+91 98421 12345',
      status: 'ACTIVE',
      userId: userMap['murugan.driver@cit.edu.in']?.id
    },
    {
      employeeCode: 'DRV-102',
      name: 'Anitha Ramesh',
      licenseNumber: 'TN38-2020-0098432',
      licenseExpiry: new Date('2029-06-30'),
      phone: '+91 98422 23456',
      status: 'ACTIVE'
    },
    {
      employeeCode: 'DRV-103',
      name: 'Karthik Raja',
      licenseNumber: 'TN37-2019-0012384',
      licenseExpiry: new Date('2027-04-15'),
      phone: '+91 98423 34567',
      status: 'ACTIVE'
    },
    {
      employeeCode: 'DRV-104',
      name: 'Vigneshwaran S',
      licenseNumber: 'TN40-2021-0078491',
      licenseExpiry: new Date('2030-01-20'),
      phone: '+91 98424 45678',
      status: 'ACTIVE'
    },
    {
      employeeCode: 'DRV-105',
      name: 'Divya Bharathi',
      licenseNumber: 'TN39-2022-0034910',
      licenseExpiry: new Date('2031-08-10'),
      phone: '+91 98425 56789',
      status: 'ACTIVE'
    }
  ];

  const driverMap = {};
  for (const d of driverSeeds) {
    const existing = await prisma.driver.findFirst({
      where: { companyId, employeeCode: d.employeeCode }
    });

    let driver;
    if (existing) {
      driver = await prisma.driver.update({
        where: { id: existing.id },
        data: d
      });
    } else {
      driver = await prisma.driver.create({
        data: { ...d, companyId }
      });
    }
    driverMap[d.employeeCode] = driver;
    console.log(`   🪪 Driver: ${driver.name} (${driver.employeeCode})`);
  }

  // 5. Vehicles (Coimbatore Area: ~11.0168° N, 76.9558° E)
  const vehicleSeeds = [
    {
      registrationNumber: 'TN 37 CY 4501',
      vin: 'MB123456789012341',
      make: 'BharatBenz',
      model: '1617R Medium Duty Truck',
      year: 2022,
      vehicleType: 'TRUCK',
      fuelType: 'DIESEL',
      status: 'ACTIVE',
      odometer: 48250.0,
      currentLatitude: 11.0287,
      currentLongitude: 77.0275 // Avinashi Road
    },
    {
      registrationNumber: 'TN 38 BE 1092',
      vin: 'MB123456789012342',
      make: 'Tata Motors',
      model: 'Ace Gold Delivery Van',
      year: 2023,
      vehicleType: 'VAN',
      fuelType: 'DIESEL',
      status: 'ACTIVE',
      odometer: 24180.0,
      currentLatitude: 11.0024,
      currentLongitude: 76.9654 // Gandhipuram Central
    },
    {
      registrationNumber: 'TN 37 DE 8840',
      vin: 'MB123456789012343',
      make: 'Mahindra',
      model: 'Bolero Maxi Truck Plus',
      year: 2021,
      vehicleType: 'TRUCK',
      fuelType: 'DIESEL',
      status: 'MAINTENANCE',
      odometer: 76400.0,
      currentLatitude: 10.9982,
      currentLongitude: 76.9712 // Peelamedu Workshop
    },
    {
      registrationNumber: 'TN 38 EV 3311',
      vin: 'MB123456789012344',
      make: 'Tata Motors',
      model: 'Nexon EV Max Express',
      year: 2024,
      vehicleType: 'CAR',
      fuelType: 'ELECTRIC',
      status: 'ACTIVE',
      odometer: 15200.0,
      currentLatitude: 11.0168,
      currentLongitude: 76.9558 // CIT Campus Hub
    },
    {
      registrationNumber: 'TN 37 FZ 9920',
      vin: 'MB123456789012345',
      make: 'Ashok Leyland',
      model: 'Viking 55-Seater Staff Bus',
      year: 2020,
      vehicleType: 'BUS',
      fuelType: 'DIESEL',
      status: 'ACTIVE',
      odometer: 92150.0,
      currentLatitude: 10.9785,
      currentLongitude: 76.9421 // Ukkadam Junction
    },
    {
      registrationNumber: 'TN 39 AX 7712',
      vin: 'MB123456789012346',
      make: 'Eicher',
      model: 'Pro 2049 CNG Cargo',
      year: 2023,
      vehicleType: 'TRUCK',
      fuelType: 'CNG',
      status: 'ACTIVE',
      odometer: 33500.0,
      currentLatitude: 11.0512,
      currentLongitude: 77.0650 // Coimbatore Airport Cargo
    }
  ];

  const vehicleMap = {};
  for (const v of vehicleSeeds) {
    const existing = await prisma.vehicle.findFirst({
      where: { companyId, registrationNumber: v.registrationNumber }
    });

    let vehicle;
    if (existing) {
      vehicle = await prisma.vehicle.update({
        where: { id: existing.id },
        data: v
      });
    } else {
      vehicle = await prisma.vehicle.create({
        data: { ...v, companyId }
      });
    }
    vehicleMap[v.registrationNumber] = vehicle;
    console.log(`   🚚 Vehicle: ${vehicle.registrationNumber} - ${vehicle.make} ${vehicle.model} [${vehicle.status}]`);
  }

  // 6. Vehicle Assignments
  const assignmentPairs = [
    { vehicleReg: 'TN 37 CY 4501', driverCode: 'DRV-101' },
    { vehicleReg: 'TN 38 BE 1092', driverCode: 'DRV-102' },
    { vehicleReg: 'TN 38 EV 3311', driverCode: 'DRV-103' },
    { vehicleReg: 'TN 37 FZ 9920', driverCode: 'DRV-104' },
    { vehicleReg: 'TN 39 AX 7712', driverCode: 'DRV-105' }
  ];

  for (const pair of assignmentPairs) {
    const v = vehicleMap[pair.vehicleReg];
    const d = driverMap[pair.driverCode];
    if (v && d) {
      const existingAssignment = await prisma.vehicleAssignment.findFirst({
        where: { companyId, vehicleId: v.id, driverId: d.id, isActive: true }
      });

      if (!existingAssignment) {
        await prisma.vehicleAssignment.create({
          data: {
            companyId,
            vehicleId: v.id,
            driverId: d.id,
            isActive: true,
            assignedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000)
          }
        });
        console.log(`   🔗 Assigned: ${d.name} -> ${v.registrationNumber}`);
      }
    }
  }

  // 7. Trips
  const tripSeeds = [
    {
      tripNumber: 'TRIP-2026-001',
      vehicleReg: 'TN 37 CY 4501',
      driverCode: 'DRV-101',
      originName: 'CIT Main Campus, Civil Aerodrome Post',
      originLatitude: 11.0168,
      originLongitude: 76.9558,
      destinationName: 'Coimbatore Airport Cargo Terminal',
      destinationLatitude: 11.0512,
      destinationLongitude: 77.0650,
      status: 'IN_PROGRESS',
      scheduledStartAt: new Date(Date.now() - 2 * 3600 * 1000),
      actualStartAt: new Date(Date.now() - 2 * 3600 * 1000),
      odometerStart: 48220.0,
      distanceKm: 30.0,
      notes: 'Priority equipment dispatch for research lab.'
    },
    {
      tripNumber: 'TRIP-2026-002',
      vehicleReg: 'TN 38 BE 1092',
      driverCode: 'DRV-102',
      originName: 'Gandhipuram Logistics Yard',
      originLatitude: 11.0024,
      originLongitude: 76.9654,
      destinationName: 'Saravanampatti Tech Park',
      destinationLatitude: 11.0820,
      destinationLongitude: 76.9950,
      status: 'IN_PROGRESS',
      scheduledStartAt: new Date(Date.now() - 1 * 3600 * 1000),
      actualStartAt: new Date(Date.now() - 1 * 3600 * 1000),
      odometerStart: 24165.0,
      distanceKm: 15.0,
      notes: 'Inter-campus document and asset distribution.'
    },
    {
      tripNumber: 'TRIP-2026-003',
      vehicleReg: 'TN 38 EV 3311',
      driverCode: 'DRV-103',
      originName: 'CIT Guest House',
      originLatitude: 11.0168,
      originLongitude: 76.9558,
      destinationName: 'Coimbatore Junction Railway Station',
      destinationLatitude: 10.9980,
      destinationLongitude: 76.9630,
      status: 'COMPLETED',
      scheduledStartAt: new Date(Date.now() - 24 * 3600 * 1000),
      actualStartAt: new Date(Date.now() - 24 * 3600 * 1000),
      actualEndAt: new Date(Date.now() - 22 * 3600 * 1000),
      odometerStart: 15175.0,
      odometerEnd: 15200.0,
      distanceKm: 25.0,
      notes: 'Executive faculty transit - EV VIP service.'
    },
    {
      tripNumber: 'TRIP-2026-004',
      vehicleReg: 'TN 37 FZ 9920',
      driverCode: 'DRV-104',
      originName: 'Pollachi Bus Stand',
      originLatitude: 10.6580,
      originLongitude: 77.0080,
      destinationName: 'CIT Campus Terminal',
      destinationLatitude: 11.0168,
      destinationLongitude: 76.9558,
      status: 'COMPLETED',
      scheduledStartAt: new Date(Date.now() - 48 * 3600 * 1000),
      actualStartAt: new Date(Date.now() - 48 * 3600 * 1000),
      actualEndAt: new Date(Date.now() - 46 * 3600 * 1000),
      odometerStart: 92100.0,
      odometerEnd: 92150.0,
      distanceKm: 50.0,
      notes: 'Morning student shuttle route 4B.'
    },
    {
      tripNumber: 'TRIP-2026-005',
      vehicleReg: 'TN 39 AX 7712',
      driverCode: 'DRV-105',
      originName: 'TIDEL Park Coimbatore',
      originLatitude: 11.0250,
      originLongitude: 77.0180,
      destinationName: 'Kovaipudur Delivery Depot',
      destinationLatitude: 10.9320,
      destinationLongitude: 76.9520,
      status: 'PLANNED',
      scheduledStartAt: new Date(Date.now() + 18 * 3600 * 1000),
      odometerStart: 33500.0,
      distanceKm: 22.0,
      notes: 'Scheduled afternoon supply shipment.'
    }
  ];

  const tripMap = {};
  for (const t of tripSeeds) {
    const v = vehicleMap[t.vehicleReg];
    const d = driverMap[t.driverCode];
    if (!v || !d) continue;

    const existing = await prisma.trip.findFirst({
      where: { companyId, tripNumber: t.tripNumber }
    });

    const tripData = {
      companyId,
      vehicleId: v.id,
      driverId: d.id,
      tripNumber: t.tripNumber,
      originName: t.originName,
      originLatitude: t.originLatitude,
      originLongitude: t.originLongitude,
      destinationName: t.destinationName,
      destinationLatitude: t.destinationLatitude,
      destinationLongitude: t.destinationLongitude,
      status: t.status,
      scheduledStartAt: t.scheduledStartAt,
      scheduledEndAt: t.scheduledEndAt || null,
      actualStartAt: t.actualStartAt || null,
      actualEndAt: t.actualEndAt || null,
      odometerStart: t.odometerStart,
      odometerEnd: t.odometerEnd || null,
      distanceKm: t.distanceKm || null,
      notes: t.notes
    };

    let trip;
    if (existing) {
      trip = await prisma.trip.update({
        where: { id: existing.id },
        data: tripData
      });
    } else {
      trip = await prisma.trip.create({
        data: tripData
      });
    }
    tripMap[t.tripNumber] = trip;
    console.log(`   🗺️ Trip: ${trip.tripNumber} (${trip.status}) - ${trip.originName} -> ${trip.destinationName}`);
  }

  // 8. Telemetry Points
  console.log('   📡 Generating telemetry stream for active and historical trips...');
  const telemetryList = [];
  
  // Trip 1 active telemetry points
  const t1 = tripMap['TRIP-2026-001'];
  const v1 = vehicleMap['TN 37 CY 4501'];
  if (t1 && v1) {
    const coords = [
      { lat: 11.0168, lng: 76.9558, speed: 0, fuel: 85.0, eng: 'ON', odo: 48220.0, mins: 120 },
      { lat: 11.0210, lng: 76.9750, speed: 45.2, fuel: 84.5, eng: 'ON', odo: 48225.0, mins: 90 },
      { lat: 11.0250, lng: 77.0010, speed: 62.8, fuel: 83.8, eng: 'ON', odo: 48235.0, mins: 60 },
      { lat: 11.0287, lng: 77.0275, speed: 58.4, fuel: 82.5, eng: 'ON', odo: 48250.0, mins: 10 }
    ];

    for (const c of coords) {
      telemetryList.push({
        companyId,
        vehicleId: v1.id,
        tripId: t1.id,
        timestamp: new Date(Date.now() - c.mins * 60 * 1000),
        latitude: c.lat,
        longitude: c.lng,
        speedKph: c.speed,
        heading: 75.0,
        fuelLevel: c.fuel,
        engineStatus: c.eng,
        odometer: c.odo
      });
    }
  }

  // Trip 2 active telemetry points
  const t2 = tripMap['TRIP-2026-002'];
  const v2 = vehicleMap['TN 38 BE 1092'];
  if (t2 && v2) {
    const coords = [
      { lat: 11.0024, lng: 76.9654, speed: 0, fuel: 92.0, eng: 'ON', odo: 24165.0, mins: 60 },
      { lat: 11.0350, lng: 76.9780, speed: 38.5, fuel: 91.2, eng: 'ON', odo: 24172.0, mins: 30 },
      { lat: 11.0600, lng: 76.9890, speed: 42.0, fuel: 90.0, eng: 'ON', odo: 24180.0, mins: 5 }
    ];

    for (const c of coords) {
      telemetryList.push({
        companyId,
        vehicleId: v2.id,
        tripId: t2.id,
        timestamp: new Date(Date.now() - c.mins * 60 * 1000),
        latitude: c.lat,
        longitude: c.lng,
        speedKph: c.speed,
        heading: 30.0,
        fuelLevel: c.fuel,
        engineStatus: c.eng,
        odometer: c.odo
      });
    }
  }

  if (telemetryList.length > 0) {
    await prisma.telemetry.createMany({
      data: telemetryList,
      skipDuplicates: true
    });
    console.log(`   ✅ Seeded ${telemetryList.length} telemetry readings.`);
  }

  // 9. Maintenance Schedules
  const scheduleSeeds = [
    {
      vehicleReg: 'TN 37 CY 4501',
      name: 'Engine Oil & Filter Service (10,000 km)',
      description: 'Full synthetic 15W-40 oil replacement, fuel filter & oil filter change.',
      serviceType: 'OIL_CHANGE',
      triggerType: 'TIME_OR_ODOMETER',
      intervalKm: 10000.0,
      intervalDays: 180,
      lastServiceAt: new Date(Date.now() - 150 * 24 * 3600 * 1000),
      lastServiceOdometer: 38500.0,
      nextDueAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      nextDueOdometer: 48500.0,
      isActive: true
    },
    {
      vehicleReg: 'TN 37 DE 8840',
      name: 'Heavy Duty Brake Pad & Rotor Overhaul',
      description: 'Front and rear brake pad replacement, hydraulic fluid purge.',
      serviceType: 'BRAKE_SERVICE',
      triggerType: 'ODOMETER',
      intervalKm: 25000.0,
      lastServiceAt: new Date(Date.now() - 300 * 24 * 3600 * 1000),
      lastServiceOdometer: 50000.0,
      nextDueAt: new Date(Date.now() - 10 * 24 * 3600 * 1000), // OVERDUE
      nextDueOdometer: 75000.0,
      isActive: true
    },
    {
      vehicleReg: 'TN 38 EV 3311',
      name: 'High Voltage Battery Diagnostics & Coolant Check',
      description: 'BMS health telemetry scan, battery pack thermal management inspection.',
      serviceType: 'BATTERY',
      triggerType: 'TIME',
      intervalDays: 365,
      lastServiceAt: new Date(Date.now() - 200 * 24 * 3600 * 1000),
      lastServiceOdometer: 5000.0,
      nextDueAt: new Date(Date.now() + 165 * 24 * 3600 * 1000),
      nextDueOdometer: 20000.0,
      isActive: true
    },
    {
      vehicleReg: 'TN 37 FZ 9920',
      name: '6-Wheel Tire Rotation & Computerized Alignment',
      description: 'Radial wear balancing, air pressure sensor calibration.',
      serviceType: 'TIRE_SERVICE',
      triggerType: 'ODOMETER',
      intervalKm: 15000.0,
      lastServiceAt: new Date(Date.now() - 80 * 24 * 3600 * 1000),
      lastServiceOdometer: 80000.0,
      nextDueAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      nextDueOdometer: 95000.0,
      isActive: true
    }
  ];

  const scheduleMap = {};
  for (const s of scheduleSeeds) {
    const v = vehicleMap[s.vehicleReg];
    if (!v) continue;

    const existing = await prisma.maintenanceSchedule.findFirst({
      where: { companyId, vehicleId: v.id, name: s.name }
    });

    const sData = {
      companyId,
      vehicleId: v.id,
      name: s.name,
      description: s.description,
      serviceType: s.serviceType,
      triggerType: s.triggerType,
      intervalKm: s.intervalKm || null,
      intervalDays: s.intervalDays || null,
      lastServiceAt: s.lastServiceAt || null,
      lastServiceOdometer: s.lastServiceOdometer || null,
      nextDueAt: s.nextDueAt || null,
      nextDueOdometer: s.nextDueOdometer || null,
      isActive: s.isActive
    };

    let schedule;
    if (existing) {
      schedule = await prisma.maintenanceSchedule.update({
        where: { id: existing.id },
        data: sData
      });
    } else {
      schedule = await prisma.maintenanceSchedule.create({
        data: sData
      });
    }
    scheduleMap[s.name] = schedule;
    console.log(`   🔧 Schedule: ${schedule.name} -> ${v.registrationNumber}`);
  }

  // 10. Maintenance Records
  const recordSeeds = [
    {
      vehicleReg: 'TN 37 CY 4501',
      scheduleName: 'Engine Oil & Filter Service (10,000 km)',
      serviceType: 'OIL_CHANGE',
      description: 'Scheduled periodic 38,000 km oil service with Mobil Delvac synthetic.',
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 150 * 24 * 3600 * 1000),
      completedAt: new Date(Date.now() - 150 * 24 * 3600 * 1000 + 4 * 3600 * 1000),
      odometerAtService: 38500.0,
      cost: 4500.00,
      vendor: 'Sri Ram Auto Service, Peelamedu',
      notes: 'Vehicle in top condition. Oil filter replaced.'
    },
    {
      vehicleReg: 'TN 37 DE 8840',
      scheduleName: 'Heavy Duty Brake Pad & Rotor Overhaul',
      serviceType: 'BRAKE_SERVICE',
      description: 'Brake pads worn down to 2mm. Caliper inspection underway.',
      status: 'IN_PROGRESS',
      startedAt: new Date(Date.now() - 6 * 3600 * 1000),
      odometerAtService: 76400.0,
      cost: 8200.00,
      vendor: 'TVS Mobility Center, Coimbatore',
      notes: 'Awaiting replacement ceramic rotor parts.'
    },
    {
      vehicleReg: 'TN 38 EV 3311',
      scheduleName: 'High Voltage Battery Diagnostics & Coolant Check',
      serviceType: 'GENERAL_SERVICE',
      description: 'Periodic inspection and cabin AC filter disinfection.',
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 90 * 24 * 3600 * 1000),
      completedAt: new Date(Date.now() - 90 * 24 * 3600 * 1000 + 2 * 3600 * 1000),
      odometerAtService: 10000.0,
      cost: 1800.00,
      vendor: 'Tata Motors Authorized EV Service',
      notes: 'BMS firmware updated to version 4.2.1.'
    }
  ];

  for (const r of recordSeeds) {
    const v = vehicleMap[r.vehicleReg];
    const s = scheduleMap[r.scheduleName];
    if (!v) continue;

    const existing = await prisma.maintenanceRecord.findFirst({
      where: { companyId, vehicleId: v.id, serviceType: r.serviceType, status: r.status }
    });

    if (!existing) {
      await prisma.maintenanceRecord.create({
        data: {
          companyId,
          vehicleId: v.id,
          scheduleId: s?.id || null,
          serviceType: r.serviceType,
          description: r.description,
          status: r.status,
          startedAt: r.startedAt || null,
          completedAt: r.completedAt || null,
          odometerAtService: r.odometerAtService || null,
          cost: r.cost || null,
          vendor: r.vendor || null,
          notes: r.notes || null,
          createdBy: userMap['2403717672622040@cit.edu.in']?.id || null
        }
      });
      console.log(`   📋 Record: ${r.serviceType} (${r.status}) - ${v.registrationNumber}`);
    }
  }

  // 11. Alerts
  const alertSeeds = [
    {
      vehicleReg: 'TN 37 DE 8840',
      scheduleName: 'Heavy Duty Brake Pad & Rotor Overhaul',
      type: 'MAINTENANCE_OVERDUE',
      severity: 'CRITICAL',
      title: 'Brake Service Overdue (1,400 km past threshold)',
      message: 'Vehicle TN 37 DE 8840 exceeded scheduled brake service interval at 75,000 km (current: 76,400 km). Vehicle grounded for safety.',
      status: 'OPEN'
    },
    {
      vehicleReg: 'TN 37 CY 4501',
      scheduleName: 'Engine Oil & Filter Service (10,000 km)',
      type: 'MAINTENANCE_DUE',
      severity: 'WARNING',
      title: 'Engine Oil Service Approaching Threshold',
      message: 'Vehicle TN 37 CY 4501 is within 250 km of next scheduled oil change (48,500 km). Schedule appointment with vendor.',
      status: 'OPEN'
    },
    {
      vehicleReg: 'TN 38 EV 3311',
      type: 'OTHER',
      severity: 'INFO',
      title: 'Fast Charging Completed at CIT Campus Hub',
      message: 'Vehicle TN 38 EV 3311 battery charged to 100% (405 km range available). Ready for dispatch.',
      status: 'RESOLVED',
      resolvedAt: new Date(Date.now() - 3 * 3600 * 1000)
    }
  ];

  for (const a of alertSeeds) {
    const v = vehicleMap[a.vehicleReg];
    const s = scheduleMap[a.scheduleName];
    if (!v) continue;

    const existing = await prisma.alert.findFirst({
      where: { companyId, vehicleId: v.id, title: a.title }
    });

    if (!existing) {
      await prisma.alert.create({
        data: {
          companyId,
          vehicleId: v.id,
          maintenanceScheduleId: s?.id || null,
          type: a.type,
          severity: a.severity,
          title: a.title,
          message: a.message,
          status: a.status,
          resolvedAt: a.resolvedAt || null
        }
      });
      console.log(`   ⚠️ Alert: [${a.severity}] ${a.title}`);
    }
  }

  // 12. Audit Logs
  const auditSeeds = [
    {
      action: 'TENANT_ONBOARDED',
      entityType: 'COMPANY',
      entityId: companyId,
      metadata: { plan: 'ENTERPRISE', maxVehicles: 100 }
    },
    {
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: userMap['2403717672622040@cit.edu.in']?.id,
      metadata: { role: 'ADMIN', initialSetup: true }
    },
    {
      action: 'VEHICLE_CREATED',
      entityType: 'VEHICLE',
      entityId: vehicleMap['TN 37 CY 4501']?.id,
      metadata: { registrationNumber: 'TN 37 CY 4501', type: 'TRUCK' }
    },
    {
      action: 'MAINTENANCE_CREATED',
      entityType: 'MAINTENANCE_SCHEDULE',
      metadata: { serviceType: 'OIL_CHANGE', intervalKm: 10000 }
    },
    {
      action: 'REPORT_EXPORTED',
      entityType: 'REPORT',
      metadata: { reportType: 'UTILIZATION', format: 'CSV', recordsCount: 6 }
    }
  ];

  for (const log of auditSeeds) {
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: userMap['2403717672622040@cit.edu.in']?.id || null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId ? String(log.entityId) : null,
        metadata: log.metadata,
        ipAddress: '127.0.0.1',
        userAgent: 'FleetCore Seeder Script'
      }
    });
  }
  console.log(`   📜 Seeded ${auditSeeds.length} audit logs.`);

  // 13. Populate Redis Live State (if Redis is accessible)
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';
    const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    redis.on('error', () => {});
    await redis.connect();

    console.log('   ⚡ Populating Redis Live Fleet Cache...');
    for (const v of Object.values(vehicleMap)) {
      const key = `fleetcore:company:${companyId}:vehicle:${v.id}:state`;
      const state = {
        vehicleId: v.id,
        registrationNumber: v.registrationNumber,
        make: v.make,
        model: v.model,
        vehicleType: v.vehicleType,
        fuelType: v.fuelType,
        status: v.status,
        latitude: v.currentLatitude,
        longitude: v.currentLongitude,
        speedKph: v.status === 'ACTIVE' ? (v.vehicleType === 'BUS' ? 42.0 : 56.5) : 0.0,
        fuelLevel: v.fuelType === 'ELECTRIC' ? 95.0 : 82.0,
        engineStatus: v.status === 'ACTIVE' ? 'ON' : 'OFF',
        odometer: v.odometer,
        timestamp: new Date().toISOString()
      };
      await redis.set(key, JSON.stringify(state), 'EX', 86400);
    }
    await redis.quit();
    console.log('   ✅ Redis Live Fleet Cache initialized.');
  } catch (err) {
    console.log(`   ℹ️ Redis cache skip (${err.message}). Database records remain primary source.`);
  }

  console.log('\n🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
