/**
 * User Formatter Module
 * Formats user data for display in various UI contexts.
 */

/**
 * Format a user for the sidebar widget display.
 * @param {{ id: number, username: string, email: string, displayName: string }} user
 * @returns {{ label: string, sublabel: string, id: number }}
 */
function formatForSidebar(user) {
  const truncatedName = user.displayName.length > 20 
    ? user.displayName.slice(0, 20) + '…'
    : user.displayName;
  
  return {
    label: truncatedName,
    sublabel: `@${user.username}`,
    id: user.id
  };
}

/**
 * Format a user for an admin table row.
 * @param {{ id: number, username: string, email: string, displayName: string, createdAt: string }} user
 * @returns {{ cells: string[] }}
 */
function formatForTable(user) {
  return {
    cells: [
      String(user.id),
      user.displayName,
      user.username,
      user.email,
      user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'
    ]
  };
}

/**
 * Format a user for JSON API response.
 * Strips internal fields and normalizes username to lowercase.
 * Note: API consumers depend on lowercase usernames for URL routing
 * (e.g., /users/alice not /users/Alice). Changing this breaks the
 * mobile app's deep linking.
 * @param {{ id: number, username: string, email: string, displayName: string, createdAt: string }} user
 * @returns {{ id: number, username: string, displayName: string }}
 */
function formatForApi(user) {
  return {
    id: user.id,
    username: user.username.toLowerCase(),
    displayName: user.displayName
  };
}

module.exports = { formatForSidebar, formatForTable, formatForApi };
