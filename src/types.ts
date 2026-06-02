export type User = {
  id: number;
  email: string;
  email_verified: boolean;
};

export type AuthMode = "login" | "register";
export type AppView = "home" | "auth" | "console";

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
};

export type MapDefinition = {
  id: number;
  map_id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  coordinate_unit: string;
};

export type MapCatalog = {
  maps: MapDefinition[];
};

export type Point = {
  x: number;
  y: number;
  heading?: number | null;
};

export type RouteRead = {
  id: number;
  map_id: string;
  start: Point;
  end: Point;
  created_at: string;
  is_current: boolean;
};

export type PickMode = "start" | "end";
