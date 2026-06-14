const path = require("path");
const appConfig = require(path.join("..", "app.json"));

const extra = appConfig.expo?.extra || {};
const plugins = appConfig.expo?.plugins || [];

const APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;

const appIdFields = [
  ["Android app ID", "androidAppId"],
  ["iOS app ID", "iosAppId"],
];

const unitFields = [
  ["Android banner", "adMobAndroidBannerId"],
  ["iOS banner", "adMobIosBannerId"],
  ["Android rewarded", "adMobAndroidRewardedId"],
  ["iOS rewarded", "adMobIosRewardedId"],
  ["Android rewarded interstitial", "adMobAndroidRewardedInterstitialId", true],
  ["iOS rewarded interstitial", "adMobIosRewardedInterstitialId", true],
  ["Android native", "adMobAndroidNativeId"],
  ["iOS native", "adMobIosNativeId"],
  ["Android app open", "adMobAndroidAppOpenId"],
  ["iOS app open", "adMobIosAppOpenId"],
];

function findGoogleMobileAdsPlugin() {
  return plugins.find((plugin) => {
    if (Array.isArray(plugin)) return plugin[0] === "./plugins/withGoogleMobileAds";
    return plugin === "./plugins/withGoogleMobileAds";
  });
}

function getPluginOptions() {
  const plugin = findGoogleMobileAdsPlugin();
  return Array.isArray(plugin) ? plugin[1] || {} : {};
}

function check(label, value, pattern, hint) {
  if (pattern.test(value || "")) {
    console.log(`OK   ${label}: ${value}`);
    return true;
  }

  console.error(`FAIL ${label}: ${value || "(missing)"}`);
  console.error(`     Expected ${hint}`);
  return false;
}

const pluginOptions = getPluginOptions();
let valid = true;

console.log("Checking AdMob app IDs...");
for (const [label, key] of appIdFields) {
  valid = check(label, pluginOptions[key], APP_ID_PATTERN, "ca-app-pub-################~##########") && valid;
}

console.log("\nChecking AdMob ad unit IDs...");
for (const [label, key, optional] of unitFields) {
  if (optional && !extra[key]) {
    console.warn(`WARN ${label}: missing (optional until this ad unit is enabled)`);
    continue;
  }
  valid = check(label, extra[key], UNIT_ID_PATTERN, "ca-app-pub-################/##########") && valid;
}

console.log(`\nAds enabled: ${extra.adMobAdsEnabled !== false}`);
console.log(`Force test ads: ${Boolean(extra.adMobUseTestAds)}`);

if (!valid) {
  process.exitCode = 1;
}
