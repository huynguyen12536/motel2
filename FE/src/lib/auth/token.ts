const TOKEN_KEY = "wms-demo-token";
const demo = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

let accessToken: string | null = null;
let generation = 0;
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  accessToken = demo ? window.sessionStorage.getItem(TOKEN_KEY) : null;
}

export const token = {
  get: () => {
    hydrate();
    return accessToken;
  },
  generation: () => generation,
  set: (value: string | null) => {
    hydrate();
    accessToken = value;
    if (typeof window === "undefined" || !demo) return;
    if (value) window.sessionStorage.setItem(TOKEN_KEY, value);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  },
  clear: () => {
    hydrate();
    accessToken = null;
    generation += 1;
    if (typeof window !== "undefined")
      window.sessionStorage.removeItem(TOKEN_KEY);
  },
};
