let accessToken: string | null = null;
let generation = 0;
export const token = {
  get: () => accessToken,
  generation: () => generation,
  set: (value: string | null) => {
    accessToken = value;
  },
  clear: () => {
    accessToken = null;
    generation += 1;
  },
};
