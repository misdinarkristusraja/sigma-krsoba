/**
 * Generate .ics files for Google Calendar / Apple Calendar / Outlook
 */

interface ICSEvent {
  start:       string;
  end:         string;
  title:       string;
  description?: string;
}

interface ICSEventParams {
  uid:            string;
  summary:        string;
  description:    string;
  location?:      string;
  dtstart:        string;
  dtend:          string;
  alarm_minutes?: number;
}

interface AssignmentForICS {
  event_id:    string;
  slot_number: number;
  events?: {
    tanggal_tugas?:    string;
    tanggal_latihan?:  string;
    perayaan?:         string;
    nama_event?:       string;
    draft_note?:       string;
  };
}

export function exportToICS(events: ICSEvent[]): void {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//sigma-kr//sigma-kr//EN',
  ];

  events.forEach(event => {
    const start = event.start.replace(/[-:]/g, '');
    const end   = event.end.replace(/[-:]/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${event.title}`);
    if (event.description) lines.push(`DESCRIPTION:${event.description}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'schedule.ics';
  a.click();
  URL.revokeObjectURL(url);
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

function toICSDateTime(dateStr: string, timeStr = '07:00'): string {
  const dt = dateStr.replace(/-/g, '');
  const tm = timeStr.replace(':', '').replace('.', '') + '00';
  return `${dt}T${tm}`;
}

function escapeICS(str: string): string {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function icsEvent({ uid, summary, description, location, dtstart, dtend, alarm_minutes = 60 }: ICSEventParams): string {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
    `DTSTART;TZID=Asia/Jakarta:${dtstart}`,
    `DTEND;TZID=Asia/Jakarta:${dtend}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT' + alarm_minutes + 'M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${escapeICS(summary)}`,
    'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}

export function generateICS(assignments: AssignmentForICS[], userName = ''): string {
  const events: string[] = [];

  assignments.forEach(a => {
    const ev       = a.events || {};
    const name     = ev.perayaan || ev.nama_event || 'Misa';
    const slot     = a.slot_number || 1;
    const slotLabel = ({ 1:'Sabtu 17:30', 2:'Minggu 06:00', 3:'Minggu 08:00', 4:'Minggu 17:30' } as Record<number,string>)[slot] || '';

    if (ev.tanggal_tugas) {
      const timeMap: Record<number, string> = { 1: '17:30', 2: '06:00', 3: '08:00', 4: '17:30' };
      const startTime = timeMap[slot] || '07:00';
      const [sh, sm]  = startTime.split(':').map(Number);
      const endHour   = pad(sh + 2);
      const dtstart   = toICSDateTime(ev.tanggal_tugas, startTime);
      const dtend     = toICSDateTime(ev.tanggal_tugas, `${endHour}:${pad(sm)}`);

      events.push(icsEvent({
        uid:         `sigma-tugas-${a.event_id}-${slot}-${Date.now()}`,
        summary:     `⛪ TUGAS MISDINAR — ${name} (${slotLabel})`,
        description: `Jadwal tugas Misdinar Kristus Raja Solo Baru\nNama: ${userName}\nSlot: ${slotLabel}\nPerayaan: ${name}`,
        location:    'Gereja Kristus Raja, Solo Baru',
        dtstart, dtend,
        alarm_minutes: 1440,
      }));
    }

    if (ev.tanggal_latihan) {
      const dtstart = toICSDateTime(ev.tanggal_latihan, '08:00');
      const dtend   = toICSDateTime(ev.tanggal_latihan, '10:00');

      events.push(icsEvent({
        uid:         `sigma-latihan-${a.event_id}-${Date.now()}`,
        summary:     `🏋️ LATIHAN MISDINAR — ${name}`,
        description: `Jadwal latihan sebelum tugas\nNama: ${userName}\nPerayaan: ${name}`,
        location:    'Gereja Kristus Raja, Solo Baru',
        dtstart, dtend,
        alarm_minutes: 60,
      }));
    }
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIGMA Misdinar KR//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Jadwal Misdinar SIGMA',
    'X-WR-TIMEZONE:Asia/Jakarta',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadICS(ics: string, filename = 'jadwal-misdinar.ics'): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export function openGoogleCalendar(ev: { perayaan?: string; nama_event?: string; tanggal_tugas?: string }): void {
  const name = ev.perayaan || ev.nama_event || 'Misa';
  const date = (ev.tanggal_tugas || '').replace(/-/g, '');
  const url  = `https://calendar.google.com/calendar/render?action=TEMPLATE`
    + `&text=${encodeURIComponent('⛪ TUGAS: ' + name)}`
    + `&dates=${date}T073000/${date}T093000`
    + `&details=${encodeURIComponent('Jadwal tugas Misdinar Kristus Raja Solo Baru')}`
    + `&location=${encodeURIComponent('Gereja Kristus Raja, Solo Baru')}`;
  window.open(url, '_blank');
}
