const UPCOMING_DAYS_THRESHOLD = 30;
const UPCOMING_KM_THRESHOLD = 500;

/**
 * Evaluates the due status of a single maintenance schedule against current date and vehicle odometer.
 * Returns derived status ('OVERDUE' | 'UPCOMING' | 'SCHEDULED'), priority ('HIGH' | 'MEDIUM' | 'LOW'), and metadata.
 */
const calculateDueStatus = (schedule, vehicle, currentDate = new Date()) => {
  const currentOdo = vehicle ? (vehicle.odometer || 0) : 0;
  const triggerType = schedule.triggerType || 'TIME_OR_ODOMETER';

  let timeState = null;
  let daysRemaining = null;
  let daysOverdue = null;

  if ((triggerType === 'TIME' || triggerType === 'TIME_OR_ODOMETER') && schedule.nextDueAt) {
    const dueTime = new Date(schedule.nextDueAt).getTime();
    const currTime = currentDate.getTime();
    const diffDays = Math.ceil((dueTime - currTime) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      timeState = 'OVERDUE';
      daysOverdue = Math.abs(diffDays);
    } else if (diffDays <= UPCOMING_DAYS_THRESHOLD) {
      timeState = 'UPCOMING';
      daysRemaining = diffDays;
    } else {
      timeState = 'SCHEDULED';
      daysRemaining = diffDays;
    }
  }

  let odoState = null;
  let kmRemaining = null;
  let kmOverdue = null;

  if ((triggerType === 'ODOMETER' || triggerType === 'TIME_OR_ODOMETER') && schedule.nextDueOdometer != null) {
    const kmDiff = schedule.nextDueOdometer - currentOdo;
    if (kmDiff <= 0) {
      odoState = 'OVERDUE';
      kmOverdue = Math.abs(kmDiff);
    } else if (kmDiff <= UPCOMING_KM_THRESHOLD) {
      odoState = 'UPCOMING';
      kmRemaining = kmDiff;
    } else {
      odoState = 'SCHEDULED';
      kmRemaining = kmDiff;
    }
  }

  let status = 'SCHEDULED';
  let priority = 'LOW';
  const triggerReasons = [];

  if (timeState === 'OVERDUE' || odoState === 'OVERDUE') {
    status = 'OVERDUE';
    priority = 'HIGH';
    if (timeState === 'OVERDUE') triggerReasons.push(`Overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`);
    if (odoState === 'OVERDUE') triggerReasons.push(`Overdue by ${kmOverdue.toFixed(1)} km`);
  } else if (timeState === 'UPCOMING' || odoState === 'UPCOMING') {
    status = 'UPCOMING';
    priority = 'MEDIUM';
    if (timeState === 'UPCOMING') triggerReasons.push(`Due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`);
    if (odoState === 'UPCOMING') triggerReasons.push(`Due in ${kmRemaining.toFixed(1)} km`);
  } else {
    status = 'SCHEDULED';
    priority = 'LOW';
    if (daysRemaining != null) triggerReasons.push(`Due in ${daysRemaining} days`);
    if (kmRemaining != null) triggerReasons.push(`Due in ${kmRemaining.toFixed(1)} km`);
  }

  return {
    status,
    priority,
    timeState,
    daysRemaining,
    daysOverdue,
    odoState,
    kmRemaining,
    kmOverdue,
    currentOdometer: currentOdo,
    nextDueAt: schedule.nextDueAt,
    nextDueOdometer: schedule.nextDueOdometer,
    reason: triggerReasons.join(' | ') || 'On schedule'
  };
};

module.exports = {
  UPCOMING_DAYS_THRESHOLD,
  UPCOMING_KM_THRESHOLD,
  calculateDueStatus
};
