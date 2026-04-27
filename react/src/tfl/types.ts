export type StopPoint = {
  id: string;
  naptanId?: string;
  commonName?: string;
  stopLetter?: string;
  stopType?: string;
  modes?: string[];
  children?: StopPoint[];
  lat?: number;
  lon?: number;
};

export type NearbyStopPointsResponse = {
  stopPoints: StopPoint[];
  pageSize?: number;
  total?: number;
  page?: number;
};

export type StopPointSearchResponse = {
  matches: StopPoint[];
};

export type ArrivalPrediction = {
  id?: string;
  lineName: string;
  destinationName?: string;
  stationName?: string;
  timeToStation: number;
};

export type BusStop = {
  id: string;
  name: string;
  location: GeoLocation | null;
  mode: "bus" | "tube";
};

export type GeoLocation = {
  lat: number;
  lon: number;
};

export type Departure = {
  prediction: ArrivalPrediction;
  stopName: string;
};
