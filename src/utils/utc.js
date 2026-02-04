/**
 * Get the current date or adjusted date in human readable form
 * Dates are UTC only
 * Used to name folders in the file-db structure. (cheap DB)
 *
 * day === 0 returns the current date
 * day === -1 return yesterday
 * day === 1 returns tomorrow
 *
 * @param {*} day
 * @returns {string} the UTC date in human readable form
 */
function getDateUtcDbFormat(day = 0) {
  const today = new Date();
  today.setDate(today.getDate() + day);
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
