// Client bootstrap: bind the engine to localStorage with the Stanley seed.
import { configure } from './db.ts';
import { seedData } from './seed.ts';

configure({ storage: window.localStorage, seed: () => seedData() });
