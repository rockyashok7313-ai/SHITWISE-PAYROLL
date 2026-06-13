export const EMPLOYEES = [
  { id: 'EMP001', name: 'Alex Rivera', role: 'Machine Operator', rate: 25, shift: '12-hour' },
  { id: 'EMP002', name: 'Sarah Chen', role: 'Quality Lead', rate: 28, shift: '9-hour' },
  { id: 'EMP003', name: 'Marcus Miller', role: 'Floor Supervisor', rate: 32, shift: '12-hour' },
  { id: 'EMP004', name: 'Elena Rodriguez', role: 'Logistics Coord', rate: 24, shift: '9-hour' },
  { id: 'EMP005', name: 'James Wilson', role: 'Maintenance Tech', rate: 30, shift: '12-hour' },
];

export const ATTENDANCE_RECORDS = [
  {
    employeeId: 'EMP001',
    date: '2023-11-01',
    shiftType: '12-hour',
    clockIn: '08:00',
    clockOut: '20:00',
    status: 'Present',
  },
  {
    employeeId: 'EMP002',
    date: '2023-11-01',
    shiftType: '9-hour',
    clockIn: '09:00',
    clockOut: '18:00',
    status: 'Present',
  },
  {
    employeeId: 'EMP003',
    date: '2023-11-01',
    shiftType: '12-hour',
    clockIn: '08:00',
    clockOut: '20:30',
    status: 'Overtime',
  },
];
