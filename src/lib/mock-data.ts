export const EMPLOYEES = [
  { id: 'EMP001', name: 'Arjun Mehta', gender: 'male', role: 'Machine Operator', rate: 450, shift: '12-hour' },
  { id: 'EMP002', name: 'Priya Sharma', gender: 'female', role: 'Quality Lead', rate: 550, shift: '9-hour' },
  { id: 'EMP003', name: 'Rajesh Kumar', gender: 'male', role: 'Floor Supervisor', rate: 650, shift: '12-hour' },
  { id: 'EMP004', name: 'Ananya Iyer', gender: 'female', role: 'Logistics Coord', rate: 400, shift: '9-hour' },
  { id: 'EMP005', name: 'Vikram Singh', gender: 'male', role: 'Maintenance Tech', rate: 600, shift: '12-hour' },
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
