export const copy = {
  company: 'NEXUS OFFICE',
  welcomeEyebrow: 'WELCOME',
  welcomeTitle: 'Welcome to the office',
  welcomeSubtitle: 'Walking to reception…',
  receptionistEyebrow: 'RECEPTIONIST',
  receptionistTitle: 'How can I help you?',
  receptionistSubtitle: 'Welcome in! Make yourself at home.',
  receptionSign: 'RECEPTION',
  securitySign: 'SECURITY',
  visitEyebrow: 'YOUR VISIT',
  boss: 'Boss Cabin',
  bossDoor: 'BOSS CABIN',
  follow: 'Follow your receptionist to',
  arrive: 'Please step inside.',
  finaleTagline: 'A place to do great work.',
  options: ['Work Studio', 'Design Room', 'Meeting Room', 'Operations'] as const,
  rooms: {
    'Work Studio': 'A bright place for focused work.',
    'Design Room': 'Where good ideas take shape.',
    'Meeting Room': 'Room to think, together.',
    Operations: 'Everything working in harmony.',
    'Boss Cabin': 'A little room for big ideas.',
  } as Record<string, string>,
}

export type Destination = keyof typeof copy.rooms
