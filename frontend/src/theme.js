export const THEMES = {
  forest: {
    "--select-color": "#1b5e20",
    "--dark-gradient": "#2e7d32",
    "--light-gradient": "#81c784",
    "--top-gradient": "#0a1f0c",
    "--menu-text": "#f1f8e9",
    "--safari-tan": "#a5d6a7",
    "--bg-start": "#e8f5e9",
    "--bg-end": "#c8e6c9",
    "--card-gradient": "#4caf50",
  },
  safari: {
    "--select-color": "#2e7d32",
    "--dark-gradient": "#6d4c41",
    "--light-gradient": "#f57c00",
    "--top-gradient": "#2d1f14",
    "--menu-text": "#fff8e1",
    "--safari-tan": "#f3e5ab",
    "--bg-start": "#f5ead6",
    "--bg-end": "#e8d4b0",
    "--card-gradient": "#87ceeb",
  },
  ocean: {
    "--select-color": "#00796b",
    "--dark-gradient": "#0d47a1",
    "--light-gradient": "#0288d1",
    "--top-gradient": "#2d1f14",
    "--menu-text": "#e1f5fe",
    "--safari-tan": "#b3e5fc",
    "--bg-start": "#e1f5fe",
    "--bg-end": "#b3e5fc",
    "--card-gradient": "#87ceeb",
  },
  desert: {
    "--select-color": "#3b2d1b",
    "--dark-gradient": "#9b7b36",
    "--light-gradient": "#fab54d",
    "--top-gradient": "#543c2c",
    "--menu-text": "#fff3e0",
    "--safari-tan": "#d7b899",
    "--bg-start": "#ffdfd1",
    "--bg-end": "#a5887a",
    "--card-gradient": "#d8e2b8",
  },
  mesa: {
    "--select-color": "#3b2d1b",
    "--dark-gradient": "#D3503D",
    "--light-gradient": "#E8872D",
    "--top-gradient": "#9A512A",
    "--menu-text": "#fff3e0",
    "--safari-tan": "#d7b899",
    "--bg-start": "#F0E5D7",
    "--bg-end": "#825034",
    "--card-gradient": "#D4A373",
  },
  arctic: {
    "--select-color": "#5C6BC0",
    "--dark-gradient": "#3949AB",
    "--light-gradient": "#7986CB",
    "--top-gradient": "#283593",
    "--menu-text": "#E8EAF6",
    "--safari-tan": "#C5CAE9",
    "--bg-start": "#F5F5FF",
    "--bg-end": "#C5CAE9",
    "--card-gradient": "#D1C4E9",
  }
};

export function applyTheme(themeObj) {
  const root = document.documentElement;
  Object.entries(themeObj).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

export function saveThemeName(name) {
  localStorage.setItem("biotrack-theme", name);
}

export function loadThemeName() {
  return localStorage.getItem("biotrack-theme") || "forest";
}