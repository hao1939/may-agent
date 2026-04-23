/**
 * User settings module.
 * Stores preferences in a JSON file for persistence.
 */
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'user-settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function setColor(userId, hexColor) {
  const settings = loadSettings();
  if (!settings[userId]) settings[userId] = {};
  settings[userId].color = hexColor;
  saveSettings(settings);
}

function getColor(userId) {
  const settings = loadSettings();
  return settings[userId]?.color || '#FFFFFF';
}

function getContrastColor(userId) {
  const hex = getColor(userId);
  // Parse hex to determine if color is light or dark
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

module.exports = { setColor, getColor, getContrastColor };
