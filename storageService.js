// Define a global object to hold storage functions
window.storageService = {
  // async getSeenPosts() {
  //   return new Promise((resolve) => {
  //     chrome.storage.local.get(["seenPosts"], (data) =>
  //       resolve(data.seenPosts || {})
  //     );
  //   });
  // },

  // async setSeenPosts(seenPosts) {
  //   return new Promise((resolve) => {
  //     chrome.storage.local.set({ seenPosts }, () => resolve());
  //   });
  // },

  async getSettings(settings) {
    console.log("Getting settings");
    return new Promise((resolve) => {
      chrome.storage.sync.get(settings || [], (data) => resolve(data));
    });
  },

  async setSettings(settings) {
    console.log("Setting settings:", settings);
    return new Promise((resolve) => {
      chrome.storage.sync.set(settings, () => resolve());
    });
  },
};
