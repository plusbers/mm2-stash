/**
 * fullsendgg Backend REST API main entry file
 */

// Require Dependencies
const app = require("./controllers/express-app");
const colors = require("colors/safe");
const { Server } = require("http");
const { connectDatabase } = require("./utils");
const { createProxyMiddleware } = require('http-proxy-middleware');
const { startSocketServer } = require("./controllers/websockets");
const { exec } = require("child_process");
/*const localtunnel = require('localtunnel');*/

/*(async () => {
  const tunnel = await localtunnel({ port: 3000, subdomain: "fullsendggtesting" });

  console.log("Exposed at >> " + tunnel.url);
})();

exec("lt --port 5000 --subdomain fullsendggtesting", (error, stdout, stderr) => {
  if (error) {
    console.log(`error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});*/


// Declare useful variables
process.title = "fullsendgg-api";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 5000;

// Connect Database
connectDatabase();

// Create HTTP server
const server = Server(app);

// Start WebSocket server
const io = startSocketServer(server, app);

// Setup HTTP server and start listening on given port
server.listen(PORT, () =>
  console.log(
    colors.green(
      `Server >> Listening on port ${PORT} (Production: ${IS_PRODUCTION})`
    )
  )
);

// Export HTTP server
module.exports = { server, io };
