// Require Dependencies
const config = require("../config");

// Store site toggle switch states here
// and initialize them to config values
let MAINTENANCE_ENABLED = config.site.enableMaintenanceOnStart;
let LOGIN_ENABLED = config.site.enableLoginOnStart;
let DEPOSITS_ENABLED = true;
let WITHDRAWS_ENABLED = true;
let CASHAPP_ENABLED = true;
let COINFLIP_ENABLED = true;
let ROULETTE_ENABLED = true;
let CRASH_ENABLED = true;
let BATTLES_ENABLED = true;
let CASES_ENABLED = true;
let UPGRADER_ENABLED = true;

// Create getters
const getMaintenanceState = () => MAINTENANCE_ENABLED;
const getLoginState = () => LOGIN_ENABLED;
const getDepositState = () => DEPOSITS_ENABLED;
const getWithdrawState = () => WITHDRAWS_ENABLED;
const getCashappState = () => CASHAPP_ENABLED;
const getCoinflipState = () => COINFLIP_ENABLED;
const getRouletteState = () => ROULETTE_ENABLED;
const getCrashState = () => CRASH_ENABLED;
const getBattlesState = () => BATTLES_ENABLED;
const getCasesState = () => CASES_ENABLED;
const getUpgraderState = () => UPGRADER_ENABLED;


// Create reducers
const toggleMaintenance = () => {
  MAINTENANCE_ENABLED = !MAINTENANCE_ENABLED;
  return true;
};
const toggleLogin = () => {
  LOGIN_ENABLED = !LOGIN_ENABLED;
  return true;
};
const toggleDeposits = () => {
  DEPOSITS_ENABLED = !DEPOSITS_ENABLED;
  return true;
};
const toggleWithdraws = () => {
  WITHDRAWS_ENABLED = !WITHDRAWS_ENABLED;
  return true;
};
const toggleCashapp = () => {
  CASHAPP_ENABLED = !CASHAPP_ENABLED;
  return true;
};
const toggleCoinflip = () => {
  COINFLIP_ENABLED = !COINFLIP_ENABLED;
  return true;
};
const toggleRoulette = () => {
  ROULETTE_ENABLED = !ROULETTE_ENABLED;
  return true;
};
const toggleCrash = () => {
  CRASH_ENABLED = !CRASH_ENABLED;
  return true;
};
const toggleBattles = () => {
  BATTLES_ENABLED = !BATTLES_ENABLED;
  return true;
};
const toggleCases = () => {
  CASES_ENABLED = !CASES_ENABLED;
  return true;
};
const toggleUpgrader = () => {
  UPGRADER_ENABLED = !UPGRADER_ENABLED;
  return true;
};

// Combine transaction getters and reducers
const transactionState = {
  getDepositState,
  toggleDeposits,
  getWithdrawState,
  toggleWithdraws,
  getCashappState,
  toggleCashapp,
};

// Combine game getters and reducers
const gameState = {
  getCoinflipState,
  toggleCoinflip,
  getRouletteState,
  toggleRoulette,
  getCrashState,
  toggleCrash,
  getBattlesState,
  toggleBattles,
  getCasesState,
  toggleCases,
  getUpgraderState,
  toggleUpgrader
};

// Export functions
module.exports = {
  getMaintenanceState,
  toggleMaintenance,
  getLoginState,
  toggleLogin,
  ...transactionState,
  ...gameState,
};
