/**
 * Utility script to clear the API limit exceeded flag and user feedback
 * Run this in the browser console on any page with the extension active
 */

// Clear the API limit flag from storage
chrome.storage.local.remove(['apiLimitExceeded', 'apiLimitTimestamp'], () => {
  console.log('✅ API limit flag cleared successfully!');
});

// Clear all user feedback (optional - uncomment to use)
// chrome.storage.local.remove(['userFeedbackDB'], () => {
//   console.log('✅ User feedback database cleared!');
// });

// Clear specific domain feedback (e.g., youtube.com)
chrome.storage.local.get('userFeedbackDB', (result) => {
  const db = result.userFeedbackDB || {};
  if (Object.keys(db).length > 0) {
    console.log('Current user feedback entries:', Object.keys(db));
    // To clear a specific domain, use:
    // delete db['youtube.com'];
    // chrome.storage.local.set({ userFeedbackDB: db });
  } else {
    console.log('No user feedback entries found.');
  }
});

console.log('PhishGuard: Storage cleanup complete. Reload the extension to apply changes.');
