// Costa Palmera — shared world constants. All units are metres, Y is up.
// The city is a grid: 60 m blocks on a 74 m pitch, 14 m roads between them.
// Block slabs are exactly 60x60 so they fit the road gap with no kerb spill.
export const PITCH = 74;
export const BLOCK = 60;
export const ROAD = 14;
export const COLS = [-148, -74, 0, 74, 148];      // block centre x
export const ROWS = [-148, -74, 0, 74];           // block centre z
export const VROADS = [-185, -111, -37, 37, 111, 185]; // vertical road centre x
export const HROADS = [-185, -111, -37, 37, 111];      // horizontal road centre z
export const BOULEVARD_Z = 111;                   // the coast road
export const BEACH_Z = 126;                       // sand starts
export const SEA_Z = 148;                         // water starts
export const CITY_MIN = -192, CITY_MAX = 192;

export const GARAGE_POS = { x: 0, z: 88 };        // Sol's Garage, south face of block (0,74)
export const PRECINCT_POS = { x: -148, z: -104 };
export const HARBOUR_POS = { x: 196, z: 111 };
export const YACHT_POS = { x: 148, z: 88 };
export const PIER_POS = { x: 60, z: 150 };

export const COLORS = {
  fog: 0xf2a56e,
  sun: 0xffd9a8,
  hero: 0xff6b4a,        // sunset coral hero coupe
  sand: 0xe8cf9e,
  sea: 0x1d6f8e,
};

export const SAVE_KEY = 'costa-palmera-save-v1';
