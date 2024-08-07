// Require Dependencies
const express = require("express");
const router = (module.exports = express.Router());
const { check, validationResult } = require("express-validator");
const {
  toggleMaintenance,
  getMaintenanceState,
  toggleLogin,
  getLoginState,
  toggleDeposits,
  getDepositState,
  toggleWithdraws,
  getWithdrawState,
  toggleCoinflip,
  getCoinflipState,
  toggleBattles,
  getBattlesState,
  toggleRoulette,
  getRouletteState,
  toggleCrash,
  getCrashState,
  toggleCashapp,
  getCashappState,
  toggleCases,
  getCasesState
} = require("../../../controllers/site-settings");

/**
 * @route   GET /api/external/v1/controls/
 * @desc    Get toggle states
 * @access  Private
 */
router.get("/", async (req, res) => {
  return res.json({
    maintenanceEnabled: getMaintenanceState(),
    loginEnabled: getLoginState(),
    depositsEnabled: getDepositState(),
    withdrawsEnabled: getWithdrawState(),
    coinflipEnabled: getCoinflipState(),
    battlesEnabled: getBattlesState(),
    cashappEnabled: getCashappState(),
    rouletteEnabled: getRouletteState(),
    crashEnabled: getCrashState(),
  });
});

/**
 * @route   POST /api/external/v1/controls/toggle-state
 * @desc    Toggle states on the site
 * @access  Private
 */
router.post(
  "/toggle-state",
  [
    check("name", "Toggle name is required")
      .isString()
      .isIn([
        "maintenance",
        "login",
        "deposits",
        "withdraws",
        "coinflip",
        "battles",
        "cashapp",
        "roulette",
        "crash",
        "cases"
      ]),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      res.status(400);
      return res.json({ errors: errors.array() });
    }

    const { name } = req.body;

    // Switch from possible toggles
    switch (name) {
      case "maintenance":
      default:
        // Toggle maintenance status
        toggleMaintenance();

        return res.json({
          currentState: getMaintenanceState(),
        });
      case "login":
        // Toggle login status
        toggleLogin();

        return res.json({
          currentState: getLoginState(),
        });
      case "deposits":
        // Toggle deposit status
        toggleDeposits();

        return res.json({
          currentState: getDepositState(),
        });
      case "withdraws":
        // Toggle withdraw status
        toggleWithdraws();

        return res.json({
          currentState: getWithdrawState(),
        });
      case "coinflip":
        // Toggle coinflip status
        toggleCoinflip();

        return res.json({
          currentState: getCoinflipState(),
        });
      case "battles":
        // Toggle Battles status
        toggleBattles();

        return res.json({
          currentState: getBattlesState(),
        });
      case "roulette":
        // Toggle Roulette status
        toggleRoulette();

        return res.json({
          currentState: getRouletteState(),
        });
      case "crash":
        // Toggle Crash status
        toggleCrash();

        return res.json({
          currentState: getCrashState(),
        });
      case "cashapp":
        // Toggle Crash status
        toggleCashapp();

        return res.json({
          currentState: getCashappState(),
        });
      case "cases":
        // Toggle Crash status
        toggleCases();

        return res.json({
          currentState: getCasesState(),
        });
    }
  }
);
