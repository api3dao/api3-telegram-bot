/**
 * Get the current date in human readable form, UTC only.
 * Used to name folders in the file-db structure. (cheap DB)
 *
 *
 * @param {*} day
 * @returns {string} the UTC date in human readable form
 */
function getDateUtcDbFormat() {
  const today = new Date();
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC'
  };
  return today.toLocaleDateString(undefined, options) + ' (UTC)';
}

module.exports = {
  getDateUtcDbFormat
};
