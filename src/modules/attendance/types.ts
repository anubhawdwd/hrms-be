export type AttendanceSource = "WEB" | "PWA";

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface CheckInDTO {
  employeeId: string;
  companyId: string;
  source: "WEB" | "PWA";
  location: GeoLocation;
}

export interface CheckOutDTO {
  employeeId: string;
  companyId: string;
  source: "WEB" | "PWA";
  location: GeoLocation;
}
export interface GetAttendanceDayQuery {
  employeeId: string;
  companyId: string;
  date: string; // ISO date (YYYY-MM-DD)
}

export interface GetAttendanceRangeQuery {
  employeeId: string;
  companyId: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}
