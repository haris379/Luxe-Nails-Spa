// Sample business details. Replace with the real salon's information.
export const business = {
  name: 'Luxe Nails',
  timezone: 'Asia/Manila',
  // Sample contact details used in emails
  contact: { phone: '(046) 123-4567', email: 'info@luxenails.com', address: 'Rosario, Cavite, Philippines' },
  slotMinutes: 30,
  minLeadMinutes: 60, // same-day bookings must start at least this far ahead
  maxAdvanceDays: 90,
  // 0 = Sunday ... 6 = Saturday
  hours: {
    0: { open: '11:00', close: '18:00' },
    1: { open: '09:00', close: '20:00' },
    2: { open: '09:00', close: '20:00' },
    3: { open: '09:00', close: '20:00' },
    4: { open: '09:00', close: '20:00' },
    5: { open: '09:00', close: '20:00' },
    6: { open: '10:00', close: '19:00' },
  },
  // Sample technicians
  technicians: [
    { id: 'ana', name: 'Ana' },
    { id: 'bea', name: 'Bea' },
    { id: 'carla', name: 'Carla' },
  ],
};
