import React, { useState } from "react";
import Navigation from "./Navigation";
import { THEMES, applyTheme, loadThemeName, saveThemeName } from "../theme";

// Representative colors for each theme swatch
const THEME_COLORS = {
  forest: { bg: "#e8f5e9", accent: "#2e7d32" },
  safari: { bg: "#f5ead6", accent: "#6d4c41" },
  ocean: { bg: "#0288d1", accent: "#e1f5fe" },
  desert: { bg: "#fab54d", accent: "#3b2d1b" },
  mesa: { bg: "#D3503D", accent: "#F0E5D7" },
  arctic: { bg: "#E8EAF6", accent: "#5C6BC0" },
};

function Settings({ user, onLogout }) {
  const [themeName, setThemeName] = useState(loadThemeName());

  const handleThemeChange = (name) => {
    setThemeName(name);
    applyTheme(THEMES[name]);
    saveThemeName(name);
  };

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />

      <div className="profile-container">
        <div className="profile-header">
          <h1>⚙️ Settings</h1>
          <p>Customize your BioTrack experience</p>
        </div>

        <div className="profile-sections">
          <div className="profile-section">
            <h2>🎨 Theme</h2>

            <div className="theme-grid">
              {Object.keys(THEMES).map((name) => {
                const colors = THEME_COLORS[name] || { bg: "#888", accent: "#fff" };
                const isActive = themeName === name;

                return (
                  <button
                    key={name}
                    onClick={() => handleThemeChange(name)}
                    className={`theme-btn${isActive ? ' active' : ''}`}
                  >
                    {/* Color swatch */}
                    <div className="theme-swatch" style={{ background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.accent} 100%)` }} />
                    <span className={`theme-label${isActive ? ' active' : ''}`}>
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="settings-note">
              Theme is saved on this device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;